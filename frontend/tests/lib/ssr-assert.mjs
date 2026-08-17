// Tiny check/report helper shared by every *.test.jsx SSR test file.
// Deliberately not a real test framework (no new dependency for one) --
// each test file is a self-contained script: render with
// react-dom/server, assert against the raw HTML string, exit 0/1.
// tests/run.mjs bundles and runs each one and aggregates the results.

const checks = [];

export function check(label, ok) {
  checks.push([label, ok]);
}

export function report(suiteLabel) {
  console.log(`\n=== ${suiteLabel} ===`);
  let allPass = true;
  for (const [label, ok] of checks) {
    console.log(ok ? "PASS" : "FAIL", "-", label);
    if (!ok) allPass = false;
  }
  return allPass;
}

export function finish(suiteLabel) {
  const allPass = report(suiteLabel);
  process.exit(allPass ? 0 : 1);
}
