# Aurelo UI (evaluation snapshot)

TanStack Start + React UI wired to Groundly analysis:

- Idea-first home screen
- Labeled train compartments (Ideating → Researching → Prototyping → Testing → Finalizing)
- Groundly ReportView matched to `assets/images/report-ux-mock.png` (thin app nav, top framework pills, TAM rings + table)
- Other frameworks get the same structured visual treatment via `src/lib/groundly/hydrate.ts` when the API only returns prose
- Ask AI, citations, share, print
- Analyze / Projects / Insights / Market / Reports / Settings all navigate

This folder is a **preview snapshot** for evaluation. It does not replace `frontend/`.

The live Groundly app still runs from `frontend/`. The idea-first home + idle train preview is also applied there on this branch (`frontend/src/components/HomeScreen.tsx`).

## Run (standalone)

Requires Node 20+. From this directory:

```bash
npm install
npm run dev
```

Set `GROUNDLY_API_URL` (or `VITE_API_BASE_URL`) to your Groundly API if you want live analysis instead of the fallback report.
