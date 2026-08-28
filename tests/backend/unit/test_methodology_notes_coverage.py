# GitHub issue #19: Methodology panel. Cross-language check, same
# pattern as test_framework_lock_parity.py -- regexes
# METHODOLOGY_FRAMEWORK_NOTES' keys out of ReportView.jsx as plain text
# and asserts every real (backend-gated) framework has a per-framework
# methodology note, so a future framework added to FREE_FRAMEWORKS
# can't silently ship without one (the modal would just render the
# shared 3-step pipeline description with no "This framework" section).
import re
from pathlib import Path

from routers.analysis import FREE_FRAMEWORKS

REPORT_VIEW_PATH = (
    Path(__file__).resolve().parents[3] / "frontend" / "src" / "components" / "ReportView.jsx"
)


def _extract_methodology_note_keys() -> set[str]:
    source = REPORT_VIEW_PATH.read_text(encoding="utf-8")
    match = re.search(r"const METHODOLOGY_FRAMEWORK_NOTES\s*=\s*\{(.*?)\n\};", source, re.DOTALL)
    assert match, (
        "Could not find `const METHODOLOGY_FRAMEWORK_NOTES = {...}` in ReportView.jsx -- "
        "this test's extraction regex needs updating to match the current source."
    )
    body = match.group(1)
    keys = re.findall(r'^\s*(\w+):\s*"', body, re.MULTILINE)
    assert keys, "METHODOLOGY_FRAMEWORK_NOTES matched but no keys were extracted -- check the regex."
    return set(keys)


def test_every_free_framework_has_a_methodology_note():
    note_keys = _extract_methodology_note_keys()
    missing = FREE_FRAMEWORKS - note_keys
    assert not missing, (
        f"These real, unlocked frameworks have no entry in METHODOLOGY_FRAMEWORK_NOTES: {missing} -- "
        f"their Methodology modal would show the shared pipeline steps but no per-framework note."
    )


def test_no_stale_methodology_note_for_a_nonexistent_framework():
    note_keys = _extract_methodology_note_keys()
    stale = note_keys - FREE_FRAMEWORKS
    assert not stale, f"METHODOLOGY_FRAMEWORK_NOTES has entries for frameworks not in FREE_FRAMEWORKS: {stale}"
