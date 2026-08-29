// Frontend test runner: discovers frontend/tests/*.test.jsx, bundles each
// with esbuild (SSR-only -- react-dom/server, no browser/jsdom available
// in this environment) and runs it as a standalone Node script. Each test
// file is self-contained (see tests/lib/ssr-assert.mjs) and exits 0/1;
// this runner just aggregates those results. Run via `npm test`.
import { readdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import * as esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const testFiles = readdirSync(__dirname).filter((f) => f.endsWith(".test.jsx"));

if (testFiles.length === 0) {
  console.error("No *.test.jsx files found in frontend/tests/.");
  process.exit(1);
}

// react-dom/server has no way to simulate a click -- ReportView's active
// tab is internal useState("overview") with no prop override. Tests that
// need to render a specific non-overview tab (e.g. TAM's null-discipline
// card) use one of these pre-generated copies with that tab defaulted
// instead.
//
// Generated as SIBLINGS of the real ReportView.jsx (src/components/),
// not into a tests/.generated/ subdirectory as before -- ReportView.jsx
// now has real `../lib/...` and `../styles/...` relative imports
// (lib/reportLink.js for Share, styles/print.css for Export PDF), and a
// copy placed anywhere at a different directory depth silently resolved
// those to the wrong location (frontend/tests/lib, frontend/tests/styles
// -- neither exists) with esbuild failing the whole bundle. A sibling
// copy in the exact same directory preserves every relative import
// unchanged. Cleaned up by filename (not an rmSync'd directory, since
// this is no longer its own directory) after the run, same as the
// esbuild output dir below.
const COMPONENTS_DIR = join(__dirname, "..", "src", "components");
const REPORT_VIEW_PATH = join(COMPONENTS_DIR, "ReportView.jsx");
const PATCHED_DEFAULT_TABS = ["tam", "pestel", "swot", "bmc"];
const generatedFiles = PATCHED_DEFAULT_TABS.map((tab) => join(COMPONENTS_DIR, `ReportView.${tab}-default.generated.jsx`));

const reportViewSource = readFileSync(REPORT_VIEW_PATH, "utf-8");
for (const tab of PATCHED_DEFAULT_TABS) {
  const marker = 'useState("overview")';
  if (!reportViewSource.includes(marker)) {
    console.error(`Could not find ${JSON.stringify(marker)} in ReportView.jsx -- patched-default generation needs updating.`);
    process.exit(1);
  }
  const patched = reportViewSource.replace(marker, `useState("${tab}")`);
  writeFileSync(join(COMPONENTS_DIR, `ReportView.${tab}-default.generated.jsx`), patched);
}

const workDir = mkdtempSync(join(tmpdir(), "groundly-frontend-tests-"));
let allPassed = true;

for (const file of testFiles) {
  const entryPath = join(__dirname, file);
  const outfile = join(workDir, file.replace(/\.jsx$/, ".cjs"));

  const result = esbuild.buildSync({
    entryPoints: [entryPath],
    bundle: true,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    outfile,
    logLevel: "silent",
    // GitHub issue #18 (Export PDF) added `import "../styles/print.css"`
    // to ReportView.jsx -- a real CSS file, meaningless in this SSR/Node
    // test context (no DOM/CSSOM here at all) but esbuild still needs a
    // loader for the extension or bundling fails outright. Treat any CSS
    // import as an empty side-effect-only module; the actual stylesheet
    // is verified separately via real browser screenshots, not here.
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
for (const f of generatedFiles) rmSync(f, { force: true });

console.log(`\n${"=".repeat(60)}`);
console.log(allPassed ? "ALL FRONTEND TEST FILES PASSED" : "SOME FRONTEND TEST FILES FAILED");
process.exit(allPassed ? 0 : 1);
