# Deploy Frontend to Vercel

## One-time setup
1. Push repo to GitHub.
2. Go to vercel.com -> New Project -> Import your GitHub repo.
3. Set Root Directory to `frontend`.
4. Framework preset: Vite (auto-detected).
5. Build command: `npm run build` | Output dir: `dist`.

## Environment Variables (Vercel dashboard -> Settings -> Environment Variables)
- `VITE_API_BASE_URL` = your backend API Gateway URL
- `VITE_GA4_ID` = your GA4 Measurement ID (G-XXXXXXXXXX)

## Deploy
- Every push to `main` auto-deploys to production.
- Every PR gets a preview deployment URL automatically.

## CLI alternative
```bash
npm i -g vercel
cd frontend
vercel          # preview deploy
vercel --prod   # production deploy
```

## Custom Domain
Vercel dashboard -> Project -> Settings -> Domains -> Add your domain -> update DNS (CNAME/A record as instructed).
