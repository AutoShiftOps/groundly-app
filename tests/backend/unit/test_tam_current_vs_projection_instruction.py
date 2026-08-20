# Follow-up precision fix (separate from 9dedac9's null-when-ungrounded
# fix and 51fa8ee's query-wording fix): when the CONTEXT states more than
# one dollar figure for the SAME tier at different points in time (a
# current/present-day figure alongside a future-year projection), the
# model has no stated preference for which one "tam"/"sam"/"som" should
# mean -- confirmed live: for a source stating both a current SAM
# (~$330-670M) and a 2030 projection (~$1.5-2B), the model picked the
# projection with no signal telling it that was the wrong choice.
#
# This can only be verified behaviorally with real calls (see the commit
# message for the actual before/after real-call results) -- this is a
# lightweight regression guard, not a behavioral test: locks in that the
# instruction text itself doesn't silently disappear in a future prompt
# edit, since a missing instruction would reopen exactly this ambiguity
# without any test here catching it.
import re

from agents.rag_pipeline import TAM_STRUCTURED_SUFFIX

# Prompt text wraps across lines for readability, so substring checks
# below match against whitespace-normalized text (line breaks/indentation
# collapsed to single spaces) rather than the raw multi-line string --
# resilient to reflowing, not just today's exact line-wrap positions.
_NORMALIZED = re.sub(r"\s+", " ", TAM_STRUCTURED_SUFFIX)


def test_prefer_current_figure_instruction_present():
    assert "prefer the CURRENT" in _NORMALIZED
    assert "future-year projection" in _NORMALIZED or "future projection" in _NORMALIZED


def test_projection_fallback_still_allowed_when_no_current_figure_exists():
    # The instruction must not become an outright ban on projections --
    # a real projection is still correct when it's the only number
    # available (better than null), just not the default when a current
    # figure also exists.
    assert "no current-year figure at all" in _NORMALIZED
    assert "beats leaving the tier null" in _NORMALIZED


def test_tier_description_guidance_notes_projection_case():
    # Deliberate scope decision (not a new schema field): tier_description
    # is asked to flag a projection-derived figure as a forecast, e.g.
    # "Projected 2030 home charging market", so the frontend doesn't
    # present a future number as if it were today's market size, without
    # adding a new structured field for it.
    assert "Note whether a figure is a future projection" in _NORMALIZED
