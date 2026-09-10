# Aurelo UI (evaluation snapshot)

TanStack Start + React UI built to match the Aurelo train-car mock, wired to Groundly analysis:

- Idea-first home screen
- Labeled train compartments (Ideating → Researching → Prototyping → Testing → Finalizing)
- Groundly ReportView (10 frameworks, Ask AI, citations, share)
- Analyze API with live backend + fallback

This folder is a **preview snapshot** for evaluation. It does not replace `frontend/`.

The live Groundly app still runs from `frontend/`. The idea-first home + idle train preview is also applied there on this branch (`frontend/src/components/HomeScreen.tsx`).

## Run (standalone)

Requires Node 20+. From this directory:

```bash
npm install
npm run dev
```

Set `GROUNDLY_API_URL` (or `VITE_API_BASE_URL`) to your Groundly API if you want live analysis instead of the fallback report.
