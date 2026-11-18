"""
Real-data lookup against the City of Mississauga's open-data ArcGIS
FeatureServer endpoints (2025 Business Directory, 2025 Employment Survey
by Commercial Hub, Licensed Eateries Registry).

Ported from the AI-Studio export's server.ts (queryMississaugaDirectory,
queryMississaugaCommercialHubs) and src/lib/mississaugaOpenData.ts
(buildNaicsPriorityPlan, the sector-keyword map, the directory-citation/
snippet formatters) -- same real endpoints, same NAICS priority plan,
same business-name sanitisation, same step order (exact name match ->
exact-NAICS peers -> broad-keyword peers), re-implemented against httpx
instead of fetch(). This never returns a fabricated figure: every citation
carries the real ArcGIS query URL that produced it, and `similarity` is
always None (these rows never go through pgvector -- see agents/
rag_pipeline.py's run_pipeline(), which only ever sets a real cosine
score on chunks that did).
"""

import logging
import re
from urllib.parse import urlsplit, urlencode

import httpx

logger = logging.getLogger(__name__)

DEFAULT_DIRECTORY_URL = (
    "https://services6.arcgis.com/hM5ymMLbxIyWTjn2/arcgis/rest/services/"
    "2025_Mississauga_Business_Directory/FeatureServer/0/query"
)
EMPLOYMENT_SURVEY_URL = (
    "https://services6.arcgis.com/hM5ymMLbxIyWTjn2/arcgis/rest/services/"
    "MED_2025_Employment_byCAType/FeatureServer/0/query"
)
EATERIES_URL = (
    "https://services6.arcgis.com/hM5ymMLbxIyWTjn2/arcgis/rest/services/"
    "Mississauga_Licensed_Eateries/FeatureServer/0/query"
)

# Only a real City of Mississauga or Esri ArcGIS open-data host may be
# supplied as a custom dataSourceUrl -- anything else is rejected before
# any network call is made (backend/routers/analysis.py turns this into
# an HTTP 400).
_ALLOWED_HOST_SUFFIXES = (".arcgis.com", ".mississauga.ca")

_REQUEST_TIMEOUT = 6.0
_SUPPLEMENTARY_TIMEOUT = 5.0


class DataSourceUrlError(ValueError):
    pass


def validate_data_source_url(url: str) -> None:
    """Raises DataSourceUrlError if `url` isn't an https:// URL on an
    allowed ArcGIS/Mississauga open-data host. Never raises for None/empty
    (an absent dataSourceUrl just means "use the default directory")."""
    parts = urlsplit(url)
    if parts.scheme != "https":
        raise DataSourceUrlError("dataSourceUrl must be an https:// URL.")
    host = (parts.hostname or "").lower()
    if not any(host.endswith(suffix) for suffix in _ALLOWED_HOST_SUFFIXES):
        raise DataSourceUrlError(
            f"dataSourceUrl host {host!r} is not an allowed open-data host "
            f"(must end with {' or '.join(_ALLOWED_HOST_SUFFIXES)})."
        )


def is_mississauga_scope(geography: str | None) -> bool:
    target = (geography or "").lower()
    return any(term in target for term in ("mississauga", "gta", "ontario"))


def sanitize_business_name(name: str | None) -> str:
    # Alphanumerics, space, & and . only -- matches server.ts's
    # `.replace(/[^a-zA-Z0-9 &.]/g, " ")` exactly.
    return re.sub(r"[^a-zA-Z0-9 &.]", " ", name or "").strip()


# Ported verbatim (pattern + resulting NAICS-ish keyword terms) from
# frontend/src/lib/marketSizing.ts's SECTOR_MAP, which already duplicated
# this table for a client-side sector label -- single real source of
# truth for backend open-data querying is this module now.
_SECTOR_MAP: list[tuple[re.Pattern, list[str]]] = [
    # cater(?:ing|er|ers)? -- was bare "cater", which (being a whole-word
    # match) never matched the far more common real-world forms
    # "catering"/"caterer"/"caterers" (confirmed live: a "pre-portioned
    # ingredient kits for home caterers" idea fell through to this
    # group's intended CATER/FOOD/RESTAURANT match only by accident, via
    # an unrelated "food" word elsewhere in the text). Purely additive;
    # bare "cater" still matches as before.
    (re.compile(r"\b(food|cater(?:ing|er|ers)?|restaurant|cafe|coffee|bakery|meal|kitchen|culinary|dining|bistro|hospitality|event)\b", re.I),
     ["CATER", "FOOD", "RESTAURANT"]),
    (re.compile(r"\b(health|physio|clinic|dental|medical|pharma|wellness|therapy|chiro|fitness)\b", re.I),
     ["HEALTH", "CLINIC", "MEDICAL"]),
    (re.compile(r"\b(software|saas|tech|ai|cloud|fintech|data|platform|digital|it|cyber|app)\b", re.I),
     ["SOFTWARE", "COMPUTER", "TECHNOLOGY", "CONSULTING"]),
    (re.compile(r"\b(logistics|freight|truck|shipping|courier|warehouse|supply|delivery|transport)\b", re.I),
     ["FREIGHT", "TRANSPORT", "WAREHOUS", "COURIER"]),
    (re.compile(r"\b(retail|ecommerce|shop|store|apparel|fashion|grocery|supermarket)\b", re.I),
     ["RETAIL", "STORE", "GROCERY"]),
    (re.compile(r"\b(construct|contractor|plumbing|hvac|electrical|engineering|architect)\b", re.I),
     ["CONSTRUCT", "CONTRACT", "ENGINEER"]),
]

_STOPWORDS = {"CANADA", "MISSISSAUGA", "ONTARIO", "BUSINESS", "PLATFORM", "COMPANY", "CORP"}


def infer_sector_keywords(business_name: str | None, idea: str | None, industry: str | None) -> list[str]:
    combined = " ".join(filter(None, [industry, idea, business_name]))
    out: list[str] = []
    seen: set[str] = set()
    for pattern, terms in _SECTOR_MAP:
        if pattern.search(combined):
            for term in terms:
                if term not in seen:
                    seen.add(term)
                    out.append(term)
    if not out:
        tokens = [w.upper() for w in re.sub(r"[^a-zA-Z0-9 ]", " ", combined).split() if len(w) >= 4]
        for tok in tokens:
            if tok not in _STOPWORDS and tok not in seen:
                seen.add(tok)
                out.append(tok)
            if len(out) >= 3:
                break
    return out[:4]


# market_size_category_phrase() (a keyword-table -> bare-sector-phrase
# mapping, e.g. "SOFTWARE" -> "software") used to live here and fed
# agents/rag_pipeline.py's TAM market-size search. Removed: a bare
# sector name is real but too broad to be one specific idea's actual
# addressable market (confirmed live: a tax-prep-for-freelancers idea
# got the entire $921B U.S. software market as its TAM). Replaced by
# agents.rag_pipeline._classify_tam_market_category(), a small LLM call
# that names the idea's actual specific category plus one parent
# category, never a bare whole-sector name for either.


# Plain substring match against common country names/abbreviations in a
# geography string -- good enough for "<category> market size <country>
# USD" search queries; doesn't need to be exhaustive or precise since a
# wrong-but-plausible country guess still produces a reasonable Tavily
# query, and the actual geography/scope used ends up labeled in the
# result's own tier_description (sourced from the search result itself,
# not from this guess).
_COUNTRY_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\bcanada\b", re.I), "Canada"),
    (re.compile(r"\b(united states|usa|u\.s\.a?\.?)\b", re.I), "United States"),
    (re.compile(r"\b(united kingdom|uk)\b", re.I), "United Kingdom"),
    (re.compile(r"\baustralia\b", re.I), "Australia"),
]


def infer_country_from_geography(geography: str | None) -> str:
    text = geography or ""
    for pattern, country in _COUNTRY_PATTERNS:
        if pattern.search(text):
            return country
    # Ontario/Mississauga/GTA-scoped geographies with no explicit country
    # string default to Canada (consistent with is_mississauga_scope's
    # own Mississauga/GTA/Ontario gate).
    if is_mississauga_scope(text):
        return "Canada"
    return "United States"


def build_naics_priority_plan(business_name: str | None, idea: str | None, industry: str | None,
                               sector_keywords: list[str]) -> dict:
    combined = " ".join(filter(None, [business_name, idea, industry]))
    if re.search(r"\b(cater|banquet|event\s+food|corporate\s+lunch|office\s+meal|tiffin|commissary)\b", combined, re.I) \
            or (sector_keywords[:1] == ["CATER"]):
        return {
            "exact_where": "NAICSCode = '722320'",
            "broad_where": "NAICSCode LIKE '722%'",
            "category_label": "Caterers (NAICS 722320) & Food Services (722)",
        }
    if "FOOD" in sector_keywords or "RESTAURANT" in sector_keywords:
        return {
            "exact_where": "NAICSCode LIKE '7225%' OR NAICSCode = '722320'",
            "broad_where": "NAICSCode LIKE '722%'",
            "category_label": "Restaurants & Food Services (NAICS 722)",
        }
    if "HEALTH" in sector_keywords or "CLINIC" in sector_keywords:
        return {
            "exact_where": "NAICSCode LIKE '621%'",
            "broad_where": "NAICSCode LIKE '62%'",
            "category_label": "Ambulatory Health Care & Clinics (NAICS 621)",
        }
    if "SOFTWARE" in sector_keywords or "TECHNOLOGY" in sector_keywords:
        return {
            "exact_where": "NAICSCode LIKE '5415%' OR NAICSCode = '511210'",
            "broad_where": "NAICSCode LIKE '541%'",
            "category_label": "Computer Systems Design & Software (NAICS 5415/5112)",
        }
    return {
        "exact_where": None,
        "broad_where": None,
        "category_label": ", ".join(sector_keywords) or "Local Commercial Peers",
    }


async def _arcgis_get(client: httpx.AsyncClient, endpoint: str, params: dict, timeout: float) -> dict | None:
    try:
        resp = await client.get(endpoint, params=params, timeout=timeout)
        if resp.status_code != 200:
            return None
        return resp.json()
    except Exception:
        logger.exception("mississauga_data: ArcGIS request failed for endpoint=%r params=%r", endpoint, params)
        return None


async def _query_rows(client: httpx.AsyncClient, endpoint: str, where: str, out_fields: str,
                       result_record_count: int = 15) -> list[dict]:
    body = await _arcgis_get(client, endpoint, {
        "f": "json",
        "where": where,
        "outFields": out_fields,
        "resultRecordCount": result_record_count,
    }, _REQUEST_TIMEOUT)
    if not body:
        return []
    features = body.get("features") or []
    rows = [f.get("attributes") for f in features if f.get("attributes") and f["attributes"].get("BusinessName")]
    return rows[:result_record_count]


async def _query_count(client: httpx.AsyncClient, endpoint: str, where: str) -> int | None:
    body = await _arcgis_get(client, endpoint, {"f": "json", "where": where, "returnCountOnly": "true"}, 4.0)
    if not body:
        return None
    count = body.get("count")
    return count if isinstance(count, int) else None


def _citation_url(endpoint: str, where: str, out_fields: str) -> str:
    # A transparent, re-runnable query URL for citation evidence -- same
    # idea as server.ts's buildFilteredDirectoryCitationUrl: the real
    # filtered query, not an unfiltered dump of the whole dataset.
    params = urlencode({"where": where, "outFields": out_fields, "resultRecordCount": 15, "f": "pjson"})
    return f"{endpoint}?{params}"


def _format_peer_snippet(exact_match: bool, business_name: str | None, rows: list[dict],
                          matched_count: int, total_sector_count: int | None, category_label: str) -> str:
    previews = []
    for r in rows[:4]:
        area = r.get("CHArea") or (f"Ward {r['Ward']}" if r.get("Ward") else "Mississauga")
        size = f", {r['EmplRange']} staff" if r.get("EmplRange") else ""
        previews.append(f"{r.get('BusinessName')} ({r.get('NAICSDescription') or r.get('NAICSSector') or 'Commercial'}, {area}{size})")
    preview_text = "; ".join(previews)
    if exact_match:
        return f"Matched {matched_count} exact record(s) in 2025 Mississauga Business Directory: {preview_text}."
    total_text = (
        f"{total_sector_count} total registered in Mississauga"
        if total_sector_count and total_sector_count > matched_count
        else f"{matched_count} sampled peers"
    )
    return (
        f"Trade name {business_name or 'venture'!r} is unlisted by DBA name in the 2025 snapshot; "
        f"retrieved {category_label} peers ({total_text}) including: {preview_text}."
    )


async def _query_commercial_hubs(client: httpx.AsyncClient, is_food_sector: bool, is_default_endpoint: bool,
                                  geography: str | None) -> dict:
    summaries: list[str] = []
    citations: list[dict] = []
    if not is_default_endpoint or not is_mississauga_scope(geography or "Mississauga"):
        return {"summaries": summaries, "citations": citations}

    emp_body = await _arcgis_get(client, EMPLOYMENT_SURVEY_URL, {"where": "1=1", "outFields": "*", "f": "json"}, _SUPPLEMENTARY_TIMEOUT)
    if emp_body:
        rows = [f.get("attributes") for f in (emp_body.get("features") or []) if f.get("attributes", {}).get("CA_Type")]
        summarized = _summarize_employment_hubs(rows)
        if summarized:
            summaries.append(summarized["summary"])
            citations.append({
                "source_title": "City of Mississauga 2025 Employment Survey by Commercial Hub (MED)",
                "source_url": _citation_url(EMPLOYMENT_SURVEY_URL, "1=1", "*"),
                "snippet": summarized["snippet"],
                "similarity": None,
            })

    if is_food_sector:
        where = "UPPER(BUSINESSTYPE) LIKE '%CATER%' OR UPPER(BUSINESSNAME) LIKE '%CATER%'"
        list_body = await _arcgis_get(client, EATERIES_URL, {
            "f": "json", "where": where, "outFields": "BUSINESSNAME,BUSINESSTYPE,STREET,POSTAL", "resultRecordCount": 8,
        }, _SUPPLEMENTARY_TIMEOUT)
        count_body = await _arcgis_get(client, EATERIES_URL, {"f": "json", "where": "1=1", "returnCountOnly": "true"}, 4.5)
        eateries = [f.get("attributes") for f in (list_body.get("features") or []) if list_body] if list_body else []
        eateries = [e for e in eateries if e and e.get("BUSINESSNAME")]
        total_licensed = count_body.get("count") if count_body and isinstance(count_body.get("count"), int) else None
        if eateries or total_licensed:
            sample = "; ".join(
                f"{e['BUSINESSNAME']} ({e.get('STREET') or 'Mississauga'}{' ' + e['POSTAL'] if e.get('POSTAL') else ''})"
                for e in eateries[:5]
            )
            count_text = f"{total_licensed:,} active licensed food premises" if total_licensed else "Active licensed premises"
            summaries.append(
                f"MISSISSAUGA LICENSED EATERIES & COMMISSARY SUPPLY ({count_text}): "
                f"Sample licensed catering operators include {sample}."
            )
            citations.append({
                "source_title": f"Mississauga Licensed Eateries Registry ({f'{total_licensed:,} premises' if total_licensed else 'Active Registry'})",
                "source_url": _citation_url(EATERIES_URL, where, "BUSINESSNAME,BUSINESSTYPE,STREET,POSTAL"),
                "snippet": f"Active health-inspected food & catering supply base ({count_text}), including {sample}.",
                "similarity": None,
            })

    return {"summaries": summaries, "citations": citations}


def _summarize_employment_hubs(rows: list[dict]) -> dict | None:
    if not rows:
        return None

    def find_row(prefix: str) -> dict | None:
        return next((r for r in rows if prefix.lower() in (r.get("CA_Type") or "").lower()), None)

    cc, dt, ea = find_row("Corporate Centres"), find_row("Downtown"), find_row("Employment Areas")
    total_surveyed = round(sum(float(r.get("Total_Employees_Based_on_Responding_Businesses") or 0) for r in rows))

    def nums(row: dict | None) -> tuple[int, int, int]:
        if not row:
            return 0, 0, 0
        return (
            round(float(row.get("Working_From_Workplace") or 0)),
            round(float(row.get("Hybrid_Employees") or 0)),
            round(float(row.get("Total_Employees_Based_on_Responding_Businesses") or 0)),
        )

    cc_office, cc_hybrid, cc_total = nums(cc)
    dt_office, dt_hybrid, dt_total = nums(dt)
    ea_office, ea_hybrid, ea_total = nums(ea)

    lines = [f"MISSISSAUGA 2025 EMPLOYMENT & WORKPLACE MODE SURVEY (MED_2025_Employment_byCAType — {total_surveyed:,} surveyed workers):"]
    if cc:
        lines.append(f"- Corporate Centres (CC): {cc_total:,} total employees ({cc_office:,} full on-site + {cc_hybrid:,} hybrid = {cc_office + cc_hybrid:,} active office commuters)")
    if dt:
        lines.append(f"- Downtown Mississauga (DT): {dt_total:,} total employees ({dt_office:,} full on-site + {dt_hybrid:,} hybrid = {dt_office + dt_hybrid:,} active downtown workers)")
    if ea:
        lines.append(f"- Employment Areas (EA): {ea_total:,} total employees ({ea_office:,} full on-site + {ea_hybrid:,} hybrid)")

    snippet = (
        f"2025 City Employment Survey across {total_surveyed:,} workers: Corporate Centres hold {cc_total:,} "
        f"employees ({cc_office + cc_hybrid:,} on-site/hybrid) and Downtown holds {dt_total:,} "
        f"({dt_office + dt_hybrid:,} on-site/hybrid), quantifying local B2B office demand."
    )
    return {"summary": "\n".join(lines), "snippet": snippet}


_DIRECTORY_OUT_FIELDS = "BusinessName,NAICSSector,NAICSCode,NAICSDescription,EmplRange,CHArea,Ward,StreetAddress,WebAddress"


async def query_directory(mode: str, business_name: str | None, idea: str | None, industry: str | None,
                           geography: str | None, data_source_url: str | None) -> dict:
    """Real lookup against the City of Mississauga's open-data business
    directory (plus supplementary employment-survey/licensed-eateries
    datasets). Returns a dict with a `status` of "found" (exact trade-name
    match), "sector_context" (unlisted by name, real NAICS/keyword peers
    returned instead), or "not_found" (nothing usable came back) -- never
    raises; a network failure degrades to "not_found" with empty citations,
    same defensive pattern as agents/web_retrieval.py.
    """
    is_custom_endpoint = bool(data_source_url)
    endpoint = data_source_url if is_custom_endpoint else DEFAULT_DIRECTORY_URL

    clean_name = sanitize_business_name(business_name)
    sector_keywords = infer_sector_keywords(business_name, idea, industry)
    naics_plan = build_naics_priority_plan(business_name, idea, industry, sector_keywords)
    is_food_sector = any(k in sector_keywords for k in ("CATER", "FOOD", "RESTAURANT"))

    try:
        async with httpx.AsyncClient() as client:
            rows: list[dict] = []
            exact_match = False
            total_sector_count: int | None = None

            if mode == "business" and clean_name:
                name_words = [w.upper() for w in clean_name.split() if len(w) >= 2][:4]
                if name_words:
                    phrase = " ".join(name_words)
                    rows = await _query_rows(client, endpoint, f"UPPER(BusinessName) LIKE '%{phrase}%'", _DIRECTORY_OUT_FIELDS)
                    if not rows and len(name_words) > 1:
                        where = " AND ".join(f"UPPER(BusinessName) LIKE '%{w}%'" for w in name_words)
                        rows = await _query_rows(client, endpoint, where, _DIRECTORY_OUT_FIELDS)
                    if rows:
                        exact_match = True

            if not rows and not is_custom_endpoint and naics_plan["exact_where"]:
                rows, total_sector_count = (await _query_rows(client, endpoint, naics_plan["exact_where"], _DIRECTORY_OUT_FIELDS),
                                             await _query_count(client, endpoint, naics_plan["exact_where"]))

            if not rows and sector_keywords:
                where = " OR ".join(
                    f"UPPER(NAICSDescription) LIKE '%{kw}%' OR UPPER(NAICSSector) LIKE '%{kw}%' OR UPPER(BusinessName) LIKE '%{kw}%'"
                    for kw in sector_keywords
                )
                rows = await _query_rows(client, endpoint, where, _DIRECTORY_OUT_FIELDS)
                total_sector_count = await _query_count(client, endpoint, where)

            hubs = await _query_commercial_hubs(client, is_food_sector, not is_custom_endpoint, geography)

            if not rows:
                return {
                    "status": "not_found",
                    "matched_count": 0,
                    "total_sector_count": None,
                    "exact_match": False,
                    "context_snippet": "\n\n".join(hubs["summaries"]),
                    "citations": hubs["citations"],
                }

            def _format_row(i: int, r: dict) -> str:
                area = r.get("CHArea") or (f"Ward {r['Ward']}" if r.get("Ward") else "Mississauga")
                address = f" ({r['StreetAddress']})" if r.get("StreetAddress") else ""
                return (
                    f"{i + 1}. {r.get('BusinessName')} | NAICS {r.get('NAICSCode') or 'N/A'}: "
                    f"{r.get('NAICSDescription') or r.get('NAICSSector') or 'Commercial'} | "
                    f"{area}{address} | Size: {r.get('EmplRange') or 'N/A'}"
                )

            lines = [_format_row(i, r) for i, r in enumerate(rows)]
            header = (
                f"MISSISSAUGA 2025 BUSINESS DIRECTORY EXACT MATCHES ({len(rows)} records):"
                if exact_match else
                f"TRADE NAME {business_name or idea or ''!r} WAS NOT LISTED IN THE 2025 MUNICIPAL SNAPSHOT "
                f"(common for newer entrants, DBAs, online-first operators, or numbered corps). RETRIEVED "
                f"{naics_plan['category_label'].upper()} PEERS ({len(rows)} sampled out of {total_sector_count or len(rows)} registered):"
            )
            where_used = (
                f"UPPER(BusinessName) LIKE '%{clean_name.upper()}%'" if exact_match else
                (naics_plan["exact_where"] or " OR ".join(f"UPPER(NAICSDescription) LIKE '%{kw}%'" for kw in sector_keywords))
            )
            directory_citation = {
                "source_title": (
                    f"2025 Mississauga Business Directory — Exact Match ({len(rows)} record{'s' if len(rows) != 1 else ''})"
                    if exact_match else
                    f"2025 Mississauga Business Directory — {naics_plan['category_label']} ({total_sector_count or len(rows)} peers)"
                ),
                "source_url": _citation_url(endpoint, where_used, _DIRECTORY_OUT_FIELDS),
                "snippet": _format_peer_snippet(exact_match, business_name or idea, rows, len(rows), total_sector_count, naics_plan["category_label"]),
                "similarity": None,
            }
            combined_summary = "\n\n".join(filter(None, [header, "\n".join(lines), *hubs["summaries"]]))

            return {
                "status": "found" if exact_match else "sector_context",
                "matched_count": len(rows),
                "total_sector_count": total_sector_count,
                "exact_match": exact_match,
                "context_snippet": combined_summary,
                "citations": [directory_citation, *hubs["citations"]],
            }
    except Exception:
        logger.exception("mississauga_data.query_directory: unexpected failure -- degrading to not_found.")
        return {
            "status": "not_found",
            "matched_count": 0,
            "total_sector_count": None,
            "exact_match": False,
            "context_snippet": "",
            "citations": [],
        }
