# TAM-tagged corpus cleanup (2026-11-17)

Follow-up to commit `31fcfc2`'s corpus check, which found 78 (later 93, as
more live TAM runs ingested content) `tam`-tagged rows in `sources` with no
dollar figure or percentage
(`agents.rag_pipeline._chunk_has_numeric_market_figure`). This is a data-only
cleanup of that set: no application code changed.

## What was done

Every no-figure `tam`-tagged row was classified into one of three buckets:

1. **Deleted (24 rows)** -- content unrelated to market sizing at all: farm
   drainage management, musical-instrument lending/rental programs, Canadian
   immigration guides, "HALO stocks" investing content, hot-sauce-subscription
   product pages, a saree-business TikTok video, plus two false-positive
   matches on the literal string "TAM" that have nothing to do with total
   addressable market: FHWA's *Transportation Asset Management* guide, and
   tam-portal.com's research-grant "TAM Portal" (a research management
   system, not a market-sizing site).
2. **Detagged (26 rows)** -- real, on-topic content explaining TAM/SAM/SOM
   *methodology* (adapty.io, ainna.ai, waveup.com, antler.co, creatio.com,
   salesforce.com, seerinteractive.com, revenuecat.com, hustlebadger.com,
   unleashedbypurina.com, and one LinkedIn explainer post). These never carry
   a market-size figure for any specific idea, so they were never going to
   support a tam/sam/som tier -- but they aren't noise either, so
   `framework_tag` was changed from `tam` to `general` instead of deleting
   the rows.
3. **Left untouched (43 rows)** -- real market-size report chunks (catering,
   meal-kit, tax-prep-software, subscription-box, enterprise-search, etc.)
   where the dollar figure lives in a sibling chunk from the same source page
   rather than this particular chunk. These are legitimate market-sizing
   content; the existing per-tier numeric-figure check in
   `agents/rag_pipeline.py` already prevents a TOC/geography-breakdown chunk
   like these from being used as a tier's own citation.

No row that already contained a dollar figure or percentage was touched.

## Counts

| | before | after |
|---|---|---|
| `sources` total | 749 | 725 |
| `sources` tagged `tam` | 192 | 142 |

24 rows deleted, 26 rows retagged `tam` -> `general`.

## Exact SQL run

```sql
DELETE FROM sources WHERE id = ANY(ARRAY[
  'a9c21155-d709-4479-8fcd-17574c450c33', -- bajsblazin.com hot sauce subscription boxes
  'b0c3a4b7-2b94-459c-bb47-ce673902805f', -- blancharddemofarms.org drainage
  'd50db0fd-e689-47ad-9472-152fe3b91412', -- blancharddemofarms.org drainage (dup)
  '097739a5-d48f-4105-8677-3dab4de81122', -- ncsu.edu drainage guidelines
  '5b4cff2c-702b-497f-a62c-0a46e1ec55a3', -- dataintelo.com fine cello market (spam, unrelated)
  'bd0b0055-1962-4354-ba86-39bda00064f4', -- dataintelo.com analog synthesizers market (spam, unrelated)
  '9f2e71cc-2dd6-4a9b-998c-3223d0f7fdca', -- finance.yahoo.com HALO stocks
  '87df8927-0f1e-418f-8299-a97fa1bc0511', -- sawubonacanada.com business immigration
  '31694710-ed83-470d-aa90-a40272802f73', -- canadavisa.com immigration levels plan
  'c16f6275-33bd-4f0e-9aa2-deda5c71e30a', -- canadavisa.com immigration levels plan (dup)
  '1fad4b3c-d319-4e71-81d8-593e1eb371b0', -- youtube.com Canadian immigration strategy video
  'a8c293b8-f6a6-40db-bdc7-5179a960cd44', -- youtube.com Canadian immigration strategy video (dup)
  'cbe3abc1-464d-4e63-a99b-ad8e7ab39366', -- scovilled.com hot sauce subscription box
  'dc269417-2410-4188-85cf-b646136a69f1', -- foodnetwork.com hot sauce subscriptions
  'fd44e42d-205c-4354-828e-0f86d49ed258', -- foodnetwork.com hot sauce subscriptions (dup)
  'bfbdadeb-010a-43ab-a3c4-6e0b983c467e', -- musicnetwork.ie instrument collection
  'ce1c5ca9-42ed-484f-8ca5-a19e4fb87a76', -- maestrofoundation.org instrument lending program
  'ae0cb79e-8ff6-47cb-b768-df11fa4c116a', -- elektronauts.com music-equipment rental marketplace
  '03502c9b-e2eb-4d60-9504-2171f1b48f97', -- fhwa.dot.gov Transportation Asset Management guide [false-positive "TAM"]
  '28d4b1be-fa3c-43f8-94ad-abc2eedb8cef', -- fhwa.dot.gov Transportation Asset Management guide (dup)
  '10281ba4-51a8-472a-829a-6810515ad5f1', -- tiktok.com saree pre-pleating business video
  '26622be7-7449-4be8-8522-592479ed3cc3', -- tam-portal.com RMS About [false-positive "TAM"]
  '4703b561-b0e7-43b1-a913-cda871b2fc61', -- downtownjoshbrown.com HALO investing theme
  'f9fa429a-334f-4c11-805f-8ab4176a9200'  -- evidenceinvestor.com HALO stocks
]::uuid[]);

UPDATE sources SET framework_tag = 'general' WHERE id = ANY(ARRAY[
  '38e7fd8e-cbff-4afa-8461-27854f635962', -- adapty.io
  '0ecb5a5e-0299-4403-937f-15420eb64cec', -- ainna.ai
  'cfeac28e-02a5-4c7d-8622-f28c6ae090fe', -- ainna.ai (dup)
  '05ae9c78-a632-4d52-9b09-8b1c8a977302', -- waveup.com
  '1d839885-4b8f-4865-8b69-b813b91195e6', -- waveup.com (dup)
  '4b17efec-da09-4d48-aa7b-2bf146ab96db', -- waveup.com (dup)
  '4e0af0f3-c88e-461a-bf21-471a3c336829', -- waveup.com (dup)
  '6514f498-57bb-418f-a70a-4fe249e8d0c3', -- waveup.com (dup)
  '7f9cd34f-3a08-4f8f-9cb2-73a8f069a7ee', -- waveup.com (dup)
  'fac885bf-1efe-409a-9778-aaaba77e4a5e', -- waveup.com (dup)
  '07320864-6b55-4680-b6ef-805ae7711935', -- antler.co
  '6bbe466e-ef0c-4154-a594-3d6e569fd8ea', -- antler.co (dup)
  '82f4a671-1764-4fd6-9c26-85de3e409a75', -- antler.co (dup)
  'dbb95fe5-587e-4d4a-b3f4-667f417e0866', -- creatio.com
  'e3439627-a073-4a09-9ce9-e588243734a2', -- creatio.com (dup)
  '1059b05d-035e-4c13-93eb-cfb027dd5acb', -- salesforce.com
  '83ea755e-0eeb-4938-accf-40d60912c416', -- salesforce.com (dup)
  '162d6b27-ee34-455b-bdec-89bb3c6eae1c', -- seerinteractive.com
  '2600a527-aa20-4f4f-ae2d-bfc0612a60d6', -- seerinteractive.com (dup)
  'b79f5fe3-7764-4c5b-8fca-e0fa23e9d88d', -- seerinteractive.com (dup)
  '032a1f06-b117-42ad-bf24-09f7e113d516', -- revenuecat.com
  '7af59028-0350-4750-84a9-e9aa216ffcdb', -- revenuecat.com (dup)
  '38f9e754-603e-46af-80ec-067bb5b5f0be', -- hustlebadger.com
  '6a1cf012-0e38-4656-b115-ec243cd777e9', -- hustlebadger.com (dup)
  '5395b906-97be-43e2-92dc-6cb815753cd4', -- unleashedbypurina.com
  'aa96891d-8990-46ea-8f39-6f04f4d67e78'  -- linkedin.com (Alejandro Cremades TAM/SAM/SOM explainer post)
]::uuid[]);
```

Executed directly against the production corpus on 2026-11-17 via a one-off
script (not checked in); this document is the durable record of what ran.
