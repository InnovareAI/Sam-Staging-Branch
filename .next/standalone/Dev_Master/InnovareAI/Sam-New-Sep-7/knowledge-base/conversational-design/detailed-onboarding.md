# Detailed Onboarding Flow (7-Stage)
Version: v4.4 | Last Updated: 2025-09-09

## Purpose
This document provides the **detailed 7‑stage onboarding flow** for SAM, including lead questions, variants, must‑have vs nice‑to‑have fields, probes, example user answers + SAM responses, RAG field mappings, and compliance notes.

---

## Global Principles
- **Microbursts:** 1–2 sentences + one question. Never stack multiple questions.  
- **Acknowledgment:** Always reflect the user's answer before moving on.  
- **Skip-friendly:** User can say "Skip" → SAM records a gap and continues.  
- **Repair:** If user frustrated, switch to Product Q&A Mode.  
- **Compliance:** If regulated vertical (Legal, Finance, Pharma) → HITL Strict enabled.

---

## Stage 1: Business Context
### Lead Questions (variants)
- "What industry are you in, and what does your company do?"
- "Give me a one‑liner on your business so I can tailor everything."

### MUST_HAVE
- Industry / sector  
- Business model (B2B / B2C / hybrid)  
- Company size (employees, rough revenue)  
- Sales team structure (founder‑led, SDR team, AE/CSM handoffs)  
- Primary sales bottleneck

### NICE_TO_HAVE (2025)
- "Are you positioning yourself as AI‑enabled or AI‑native?"  
- "Has AI changed how your industry delivers value?"  

### Example Flow
- **User:** "We're a SaaS for HR, ~40 employees."  
- **SAM:** "Got it—HR SaaS, ~40 people. Who's handling outbound now, founder or SDRs?"  

---

## Stage 2: ICP Definition
### Lead Questions (variants)
- "Who's your perfect customer—industry, size, role, geography?"
- "Which clients would you clone if you could?"

### MUST_HAVE
- Target industries  
- Company size bands  
- Decision‑maker roles/titles  
- Geography / regions  
- Top 3–5 pain points  

### NICE_TO_HAVE (2025)
- Buyer AI adoption in procurement/research  
- Buyer channels (LinkedIn, Slack, events)  
- Excluded/avoid segments (compliance/geography)  

### Probes
- "You listed 10 industries—can you prioritize the **top 3**?"  
- "You said global; do you want **primary vs secondary** regions?"  

### Example Flow
- **User:** "Best are 200–500 employee SaaS in US, CTO buyer."  
- **SAM:** "Crystal clear. Do you avoid early‑stage or enterprise?"  

---

## Stage 3: Competitive Intelligence
### Lead Question
- "When prospects evaluate you, who else do they compare you against?"

### MUST_HAVE
- Top competitors (3–5)  
- Differentiators / unfair advantage  
- Win/loss insights  

### NICE_TO_HAVE (2025)
- "Are competitors branding as AI‑powered?"  
- "Where are you catching up vs where can you leapfrog?"  

### Example Flow
- **User:** "We compete with Workday & Gusto."  
- **SAM:** "Got it—Workday, Gusto. Where do you reliably win against them?"  

---

## Stage 4: Sales Process
### Lead Question
- "Walk me through your sales process—from first touch to close."

### MUST_HAVE
- Channels in use (email, LinkedIn, phone, events)  
- Outbound/inbound split  
- Average sales cycle length  
- Common bottlenecks  

### NICE_TO_HAVE (2025)
- Channel ROI performance  
- Multi‑channel orchestration usage  

### Example Flow
- **User:** "Outbound email/LinkedIn, ~5 touches, 90‑day cycle."  
- **SAM:** "Thanks. Do deals usually stall pre‑demo or later at procurement?"  

---

## Stage 5: Success Metrics & Value Proposition
### Lead Question
- "What would success look like in the next 90 days?"

### MUST_HAVE
- Baseline metrics (reply %, meetings/month, close %, cycle)  
- Target metrics (reply lift, meeting/bookings, cycle reduction)  
- ROI definition (acceptable CAC, cost‑per‑meeting)  

### NICE_TO_HAVE (2025)
- "What ROI would make AI outreach a no‑brainer?"  
- "If you could 10x one sales activity with AI, what would it be?"  

### Example Flow
- **User:** "Want to double meetings from 15→30/month."  
- **SAM:** "Got it. If replies rise from 3%→8%, does that get you there?"  

### Value Prop Scaffold
For **[target]** who want **[goal]** but struggle with **[barrier]**, our **[offering]** provides **[benefits]**, unlike **[alternatives]**, because **[differentiator]**.

---

## Stage 6: Technical & Compliance
### Lead Question
- "Which tools does your sales team use—CRM, email, LinkedIn tools?"

### MUST_HAVE
- CRM, email platform, enrichment providers  
- Key integrations  
- Compliance frameworks (GDPR, HIPAA, FINRA/SEC)  

### NICE_TO_HAVE (2025)
- "Do you have pre‑approved compliance disclaimers?"  
- "What guardrails (HITL approvals) are required?"  

### Regulated Note
If industry ∈ {Legal, Finance, Pharma} → `HITL=Strict` and compliance pack upload required.

---

## Stage 7: Content, Brand & Story
### Lead Question
- "Do you have sales decks, case studies, or brand guidelines I should use?"

### MUST_HAVE
- Decks, case studies, proof assets  
- Brand voice guidelines (tone, phrases to use/avoid)  
- Founder/company story (WHY)  

### NICE_TO_HAVE (2025)
- Preferred proof assets (ROI calcs, benchmarks)  
- Thought‑leadership cadence (POV posts, webinars)  

### Example Flow
- **User:** "We have one deck + a case study; also regulated with disclaimers."  
- **SAM:** "Perfect—I'll ingest those assets and align to your compliance guardrails."  

---

## Cross‑Cutting Probes
- "What part of your sales process would you never automate—and why?"  
- "How do you see buyer expectations changing in 2 years?"  
- "What concerns do you have about AI in outbound (spam, compliance, tone)?"

---

## Acceptance Criteria
- All **MUST_HAVE fields captured** by stage end.  
- Gaps tracked in `gap_list` with confidence.  
- Regulated flows set `HITL=Strict` and require compliance pack upload.  
- SAM can answer product/pricing questions without derailing onboarding.  
- Recaps occur each stage: "So far I have X, missing Y/Z—continue or pause?"  
- Flow remains microburst‑driven.