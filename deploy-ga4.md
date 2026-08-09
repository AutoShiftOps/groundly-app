# Google Analytics 4 Setup

## 1. Create GA4 Property
1. Go to analytics.google.com -> Admin -> Create Property.
2. Name it (e.g., "Groundly Web").
3. Set timezone/currency, complete business details.
4. Create a Web Data Stream -> enter your Vercel production URL.
5. Copy the Measurement ID (format: G-XXXXXXXXXX).

## 2. Add to Project
- Add `VITE_GA4_ID=G-XXXXXXXXXX` to `frontend/.env.local` (local) and Vercel env vars (production).
- `react-ga4` is already wired in `frontend/src/lib/ga4.js`.

## 3. Initialize in App Entry
In `frontend/src/main.jsx`:
```js
import { initGA4, trackPageview } from "./lib/ga4";
initGA4();
trackPageview(window.location.pathname);
```

## 4. Track Key Events
Recommended events to fire via `trackEvent(name, params)`:
- `waitlist_signup`
- `analysis_launched`
- `report_completed`
- `upgrade_clicked`
- `report_shared`

## 5. Verify
GA4 -> Reports -> Realtime -> confirm events appear after deploying and testing on production URL.
