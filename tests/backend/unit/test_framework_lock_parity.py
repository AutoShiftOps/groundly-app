# docs/TEST_COVERAGE_SPEC.md #4: FREE_FRAMEWORKS (backend's real gating,
# backend/routers/analysis.py) and the sidebar's locked-placeholder set
# (frontend/src/components/ReportView.jsx) both encode the same product
# decision -- "PESTEL/SWOT/TAM/BMC are real, everything else is a
# placeholder" -- from two different files in two different languages.
# A mismatch there would mean either a real framework rendering as locked,
# or a fake one rendering as available. This asserts the two sides agree.
#
# Cross-language, so this reads frontend/.../ReportView.jsx as plain text
# and regex-extracts its constants rather than executing JS. Each regex is
# tied to a specific, named constant and fails loudly (via a clear
# assertion message) if it doesn't match at all, so a future reformat of
# that file breaks this test visibly instead of silently passing on stale
# extracted data.
import re
from pathlib import Path

from routers.analysis import FREE_FRAMEWORKS

REPORT_VIEW_PATH = (
    Path(__file__).resolve().parents[3] / "frontend" / "src" / "components" / "ReportView.jsx"
)


def _report_view_source() -> str:
    assert REPORT_VIEW_PATH.exists(), f"ReportView.jsx not found at {REPORT_VIEW_PATH}"
    return REPORT_VIEW_PATH.read_text(encoding="utf-8")


def _extract_framework_nav_icons_keys(source: str) -> set[str]:
    # const FRAMEWORK_NAV_ICONS = { pestel: Globe, swot: Grid3X3, tam: Target, bmc: LayoutGrid };
    match = re.search(r"const FRAMEWORK_NAV_ICONS\s*=\s*\{([^}]*)\}", source)
    assert match, (
        "Could not find `const FRAMEWORK_NAV_ICONS = {...}` in ReportView.jsx -- "
        "this test's extraction regex needs updating to match the current source."
    )
    keys = re.findall(r"(\w+)\s*:", match.group(1))
    assert keys, "FRAMEWORK_NAV_ICONS matched but no keys were extracted -- check the regex."
    return set(keys)


def _extract_framework_labels(source: str) -> dict[str, str]:
    # const FRAMEWORK_LABELS = { pestel: "PESTEL", swot: "SWOT", tam: "TAM SAM SOM", bmc: "Business Model Canvas" };
    match = re.search(r"const FRAMEWORK_LABELS\s*=\s*\{([^}]*)\}", source)
    assert match, (
        "Could not find `const FRAMEWORK_LABELS = {...}` in ReportView.jsx -- "
        "this test's extraction regex needs updating to match the current source."
    )
    pairs = re.findall(r'(\w+)\s*:\s*"([^"]*)"', match.group(1))
    assert pairs, "FRAMEWORK_LABELS matched but no key/value pairs were extracted -- check the regex."
    return dict(pairs)


def _extract_locked_framework_labels(source: str) -> set[str]:
    # const LOCKED_FRAMEWORKS = [ { label: "Porter's Five Forces", icon: Shield }, ... ];
    match = re.search(r"const LOCKED_FRAMEWORKS\s*=\s*\[(.*?)\];", source, re.DOTALL)
    assert match, (
        "Could not find `const LOCKED_FRAMEWORKS = [...]` in ReportView.jsx -- "
        "this test's extraction regex needs updating to match the current source."
    )
    labels = re.findall(r'label:\s*"((?:[^"\\]|\\.)*)"', match.group(1))
    assert labels, "LOCKED_FRAMEWORKS matched but no labels were extracted -- check the regex."
    return {label.replace('\\"', '"') for label in labels}


def test_free_frameworks_matches_sidebar_nav_icon_keys():
    source = _report_view_source()
    nav_icon_keys = _extract_framework_nav_icons_keys(source)
    assert nav_icon_keys == FREE_FRAMEWORKS, (
        f"backend FREE_FRAMEWORKS {FREE_FRAMEWORKS} and frontend "
        f"FRAMEWORK_NAV_ICONS keys {nav_icon_keys} have drifted apart -- "
        f"either a real framework is missing its nav icon (would silently "
        f"fall back to FileText) or a non-existent one has one."
    )


def test_no_real_framework_label_also_listed_as_locked():
    source = _report_view_source()
    labels = _extract_framework_labels(source)
    locked_labels = _extract_locked_framework_labels(source)

    real_labels = set(labels.values())
    overlap = real_labels & locked_labels
    assert not overlap, (
        f"These labels appear in BOTH FRAMEWORK_LABELS (real, unlocked) and "
        f"LOCKED_FRAMEWORKS (placeholder): {overlap} -- a real framework "
        f"would render with a lock icon, or a fake one would render as if "
        f"it were real."
    )


def test_locked_frameworks_are_not_in_free_frameworks_keyspace():
    # Belt-and-suspenders: none of the *keys* backend actually gates on
    # (pestel/swot/tam/bmc) should textually appear as a locked label
    # either -- catches a mislabeled locked entry using the internal key
    # instead of a display name.
    source = _report_view_source()
    locked_labels = {label.lower() for label in _extract_locked_framework_labels(source)}
    for key in FREE_FRAMEWORKS:
        assert key not in locked_labels, f"Backend framework key {key!r} found among locked labels."
