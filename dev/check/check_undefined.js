const fs = require("fs");
const path = require("path");

const ROOT = process.argv[2];

// Known globals available in this environment (Minecraft Bedrock scripting + JS builtins)
const GLOBALS = new Set([
  "console","Math","JSON","Object","Array","Promise","Date","Map","Set","Symbol",
  "parseInt","parseFloat","isNaN","isFinite","Number","String","Boolean","RegExp",
  "setTimeout","clearTimeout","setInterval","clearInterval","undefined","null",
  "NaN","Infinity","globalThis","structuredClone","BigInt","Error","TypeError",
  "RangeError","world","system", // minecraft globals often referenced via import but list defensively
]);

function listFiles(dir) {
  let out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(listFiles(p));
    else if (entry.name.endsWith(".js")) out.push(p);
  }
  return out;
}

function getDeclaredAndImported(src) {
  const names = new Set();

  // import { a, b as c } from '...'
  for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from/g)) {
    for (const part of m[1].split(",")) {
      const piece = part.trim();
      if (!piece) continue;
      const asMatch = piece.match(/as\s+(\w+)/);
      const name = asMatch ? asMatch[1] : piece.split(/\s+/)[0];
      if (name) names.add(name);
    }
  }
  // import Default from '...'
  for (const m of src.matchAll(/import\s+(\w+)\s+from/g)) names.add(m[1]);

  // top-level (or any-level) function declarations
  for (const m of src.matchAll(/function\s+(\w+)\s*\(/g)) names.add(m[1]);

  // const/let/var name = ...
  for (const m of src.matchAll(/\b(?:const|let|var)\s+(\w+)\s*=/g)) names.add(m[1]);

  // destructuring: const { a, b } = ...
  for (const m of src.matchAll(/\b(?:const|let|var)\s*\{([^}]+)\}\s*=/g)) {
    for (const part of m[1].split(",")) {
      const piece = part.trim().split(":")[0].trim();
      if (piece) names.add(piece.replace(/\s*=.*/, ""));
    }
  }

  // function params (rough): function foo(a, b) / (a,b) =>
  for (const m of src.matchAll(/\(([^()]*)\)\s*(?:=>|\{)/g)) {
    for (const part of m[1].split(",")) {
      const piece = part.trim().split("=")[0].trim();
      if (/^\w+$/.test(piece)) names.add(piece);
    }
  }

  // for (const x of / for (let x in
  for (const m of src.matchAll(/for\s*\(\s*(?:const|let|var)\s+(\w+)/g)) names.add(m[1]);

  // catch (e)
  for (const m of src.matchAll(/catch\s*\(\s*(\w+)\s*\)/g)) names.add(m[1]);

  // export function / export const already covered by above patterns (they still match function/const)

  // class declarations
  for (const m of src.matchAll(/class\s+(\w+)/g)) names.add(m[1]);

  return names;
}

function findCalledIdentifiers(src) {
  // crude: word immediately followed by '(' that isn't a property access (no preceding dot)
  const results = [];
  const re = /(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    results.push({ name: m[2], index: m.index });
  }
  return results;
}

function lineOf(src, index) {
  return src.slice(0, index).split("\n").length;
}

function stripCommentsAndStrings(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    // line comment
    if (c === "/" && c2 === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    // block comment
    if (c === "/" && c2 === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    // string literals ' " `
    if (c === "'" || c === '"' || c === "`") {
      const quote = c;
      out += " ";
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\") { i += 2; continue; }
        // keep template literal ${...} expressions since they contain real code
        if (quote === "`" && src[i] === "$" && src[i + 1] === "{") {
          let depth = 1;
          i += 2;
          out += " ";
          let exprStart = i;
          while (i < n && depth > 0) {
            if (src[i] === "{") depth++;
            else if (src[i] === "}") depth--;
            if (depth > 0) i++;
          }
          out += src.slice(exprStart, i);
          i++; // skip closing }
          continue;
        }
        if (src[i] === "\n") out += "\n";
        i++;
      }
      i++;
      out += " ";
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

const files = listFiles(ROOT);
const report = [];

// also collect exported names per file, in case cross-file check is desired later
for (const file of files) {
  const rawSrc = fs.readFileSync(file, "utf8");
  const src = stripCommentsAndStrings(rawSrc);
  const declared = getDeclaredAndImported(src);
  const calls = findCalledIdentifiers(src);
  const flaggedInFile = new Set();

  for (const c of calls) {
    if (GLOBALS.has(c.name)) continue;
    if (declared.has(c.name)) continue;
    // Skip common JS keywords that can precede '(' like if/for/while/switch/catch/function/return isn't relevant since word check
    if (["if","for","while","switch","catch","function","return","typeof","new","in","of","yield","await","else","do"].includes(c.name)) continue;
    const key = c.name;
    if (flaggedInFile.has(key)) continue; // report each unique name once per file
    flaggedInFile.add(key);
    report.push({ file: path.relative(ROOT, file), name: c.name, line: lineOf(src, c.index) });
  }
}

if (report.length === 0) {
  console.log("No suspicious undefined-identifier calls found.");
} else {
  console.log(`Found ${report.length} suspicious call(s):\n`);
  for (const r of report) {
    console.log(`${r.file}:${r.line}  -> ${r.name}(...)`);
  }
}
