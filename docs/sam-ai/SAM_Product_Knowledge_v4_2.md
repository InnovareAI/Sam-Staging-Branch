# SAM Product Knowledge v4.2 Digest

Authoritative summary of `/Users/tvonlinz/Desktop/Manual Library/SAM_Product_Knowledge_v4_2`. Use this for product Q&A, objection handling, and RAG ingestion.

## Core Value Proposition
- Agentic outreach automation orchestrating nine AI agents from discovery → enrichment → personalization → outreach → analytics.
- Eliminates manual prospecting bottlenecks, improves reply rates, and cuts SDR costs/time-to-pipeline.
- Standard flow: capture ICP context → spin up orchestrated agents → deliver personalized, multi-touch campaigns at scale.

## Pricing Tiers (fixed)
- **$99/mo Starter** – Platform + 2,000 enriched leads.
- **$399/mo Pro** – Adds HITL review + 10,000 leads.
- **$1,999+/mo Enterprise** – Custom orchestration buildout and support.
- Never improvise pricing; cite these numbers unless product team publishes new tiers.

## Differentiation & Messaging Cues
- "Personalized at scale", "Agentic outreach automation", "ROI in weeks, not months." 
- SAM is not "another automation tool": it layers AI-driven ICP discovery, deep personalization, compliance-aware workflows, and campaign orchestration across channels.
- Integrates with Apollo, Bright Data, Apify, Unipile, HubSpot, Salesforce, Supabase.

## Case Study Proof Points
- **SaaS Startup**: 3× demo bookings in 60 days; cost-per-meeting down 45%.
- **FinTech**: 65% ROI lift via multi-touch personalization.
- **Cost comparison**: SDR team ≈ $6.5k/mo and 8–12 weeks to pipeline vs. SAM $399/mo and <2 weeks.
- Use these examples when users want social proof before advancing.

## Objection Handling Highlights
1. **"We already use Apollo/Sales Navigator."** → SAM sits on top, orchestrates qualification, personalization, and follow-ups automatically.
2. **"We’ll just hire SDRs."** → SDR ramp averages 90 days; SAM produces pipeline in <14 days at ~1/10 the cost.
3. **"Will prospects know it’s AI?"** → Contextual personalization + HITL oversight keeps messaging human grade.

## Product Knowledge RAG Integration (v4.3 Guide)
- Maintain slices: `features`, `pricing`, `agents`, `compliance`, `verticals` with confidence + provenance + last-updated.
- Retrieval: product intent → pull product slices (topK≈3, confidence ≥0.7); onboarding intent → use discovery slices.
- Guardrails: never fabricate pricing; regulated industries default to HITL for compliance claims; surface provenance in responses.

## Enablement Hooks
- Messaging playbook copies emphasize orchestration narrative, not automation commodity.
- Demo script walks through rapid onboarding, agent orchestration, ROI milestones, and compliance safeguards.
- ROI calculator and case study snippets provide quantitative backup—lean on them when negotiating budget or timeline.

## Usage Guidance for SAM
- When the user diverts into product questions mid-discovery, switch into Product Knowledge mode, answer with these facts (and RAG slices), then offer to resume the 7-stage onboarding.
- Reinforce differentiators and proof points before transitioning back to consultative questioning.
- Capture any new product insights or requests in knowledge logging for future ingestion.
