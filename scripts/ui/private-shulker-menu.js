import { world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { getLang, t } from "../i18n/lang.js";
import { STR } from "../i18n/strings.js";
import { getBinding, getBindingAt, bindShulker, releaseBinding, getPrivateShulkerBlock, findDanger } from "../economy/private-shulker.js";

// 専用シュルカーの管理メニュー(本でシュルカーボックスを触ると開く)。pos = { dimId, x, y, z, typeId }
export function openPrivateShulkerMenu(player, pos) {
  const lang = getLang(player);
  const here = getBindingAt(pos.dimId, pos.x, pos.y, pos.z);
  const mine = getBinding(player.id);
  if (here && here.playerId !== player.id) { player.sendMessage(t(lang, STR.pshTaken)); return; }

  const form = new ActionFormData().title(t(lang, STR.pshTitle));
  let actions;
  if (here) {
    const block = getPrivateShulkerBlock(player.id);
    const c = block?.getComponent?.("minecraft:inventory")?.container;
    const size = c?.size ?? 27;
    const free = c ? (c.emptySlotsCount ?? size) : size;
    form.body(t(lang, STR.pshBodyMine, free, size)).button(t(lang, STR.pshBtnRelease)).button(t(lang, STR.pshBtnClose));
    actions = ["release", "close"];
  } else if (mine) {
    form.body(t(lang, STR.pshBodyFreeHasOther, mine.x, mine.y, mine.z)).button(t(lang, STR.pshBtnMove)).button(t(lang, STR.pshBtnClose));
    actions = ["move", "close"];
  } else {
    form.body(t(lang, STR.pshBodyFree)).button(t(lang, STR.pshBtnRegister)).button(t(lang, STR.pshBtnClose));
    actions = ["register", "close"];
  }

  form.show(player).then((r) => {
    if (r.canceled) return;
    const act = actions[r.selection];
    if (act === "release") {
      releaseBinding(player.id);
      player.sendMessage(t(lang, STR.pshReleased));
    } else if (act === "register" || act === "move") {
      const bad = findDanger(pos);
      if (bad) { player.sendMessage(t(lang, STR.pshDanger, bad.id, bad.x, bad.y, bad.z)); return; }
      const res = bindShulker({
        playerId: player.id, name: player.name, dimId: pos.dimId, x: pos.x, y: pos.y, z: pos.z,
        typeId: pos.typeId, day: world.getDay(), replace: act === "move"
      });
      if (res.ok) player.sendMessage(t(lang, res.moved ? STR.pshMoved : STR.pshRegistered));
      else if (res.reason === "taken") player.sendMessage(t(lang, STR.pshTaken));
    }
  }).catch((e) => console.warn("[BeeMyHoney] private shulker menu: " + e));
}
