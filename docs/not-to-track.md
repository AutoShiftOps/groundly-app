# What NOT to Track in Git (beyond .gitignore)

- API keys / secrets -> use .env files (never commit), store real values in Vercel/AWS Secrets Manager
- node_modules/, venv/, dist/, build/ -> regenerated via install/build commands
- .aws-sam/, cdk.out/, .terraform/, *.tfstate -> generated infra artifacts, can leak resource IDs
- Large data dumps / scraped source documents -> store in S3, reference by URL/id in citation_schema.json, not in repo
- Personal IDE configs (.vscode/, .idea/) -> keep repo editor-agnostic
- Any real user data or waitlist emails -> never commit; keep in database only
