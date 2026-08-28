# Real bug caught during Porter's Five Forces' real-call verification
# (GitHub issue #11): backend/routers/analysis.py's STRUCTURED_RESULT_KEYS
# was a separate, hand-maintained tuple duplicating agents/rag_pipeline.py's
# STRUCTURED_FRAMEWORKS field names. Porter's Five Forces was added to
# STRUCTURED_FRAMEWORKS but that second tuple was never updated to match --
# porter_forces was generated correctly by the model (confirmed via a real
# call, raw response had it) but silently never reached the API response,
# since the forwarding loop only copies keys present in this list.
#
# Fixed by deriving STRUCTURED_RESULT_KEYS from STRUCTURED_FRAMEWORKS
# itself instead of hand-duplicating it -- this test locks in that the two
# can never drift apart again, for any framework past or future.
from routers.analysis import STRUCTURED_RESULT_KEYS
from agents.rag_pipeline import STRUCTURED_FRAMEWORKS


def test_structured_result_keys_matches_every_registered_framework_field_name():
    expected = {field_name for _suffix, field_name, _schema_name, _schema in STRUCTURED_FRAMEWORKS.values()}
    assert set(STRUCTURED_RESULT_KEYS) == expected, (
        f"STRUCTURED_RESULT_KEYS {set(STRUCTURED_RESULT_KEYS)} has drifted from "
        f"STRUCTURED_FRAMEWORKS' actual field names {expected} -- a structured "
        f"framework's output would silently never reach the API response."
    )


def test_porter_forces_specifically_present():
    # The exact field that was silently dropped -- pinned directly so a
    # future refactor that reintroduces a hand-maintained list (undoing
    # the derivation) still gets caught even if the general test above is
    # somehow also broken at the same time.
    assert "porter_forces" in STRUCTURED_RESULT_KEYS


def test_structured_result_keys_has_no_duplicates():
    assert len(STRUCTURED_RESULT_KEYS) == len(set(STRUCTURED_RESULT_KEYS))
