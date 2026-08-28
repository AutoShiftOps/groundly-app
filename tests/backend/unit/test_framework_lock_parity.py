# docs/TEST_COVERAGE_SPEC.md #4: FREE_FRAMEWORKS (backend's real gating,
# backend/routers/analysis.py) and the sidebar's locked-placeholder set
# (frontend/src/components/ReportView.jsx) both encode the same product
# decision -- "PESTEL/SWOT/TAM/BMC are real, everything else is a
# placeholder" -- from two different files in two different languages.
# A mismatch there would mean either a real framework rendering as locked,
# or a fake one rendering as available. This asserts the two sides agree.
#
# Cross-language, so this reads frontend/.../ReportView.jsx as plain text
# and regex-extracts its constants rather than executing JS. The
# extraction target is tied to a specific, named constant and fails loudly
# (via a clear assertion message) if it doesn't match at all, so a future
# reformat of that file breaks this test visibly instead of silently
# passing on stale extracted data.
#
# Follow-up note: the sidebar nav restructure that added fixed mock-order
# (PESTEL, Porter's Five Forces, SWOT, TAM SAM SOM, STP, BCG Matrix, Value
# Chain, Business Model Canvas, Balanced Scorecard) and STP as a new
# locked placeholder collapsed the old FRAMEWORK_NAV_ICONS/
# FRAMEWORK_LABELS/LOCKED_FRAMEWORKS trio (three separately-declared
# object/array literals) into one single source of truth,
# SIDEBAR_FRAMEWORK_NAV, with FRAMEWORK_NAV_ICONS/FRAMEWORK_LABELS now
# derived from it via Object.fromEntries(...) rather than written out
# literally. That changed what this file needed to regex out of the
# source (there's no more literal `const FRAMEWORK_NAV_ICONS = {...}` to
# match) -- this file was updated accordingly; the three test *names* and
# what they assert are unchanged, only the extraction target moved to the
# new single-source-of-truth constant.
import re
from pathlib import Path

from routers.analysis import FREE_FRAMEWORKS

REPORT_VIEW_PATH = (
    Path(__file__).resolve().parents[3] / "frontend" / "src" / "components" / "ReportView.jsx"
)


def _report_view_source() -> str:
    assert REPORT_VIEW_PATH.exists(), f"ReportView.jsx not found at {REPORT_VIEW_PATH}"
    return REPORT_VIEW_PATH.read_text(encoding="utf-8")


def _extract_sidebar_nav_entries(source: str) -> list[tuple[str | None, str]]:
    # const SIDEBAR_FRAMEWORK_NAV = [
    #   { key: "pestel", label: "PESTEL", icon: Globe },
    #   { key: null, label: "Porter's Five Forces", icon: Shield },
    #   ...
    # ];
    # Returns a list of (key_or_None, label) tuples, one per entry, in
    # source order.
    match = re.search(r"const SIDEBAR_FRAMEWORK_NAV\s*=\s*\[(.*?)\n\];", source, re.DOTALL)
    assert match, (
        "Could not find `const SIDEBAR_FRAMEWORK_NAV = [...]` in ReportView.jsx -- "
        "this test's extraction regex needs updating to match the current source."
    )
    body = match.group(1)
    entries = re.findall(
        r'\{\s*key:\s*(null|"(\w+)")\s*,\s*label:\s*"((?:[^"\\]|\\.)*)"',
        body,
    )
    assert entries, "SIDEBAR_FRAMEWORK_NAV matched but no {key, label} entries were extracted -- check the regex."
    result = []
    for raw_key, quoted_key, label in entries:
        key = quoted_key if quoted_key else None
        result.append((key, label.replace('\\"', '"')))
    return result


def test_free_frameworks_matches_sidebar_nav_icon_keys():
    source = _report_view_source()
    entries = _extract_sidebar_nav_entries(source)
    nav_icon_keys = {key for key, _label in entries if key}
    assert nav_icon_keys == FREE_FRAMEWORKS, (
        f"backend FREE_FRAMEWORKS {FREE_FRAMEWORKS} and frontend "
        f"SIDEBAR_FRAMEWORK_NAV's real (non-null-key) entries {nav_icon_keys} have "
        f"drifted apart -- either a real framework is missing from the nav list, or "
        f"a non-existent one has a real key."
    )


def test_no_real_framework_label_also_listed_as_locked():
    source = _report_view_source()
    entries = _extract_sidebar_nav_entries(source)
    real_labels = {label for key, label in entries if key}
    locked_labels = {label for key, label in entries if not key}

    overlap = real_labels & locked_labels
    assert not overlap, (
        f"These labels appear as BOTH a real (unlocked) entry and a locked-placeholder "
        f"entry in SIDEBAR_FRAMEWORK_NAV: {overlap} -- a real framework would render "
        f"with a lock icon, or a fake one would render as if it were real."
    )


def test_locked_frameworks_are_not_in_free_frameworks_keyspace():
    # Belt-and-suspenders: none of the *keys* backend actually gates on
    # (pestel/swot/tam/bmc) should textually appear as a locked label
    # either -- catches a mislabeled locked entry using the internal key
    # instead of a display name.
    source = _report_view_source()
    entries = _extract_sidebar_nav_entries(source)
    locked_labels = {label.lower() for key, label in entries if not key}
    for key in FREE_FRAMEWORKS:
        assert key not in locked_labels, f"Backend framework key {key!r} found among locked labels."


def test_stp_present_and_now_unlocked():
    # docs/TEST_COVERAGE_SPEC.md follow-up, updated for GitHub issue #12:
    # STP was originally missing from the nav entirely, then added as a
    # locked placeholder, and is now a real, working framework (matches
    # FREE_FRAMEWORKS via test_free_frameworks_matches_sidebar_nav_icon_keys
    # above). This just locks in that it's still present at all -- the
    # unlock itself is covered by the FREE_FRAMEWORKS parity test.
    source = _report_view_source()
    entries = _extract_sidebar_nav_entries(source)
    stp_entries = [(key, label) for key, label in entries if label == "STP"]
    assert stp_entries, "STP is missing from SIDEBAR_FRAMEWORK_NAV entirely."
    key, _label = stp_entries[0]
    assert key == "stp", f"STP should be unlocked (key: 'stp') per GitHub issue #12, found key={key!r}."


def test_value_chain_present_and_now_unlocked():
    # GitHub issue #14: same treatment as test_stp_present_and_now_unlocked
    # above -- Value Chain moves from a locked placeholder to a real,
    # working framework.
    source = _report_view_source()
    entries = _extract_sidebar_nav_entries(source)
    vc_entries = [(key, label) for key, label in entries if label == "Value Chain"]
    assert vc_entries, "Value Chain is missing from SIDEBAR_FRAMEWORK_NAV entirely."
    key, _label = vc_entries[0]
    assert key == "value_chain", f"Value Chain should be unlocked (key: 'value_chain') per GitHub issue #14, found key={key!r}."


def test_balanced_scorecard_present_and_now_unlocked():
    # GitHub issue #15: same treatment as test_value_chain_present_and_now_unlocked above.
    source = _report_view_source()
    entries = _extract_sidebar_nav_entries(source)
    bsc_entries = [(key, label) for key, label in entries if label == "Balanced Scorecard"]
    assert bsc_entries, "Balanced Scorecard is missing from SIDEBAR_FRAMEWORK_NAV entirely."
    key, _label = bsc_entries[0]
    assert key == "balanced_scorecard", f"Balanced Scorecard should be unlocked (key: 'balanced_scorecard') per GitHub issue #15, found key={key!r}."


def test_ansoff_matrix_present_and_now_unlocked():
    # GitHub issue #16: last of the original 6 paid-tier frameworks,
    # same treatment as the other unlocks above.
    source = _report_view_source()
    entries = _extract_sidebar_nav_entries(source)
    ansoff_entries = [(key, label) for key, label in entries if label == "Ansoff Matrix"]
    assert ansoff_entries, "Ansoff Matrix is missing from SIDEBAR_FRAMEWORK_NAV entirely."
    key, _label = ansoff_entries[0]
    assert key == "ansoff", f"Ansoff Matrix should be unlocked (key: 'ansoff') per GitHub issue #16, found key={key!r}."


def test_sidebar_nav_order_matches_the_mock_exactly():
    # docs/TEST_COVERAGE_SPEC.md follow-up: the mock interleaves real and
    # locked entries in a fixed order rather than grouping "unlocked
    # first, then locked" -- lock in that exact order so a future refactor
    # (e.g. reverting to two separate lists) doesn't silently regroup it.
    # "Ansoff Matrix" is a deliberate addition beyond the mock's own list
    # (GitHub issue #16, confirmed by the user) -- placed next to BCG
    # Matrix since both are 2x2 strategic-positioning tools.
    source = _report_view_source()
    entries = _extract_sidebar_nav_entries(source)
    labels_in_order = [label for _key, label in entries]
    expected_order = [
        "PESTEL", "Porter's Five Forces", "SWOT", "TAM SAM SOM", "STP",
        "BCG Matrix", "Ansoff Matrix", "Value Chain", "Business Model Canvas", "Balanced Scorecard",
    ]
    assert labels_in_order == expected_order, (
        f"Sidebar nav order drifted from the mock's fixed order.\n"
        f"expected: {expected_order}\n"
        f"actual:   {labels_in_order}"
    )
