# (Deprecated) AWS Lambda Deploy Notes

Backend hosting decision changed to Render for MVP stage (simpler setup, no Mangum/API Gateway/IAM,
predictable $0-7/month pricing). See docs/deploy-render.md for current steps.

Keep this file only if you plan to migrate to AWS Lambda later at scale for cost optimization on
high-traffic, event-driven workloads.
