// Frontend test runner: discovers frontend/tests/*.test.jsx (SSR component
// tests, bundled with esbuild and run as standalone Node scripts via
// react-dom/server -- no browser/jsdom available in this environment) and
// frontend/src/lib/*.test.ts (plain node:test unit tests, ported from the
// AI Studio source for marketSizing.ts/reportStats.ts), bundles each with
// esbuild, and runs it as a standalone Node script. Each file is self-
// contained and exits 0/1; this runner just aggregates those results.
// Run via `npm test`.
import { readdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import * as esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIB_DIR = join(__dirname, "..", "src", "lib");

const jsxTests = readdirSync(__dirname)
  .filter((f) => f.endsWith(".test.jsx"))
  .map((f) => ({ file: f, path: join(__dirname, f) }));
const libTests = readdirSync(LIB_DIR)
  .filter((f) => f.endsWith(".test.ts"))
  .map((f) => ({ file: f, path: join(LIB_DIR, f) }));
const testFiles = [...jsxTests, ...libTests];

if (testFiles.length === 0) {
  console.error("No *.test.jsx or src/lib/*.test.ts files found.");
  process.exit(1);
}

const workDir = mkdtempSync(join(tmpdir(), "groundly-frontend-tests-"));
let allPassed = true;

for (const { file, path: entryPath } of testFiles) {
  const outfile = join(workDir, file.replace(/\.(jsx|ts)$/, ".cjs"));

  const result = esbuild.buildSync({
    entryPoints: [entryPath],
    bundle: true,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    outfile,
    logLevel: "silent",
    // Real CSS/image imports are meaningless in this SSR/Node test context
    // (no DOM/CSSOM here at all) but esbuild still needs a loader for the
    // extension or bundling fails outright.
    loader: { ".css": "empty" },
  });

  if (result.errors.length > 0) {
    console.error(`\n### ${file}: BUNDLE ERROR`);
    for (const e of result.errors) console.error(e.text);
    allPassed = false;
    continue;
  }

  const run = spawnSync(process.execPath, [outfile], { encoding: "utf-8" });
  console.log(`\n----- ${file} -----`);
  if (run.stdout) process.stdout.write(run.stdout);
  if (run.stderr) process.stderr.write(run.stderr);

  if (run.status !== 0) {
    console.error(`### ${file}: FAILED (exit ${run.status})`);
    allPassed = false;
  }
}

rmSync(workDir, { recursive: true, force: true });

console.log(`\n${"=".repeat(60)}`);
console.log(allPassed ? "ALL FRONTEND TEST FILES PASSED" : "SOME FRONTEND TEST FILES FAILED");
process.exit(allPassed ? 0 : 1);
