# Aurelo UI integration (`feature/aurelo-ui`)

This branch keeps Groundly’s working analysis contract and report:

- `POST /api/analyze` — 10 frameworks + citations + business metrics
- `POST /api/ask` — Ask AI over the current report (no new retrieval)
- Share-via-URL-hash (`frontend/src/lib/reportLink.js`)
- Full `ReportView` (overview, TAM diagram, citations, print/PDF)

What changed for evaluation:

- **Home** is now an idea-first compose screen (samples, character count, idle train).
- **Loading** still uses the neon train-car `TrainScene` driven by real stage index.
- **Report** is unchanged functionally — same Groundly response shape.

The live Grok preview app also calls `https://groundly-api.onrender.com` first, then falls back to a local/Grok-shaped report if Render is cold, so the UI can be demoed without waiting on a sleeping API.
