# Train Progress UI Spec

## Stages
1. Ideating - parse idea, extract industry/geography/customer
2. Researching - RAG retrieval, live source counter
3. Prototyping - map data into frameworks
4. Testing - cross-check claims against sources
5. Finalizing - compile synthesized report

## States per stage
pending -> active (pulsing glow + wheel spin) -> done (checkmark, locked color)

## Micro-copy examples
- Ideating: "Did you know? A clear one-line problem statement predicts pivot success."
- Researching: "47 sources scanned..." / "TAM measures total addressable market."
- Prototyping: "BCG Matrix was created by Bruce Henderson in 1970."
- Testing: "Cross-checking every claim against its original source."
- Finalizing: "Structured frameworks improve first-pitch funding odds."

## Motion rules
- Respect prefers-reduced-motion (fallback: plain progress bar with same labels)
- Active stage: spring bounce reveal, glow pulse 1.2-1.8s loop
- Never let progress stall/reverse visually
