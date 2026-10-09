import { world, system, ItemStack, EquipmentSlot } from "@minecraft/server";
import { getLang, t } from "../i18n/lang.js";
import { STR } from "../i18n/strings.js";
import {
  FOOD_SHELF_LIFE_TICKS,
  TICKS_PER_DAY,
  ROTTEN_ITEM_ID,
  getFoodCategory
} from "../data/food-data.js";

// ==========================================
// 食品の鮮度システム(在庫側): tick制・日単位スタンプ
// ------------------------------------------
// 対象: プレイヤーのインベントリ(ホットバー+メイン)とオフハンド。
//   チェスト/樽/シュルカー等のコンテナの中は一切見に行かない(=中にある間は腐らない)。
//
// スタックには2つのスタンプを持たせる:
//   age  … インベントリ側で過ごした累計tick(これが寿命に達したら腐る)
//   seen … 最後に「インベントリにいた」ことを確認した日(食品クロックの日番号)
//
// スタンプの保存先: Bedrockでは「スタックできるアイテム」に動的プロパティを書けない
// (UnsupportedFunctionalityError: Cannot set dynamic properties on stackable items)ため、
// 説明文(lore)の「鮮度: ○○%」の行の末尾に、色コードだけの見えない文字列として埋め込む。
// 例: §r§r§7鮮度: 83%§r§0§0§1§2§3§0§0§0§0§5  (age=5桁16進 + seen=5桁16進)
// loreはスタックできるアイテムにも書けて、同じ内容なら普通にスタックする。
//
// 走査(5秒ごと)で、その日はじめてスタックを見つけたときだけスタンプを更新する:
//   ・初めて見た(=拾った)              → age=0, seen=今日  (ここからタイマー開始)
//   ・seen が昨日                      → age += 1日, seen=今日 (連日持っていた)
//   ・seen がそれより前                → age はそのまま, seen=今日 (丸1日以上しまっていた=時間は進めない)
//   ・seen が今日                      → 何もしない(書き込みなし)
// 取り出したスタックはスタンプを引き継ぐので、しまう前の続きから進む。
//
// スタック問題への対策:
//   1) スタンプが日単位でしか変わらないので、同じ日に手に入れた同種の食べ物は同じスタンプになり、
//      普通に(バニラの挙動で)スタックする。
//   2) 日をまたいで鮮度の違うスタックが並んだ場合は、スロットが減るときだけ自前で合体する。
//      古い方から詰めていき、1スロットに混ざった分は個数で重みづけした平均の経過tickにする。
//
// 表示: スタンプを更新するたびに、アイテムの説明文へ「鮮度: ○○%」を書く(1日1回しか変わらない)。
// 次の日の更新で腐る状態になったら「変な匂いがする…もうしまわないと…」を足す。
// 自前で書いた行は LORE_MARK で見分けて差し替えるので、ほかの説明文があっても壊さない。
//
// 時間の数え方: world.getDay は寝ると飛ぶので使わず、ワールドが実際に進んだtickを
// 積算した食品クロック(food_clock)を使う。
// ==========================================

const AGE_PROP = "food_age"; // 旧方式(動的プロパティ)。スタックできないアイテムの読み取りフォールバック用
const SEEN_PROP = "food_seen";
const CLOCK_KEY = "food_clock";

const SCAN_INTERVAL_TICKS = 100; // 5秒ごとに走査
const CLOCK_SAVE_INTERVAL_TICKS = 1200; // 食品クロックの保存は1分に1回

let _lastTick = null;
let _clock = null;
let _lastSavedClock = 0;
let _warnedStampFailure = false;
let _lastStampError = null;

// ---- 食品クロック ----

// world の動的プロパティは起動直後(early execution)には読めないので、初回利用時に遅延して読む。
function advanceClock() {
  const now = system.currentTick;
  if (_clock === null) {
    _clock = Number(world.getDynamicProperty(CLOCK_KEY) ?? 0);
    _lastSavedClock = _clock;
    _lastTick = now;
    return _clock;
  }
  const d = now - _lastTick;
  _lastTick = now;
  if (d > 0) _clock += d;
  return _clock;
}

// 現在の食品クロック値(tick)。生鮮市場(出品日時の刻印・鮮度計算)もこれを使う。
export function getFoodClock() {
  return advanceClock();
}

function saveClock() {
  if (_clock - _lastSavedClock < CLOCK_SAVE_INTERVAL_TICKS) return;
  try {
    world.setDynamicProperty(CLOCK_KEY, _clock);
    _lastSavedClock = _clock;
  } catch (e) {
    console.warn("[BeeMyHoney] food clock save failed: " + e);
  }
}

function dayOf(clock) {
  return Math.floor(clock / TICKS_PER_DAY);
}

// ---- スタンプ(loreに埋め込む) ----

const LORE_MARK = "§r§r"; // 自前の行の目印(見た目には影響しない)
const HEX_LEN = 5; // age / seen をそれぞれ5桁の16進で持つ
const TAIL_RE = new RegExp("§r((?:§[0-9a-f]){" + HEX_LEN * 2 + "})$");

// 数値 → 「§1§a§0…」(色コードだけなので画面には何も出ない)
function encodeHidden(n) {
  const hex = Math.max(0, Math.min(16 ** HEX_LEN - 1, Math.round(n))).toString(16).padStart(HEX_LEN, "0");
  return hex.split("").map((c) => "§" + c).join("");
}

function decodeHidden(codes) {
  return parseInt(codes.replace(/§/g, ""), 16);
}

function readNum(stack, prop) {
  try {
    const v = stack.getDynamicProperty(prop);
    return typeof v === "number" ? v : undefined;
  } catch (e) {
    return undefined;
  }
}

// スタンプを読む。{ age, seen } か、無ければ null。
function readStamp(stack) {
  try {
    for (const line of stack.getLore() ?? []) {
      if (!line.startsWith(LORE_MARK)) continue;
      const m = TAIL_RE.exec(line);
      if (!m) continue;
      const all = m[1].replace(/§/g, "");
      return { age: parseInt(all.slice(0, HEX_LEN), 16), seen: parseInt(all.slice(HEX_LEN), 16) };
    }
  } catch (e) {
    // loreを読めないときは旧方式へ
  }
  // 旧方式(動的プロパティ)で刻印済みの、スタックできないアイテムだけ引き継ぐ
  const age = readNum(stack, AGE_PROP);
  const seen = readNum(stack, SEEN_PROP);
  return age !== undefined && seen !== undefined ? { age, seen } : null;
}

// ---- 説明文(鮮度表示 + スタンプ) ----

function freshnessPercent(age, category) {
  const life = FOOD_SHELF_LIFE_TICKS[category];
  return Math.max(0, Math.min(100, Math.round((1 - age / life) * 100)));
}

// スタンプと鮮度表示をloreに書く。loreが変わったら true、書けなかった/変化なしは false。
function writeStamp(stack, age, seen, category, lang) {
  const life = FOOD_SHELF_LIFE_TICKS[category];
  const ours = [
    LORE_MARK + t(lang, STR.freshnessLoreLine, freshnessPercent(age, category)) + "§r" + encodeHidden(age) + encodeHidden(seen)
  ];
  if (age + TICKS_PER_DAY >= life) ours.push(LORE_MARK + t(lang, STR.freshnessLoreWarn)); // 次の更新で腐る

  let current = [];
  try {
    current = stack.getLore() ?? [];
  } catch (e) {
    return false;
  }
  const next = current.filter((l) => !l.startsWith(LORE_MARK)).concat(ours);
  if (next.length === current.length && next.every((l, i) => l === current[i])) return false;
  try {
    stack.setLore(next);
    return true;
  } catch (e) {
    _lastStampError = String(e);
    if (!_warnedStampFailure) {
      _warnedStampFailure = true;
      console.warn("[BeeMyHoney] food stamp failed (setLore): " + e);
    }
    return false;
  }
}

// ---- 対象スロットの収集 ----

// インベントリ(合体の対象)とオフハンド(合体はしない)を、get/set の組で返す。
function collectSlots(player) {
  const slots = [];
  const inv = player.getComponent("inventory")?.container;
  if (inv) {
    for (let i = 0; i < inv.size; i++) {
      slots.push({ mergeable: true, get: () => inv.getItem(i), set: (s) => inv.setItem(i, s) });
    }
  }
  try {
    const off = player.getComponent("equippable")?.getEquipmentSlot(EquipmentSlot?.Offhand ?? "Offhand");
    if (off) slots.push({ mergeable: false, get: () => off.getItem(), set: (s) => off.setItem(s) });
  } catch (e) {
    // オフハンドを取得できない環境では、インベントリだけを対象にする
  }
  return slots;
}

// ---- 走査 ----

// 1人ぶんを走査する。腐らせた個数を返す。extraAge はデバッグ用(全食品の経過tickを強制的に進める)。
export function patrolPlayerInventory(player, clock, extraAge = 0) {
  const today = dayOf(clock);
  const lang = getLang(player);
  const slots = collectSlots(player);
  const kept = []; // 生き残った食品スタック(合体の候補)
  let rotted = 0;

  for (const slot of slots) {
    const stack = slot.get();
    if (!stack) continue;
    const category = getFoodCategory(stack.typeId);
    if (!category) continue;

    const stamp = readStamp(stack);
    let age = stamp?.age;
    let seen = stamp?.seen;
    let dirty = false;

    if (age === undefined || seen === undefined) {
      age = 0; // 初めて見る個体: ここからタイマー開始
      seen = today;
    } else if (seen !== today) {
      if (seen === today - 1) age += TICKS_PER_DAY; // 連日持っていた
      seen = today; // それ以外(丸1日以上しまっていた/時計の巻き戻り)は進めない
    }
    if (extraAge > 0) age += extraAge;

    if (age >= FOOD_SHELF_LIFE_TICKS[category]) {
      slot.set(new ItemStack(ROTTEN_ITEM_ID, stack.amount));
      rotted += stack.amount;
      continue;
    }
    // スタンプ更新・鮮度表示の変更があったときだけ書き戻す(同日中の再走査では何も書かない)
    if (writeStamp(stack, age, seen, category, lang)) dirty = true;
    if (dirty) slot.set(stack);
    kept.push({ slot, stack, age });
  }

  mergeStacks(kept, today, lang);
  return rotted;
}

// 同種で鮮度の違うスタックを、スロットが減るときだけ合体する。
// 古い方から詰めて、1スロットに混ざった分は個数で重みづけした平均の経過tickにする。
function mergeStacks(entries, today, lang) {
  const groups = new Map();
  for (const e of entries) {
    if (!e.slot.mergeable) continue;
    if ((e.stack.maxAmount ?? 1) <= 1) continue;
    const list = groups.get(e.stack.typeId) ?? [];
    list.push(e);
    groups.set(e.stack.typeId, list);
  }

  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const base = list[0].stack;
    const max = base.maxAmount;
    // 名前付き・説明付きなど、見た目の違うスタックは合体しない
    if (list.some((e) => e.stack.nameTag !== base.nameTag)) continue;

    const total = list.reduce((sum, e) => sum + e.stack.amount, 0);
    const needed = Math.ceil(total / max);
    if (needed >= list.length) continue; // スロットが減らないなら触らない

    const pieces = list.map((e) => ({ amount: e.stack.amount, age: e.age })).sort((a, b) => b.age - a.age);
    const packed = [];
    let fill = 0;
    let ageSum = 0;
    for (const p of pieces) {
      let left = p.amount;
      while (left > 0) {
        const take = Math.min(max - fill, left);
        fill += take;
        ageSum += take * p.age;
        left -= take;
        if (fill === max) {
          packed.push({ amount: fill, age: Math.round(ageSum / fill) });
          fill = 0;
          ageSum = 0;
        }
      }
    }
    if (fill > 0) packed.push({ amount: fill, age: Math.round(ageSum / fill) });

    for (let i = 0; i < list.length; i++) {
      if (i >= packed.length) {
        list[i].slot.set(undefined);
        continue;
      }
      const s = base.clone();
      s.amount = packed[i].amount;
      writeStamp(s, packed[i].age, today, getFoodCategory(s.typeId), lang);
      list[i].slot.set(s);
    }
  }
}

function notifyRotted(player, rotted) {
  if (rotted <= 0) return;
  const msg = t(getLang(player), STR.freshnessRotted, rotted);
  try {
    player.onScreenDisplay.setActionBar(msg);
  } catch (e) {
    player.sendMessage(msg);
  }
}

export function runInventoryPatrol() {
  const clock = advanceClock();
  for (const player of world.getPlayers()) {
    notifyRotted(player, patrolPlayerInventory(player, clock));
  }
  saveClock();
}

// 起動時に一度だけ呼ぶ。
export function startFreshnessPatrol() {
  system.runInterval(runInventoryPatrol, SCAN_INTERVAL_TICKS);
  subscribeDebugEvents();
}

// ==========================================
// 動作確認用の scriptevent(コマンド権限のあるプレイヤーが実行する)
//   /scriptevent bmh:food_age [日数]  … 手持ち(オフハンド含む)の食品の経過を日数分(省略時は1日)進めて即判定
//   /scriptevent bmh:food_info        … 手持ちの食品ごとの経過/寿命(日)を表示
// ==========================================
function showFoodInfo(player) {
  const lang = getLang(player);
  const toDays = (n) => Math.round((n / TICKS_PER_DAY) * 10) / 10;
  let shown = 0;
  for (const slot of collectSlots(player)) {
    const stack = slot.get();
    const category = stack ? getFoodCategory(stack.typeId) : null;
    if (!category) continue;
    const age = readStamp(stack)?.age;
    player.sendMessage(
      t(lang, STR.freshnessDebugLine, stack.typeId, stack.amount, age === undefined ? "-" : toDays(age), toDays(FOOD_SHELF_LIFE_TICKS[category]))
    );
    shown++;
  }
  if (shown === 0) player.sendMessage(t(lang, STR.freshnessDebugNone));
}

function subscribeDebugEvents() {
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    const player = ev.sourceEntity;
    if (!player || player.typeId !== "minecraft:player") return;

    if (ev.id === "bmh:food_age") {
      const days = Number(ev.message) > 0 ? Number(ev.message) : 1;
      _lastStampError = null;
      const rotted = patrolPlayerInventory(player, advanceClock(), Math.round(days * TICKS_PER_DAY));
      player.sendMessage(t(getLang(player), STR.freshnessDebugAged, days));
      if (_lastStampError) player.sendMessage(t(getLang(player), STR.freshnessDebugStampFail, _lastStampError));
      notifyRotted(player, rotted);
      showFoodInfo(player); // 進めた結果をそのまま表示する
    } else if (ev.id === "bmh:food_info") {
      showFoodInfo(player);
    }
  });
}


