#!/usr/bin/env node
/**
 * Bump the app version. Single source of truth is the repo-root VERSION file;
 * this also syncs backend/ and frontend/ package.json versions so everything
 * matches.
 *
 * Usage:
 *   node scripts/bump-version.mjs           # patch  (0.2.0 -> 0.2.1)
 *   node scripts/bump-version.mjs minor     # minor  (0.2.1 -> 0.3.0)
 *   node scripts/bump-version.mjs major     # major  (0.3.0 -> 1.0.0)
 *   node scripts/bump-version.mjs 1.4.2     # set explicit version
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const versionFile = path.join(root, "VERSION");

const current = readFileSync(versionFile, "utf8").trim();
const arg = process.argv[2] ?? "patch";

function bump(v, kind) {
  const [maj, min, pat] = v.split(".").map((n) => parseInt(n, 10) || 0);
  if (kind === "major") return `${maj + 1}.0.0`;
  if (kind === "minor") return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

let next;
if (/^\d+\.\d+\.\d+$/.test(arg)) {
  next = arg; // explicit
} else if (["major", "minor", "patch"].includes(arg)) {
  next = bump(current, arg);
} else {
  console.error(`Unknown argument "${arg}". Use major|minor|patch or an explicit x.y.z.`);
  process.exit(1);
}

// Write VERSION
writeFileSync(versionFile, next + "\n");

// Sync package.json versions
for (const pkgPath of [
  path.join(root, "backend", "package.json"),
  path.join(root, "frontend", "package.json"),
]) {
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    pkg.version = next;
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  } catch {
    /* package may not exist yet — skip */
  }
}

console.log(`Version: ${current} -> ${next}`);
console.log("Remember to commit VERSION + package.json changes.");
