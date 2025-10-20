# SAM AI Complete Conversational Flow

**Version**: 2.0  
**Last Updated**: 2025-01-20  
**Status**: ✅ Active with KB-Aware Intelligence

---

## Overview

SAM AI uses an intelligent, adaptive conversational flow that checks the Knowledge Base (KB) completeness **before** asking onboarding questions. This prevents redundant questioning and provides a better user experience for clients who upload comprehensive documentation upfront.

---

## Flow Architecture

```
User Starts Conversation
         ↓
    Auth Check
         ↓
  Get Workspace ID
         ↓
┌─────────────────────────┐
│ CHECK KB COMPLETENESS   │ ← **NEW: KB-Aware Intelligence**
│ /api/knowledge-base/    │
│      completeness       │
└─────────────────────────┘
         ↓
┌─────────────────────────┐
│  KB Analysis Result     │
├─────────────────────────┤
│ • Overall: 85% complete │
│ • Status: "complete"    │
│ • Missing: messaging    │
│ • Sections: detailed    │
└─────────────────────────┘
         ↓
    ┌────────────────┐
    │ Route Decision │
    └────────────────┘
         ↓
    ┌───────┴──────────┬──────────────┬─────────────┐
    │                  │              │             │
KB ≥70%          KB 40-70%       KB <40%      No KB Data
    │                  │              │             │
    ▼                  ▼              ▼             ▼
Campaign         Targeted      Guided         Full
Execution        Gap-Fill    Discovery     Discovery
    │                  │              │             │
    └──────────────────┴──────────────┴─────────────┘
                       ↓
              Generate Response with
              KB Context Injected
                       ↓
              Continue Conversation
```

---

## KB Completeness Check

### API Endpoint
**GET** `/api/knowledge-base/completeness?workspace_id={uuid}`

### Response Format
```json
{
  "success": true,
  "workspace_id": "uuid",
  "completeness": {
    "overall": 85,
    "status": "complete",
    "sections": {
      "overview": { "percentage": 100, "entries": 5, "depth": 85 },
      "icp": { "percentage": 90, "entries": 4, "depth": 75 },
      "products": { "percentage": 100, "entries": 3, "depth": 90 },
      "messaging": { "percentage": 40, "entries": 1, "depth": 30 },
      "success_stories": { "percentage": 80, "entries": 2, "depth": 70 },
      "objections": { "percentage": 60, "entries": 2, "depth": 50 },
      "competition": { "percentage": 100, "entries": 2, "depth": 80 },
      "personas": { "percentage": 75, "entries": 2, "depth": 60 },
      "pricing": { "percentage": 100, "entries": 1, "depth": 85 },
      "tone_of_voice": { "percentage": 100, "entries": 1, "depth": 70 },
      "company_info": { "percentage": 100, "entries": 2, "depth": 75 },
      "buying_process": { "percentage": 50, "entries": 1, "depth": 40 },
      "compliance": { "percentage": 0, "entries": 0, "depth": 0 },
      "success_metrics": { "percentage": 100, "entries": 1, "depth": 80 },
      "documents": { "percentage": 100, "entries": 8, "depth": 0 }
    },
    "missing_critical": [],
    "recommendations": [
      "Your knowledge base is in good shape. Consider filling in the gaps for optimal performance.",
      "Incomplete sections that could use more detail: messaging, objections, buying_process, compliance"
    ]
  },
  "timestamp": "2025-01-20T14:54:47.000Z"
}
```

### Completeness Calculation

#### Section Weights
- **Critical (weight: 3)**: Overview, ICP, Products
- **Important (weight: 2)**: Messaging, Success Stories, Objections, Competition, Personas
- **Valuable (weight: 1)**: Pricing, Tone of Voice, Company Info, Buying Process, Compliance, Success Metrics, Documents

#### Scoring Logic
```typescript
// For each section:
percentage = (entries / minEntries) * 100 (capped at 100%)
depth = (avgContentLength / 500) * 100 (capped at 100%)

// Overall completeness:
weightedScore = Σ(section.percentage × section.weight)
totalWeight = Σ(section.weight × 100)
overallCompleteness = (weightedScore / totalWeight) × 100
```

#### Status Levels
- **`complete`**: ≥70% overall
- **`partial`**: 40-69% overall
- **`minimal`**: <40% overall

---

## Conversational Routes

### Route 1: Extensive KB (≥70% Complete)

**Trigger**: `kbCompleteness.overall >= 70`

**SAM's Approach**:
```
"Hey! I can see you've already built out a solid knowledge base—nice work! 
I have everything I need about your ICP, products, and positioning.

Want me to generate a campaign right now, or should we refine something first?"
```

**Key Behaviors**:
- ✅ Skip all discovery questions
- ✅ Acknowledge existing knowledge
- ✅ Offer immediate campaign generation
- ✅ Reference specific uploaded content when relevant
- ❌ Don't ask about well-documented areas

**Example Conversation**:
```
User: "Hey Sam, I need a campaign"
Sam: "I see you've uploaded detailed ICP docs and product sheets. Looking at 
your target—VP Sales at mid-market SaaS companies. Should I generate an 
outreach sequence now, or want to adjust the targeting first?"

User: "Generate it"
Sam: "On it. LinkedIn or email first?"
```

---

### Route 2: Partial KB (40-70% Complete)

**Trigger**: `40 <= kbCompleteness.overall < 70`

**SAM's Approach**:
```
"I can see you've already documented [complete sections]. Great! 

I'm missing a few details about [incomplete sections]. Let me ask 
5-7 quick questions to fill those gaps, then we'll generate campaigns."
```

**Key Behaviors**:
- ✅ Acknowledge what's already complete
- ✅ Ask **only** targeted questions for gaps
- ✅ Limit to 5-7 questions max
- ✅ Focus on critical missing sections first
- ❌ Don't repeat questions about documented areas

**Example Conversation**:
```
User: "I need help with outreach"
Sam: "I see you've already filled out your ICP and products—nice! I'm 
missing a few details about your messaging approach and objection handling.

Quick question: What's your main value prop in one sentence?"

User: "We help teams automate lead gen with AI"
Sam: "Perfect. What's the most common objection you hear?"

User: "Too expensive"
Sam: "Got it. How do you typically handle that?"

User: "We show ROI in 60 days"
Sam: "Awesome. That's all I need. Ready to generate a campaign?"
```

**Target Question Count by Missing Sections**:
- Missing 1-2 critical sections: 3-5 questions
- Missing 3+ critical sections: 5-7 questions
- Missing only non-critical sections: 2-3 questions

---

### Route 3: Minimal KB (<40% Complete)

**Trigger**: `kbCompleteness.overall < 40`

**SAM's Approach**:
```
"Hey! I'm Sam, your AI sales partner. I help build campaigns, but first I 
need to learn about your business. Takes about 15-20 minutes.

[If any sections ARE filled]: I see you've already uploaded [sections]. 
Great start! I'll use that and just fill in the gaps.

What's your name?"
```

**Key Behaviors**:
- ✅ Do guided discovery (full onboarding)
- ✅ **Still** reference any existing knowledge to save time
- ✅ Skip questions about documented areas
- ✅ Validate understanding with user

**Example Conversation**:
```
User: "I need leads"
Sam: "I can help! But first, quick intro—what's your name?"

User: "John"
Sam: "Hey John! Tell me about your company. What do you do?"

[If KB has company_info at 50%]:
Sam: "Hey John! I see you've uploaded some company info already. You're 
in SaaS, right? Just need a few more details to get started."
```

---

### Route 4: No KB Data

**Trigger**: `kbCompleteness === null` (new workspace or API failure)

**SAM's Approach**:
```
"Hey! I'm Sam.

I'm part of a team of AI agents that handle your entire GTM process—finding 
leads, writing campaigns, following up with prospects, all of it.

My job? Get to know your business through conversation. I ask questions, you 
answer naturally, and that powers everything else.

Takes about 25 minutes today. After that, you can generate campaigns in 60 
seconds whenever you need them.

Sound interesting?"
```

**Key Behaviors**:
- ✅ Full onboarding from scratch
- ✅ Use conversational discovery flow
- ❌ No KB references (nothing to reference)

---

## System Prompt Injection

### KB Completeness Context

When `kbCompleteness` is available, SAM's system prompt includes:

```
KNOWLEDGE BASE AWARENESS
🎯 **CURRENT KB STATUS: 85% complete (complete)**

**Sections Already Filled:**
- overview: 100% (5 entries)
- icp: 90% (4 entries)
- products: 100% (3 entries)
- competition: 100% (2 entries)
- pricing: 100% (1 entries)
- tone_of_voice: 100% (1 entries)
- company_info: 100% (2 entries)
- success_metrics: 100% (1 entries)
- documents: 100% (8 entries)

**CRITICAL INSTRUCTIONS:**
- ✅ DO acknowledge existing knowledge: "I see you've already filled out [section]. Great!"
- ✅ DO reference uploaded content when relevant to conversation
- ✅ SKIP onboarding questions for sections >70% complete
- ✅ ONLY ask targeted questions to fill specific gaps in incomplete sections (<70%)
- ❌ DON'T ask redundant questions about well-documented areas
- ❌ DON'T start from scratch with discovery if KB is >70% complete overall

**Missing/Incomplete Sections:**
- messaging: 40% (needs 2 more entries)
- objections: 60% (needs 1 more entries)
- buying_process: 50% (needs 1 more entries)
- compliance: 0% (needs 1 more entries)

**Conversation Strategy:**
- User has extensive KB. Focus on campaign execution, not discovery. 
  Validate they want to generate campaigns immediately.
```

---

## KB Section Mapping

### 15 KB Sections Tracked

| Section | Category | Weight | Min Entries | Description |
|---------|----------|--------|-------------|-------------|
| **overview** | business-model | 3 | 2 | Company basics, mission, value prop |
| **icp** | icp-intelligence | 3 | 3 | Ideal customer profiles, targeting |
| **products** | products | 3 | 2 | Product/service offerings |
| **messaging** | messaging | 2 | 3 | Core messaging, value props |
| **success_stories** | case-studies | 2 | 2 | Customer success stories, results |
| **objections** | objection-handling | 2 | 3 | Common objections & responses |
| **competition** | competitive-intelligence | 2 | 2 | Competitor analysis, positioning |
| **personas** | personas | 2 | 2 | Buyer personas, decision-makers |
| **pricing** | pricing | 1 | 1 | Pricing model, value communication |
| **tone_of_voice** | tone-of-voice | 1 | 1 | Brand voice, communication style |
| **company_info** | company-info | 1 | 1 | Team, culture, founding story |
| **buying_process** | sales-process | 1 | 1 | Sales stages, decision process |
| **compliance** | compliance | 1 | 1 | Regulatory requirements, disclaimers |
| **success_metrics** | success-metrics | 1 | 1 | KPIs, ROI metrics, benchmarks |
| **documents** | documents | 1 | 0 | Uploaded supporting materials |

---

## Discovery Flow (When Needed)

### Stage 1: Introduction & Company Basics
**When**: KB overall <70%  
**Skip if**: `overview >= 70%`

```
Sam: "What's your name?"
User: "John"

Sam: "Hey John! Tell me about your company. What do you do and who do you serve?"
User: "We help SaaS companies automate lead generation"

Sam: "Got it. What's your company size and industry?"
User: "15 people, B2B SaaS"
```

---

### Stage 2: ICP Definition
**When**: KB overall <70%  
**Skip if**: `icp >= 70%`

```
Sam: "Who's your ideal customer? What type of companies do you work with?"
User: "Mid-market SaaS companies, 50-500 employees"

Sam: "What job titles do you usually sell to?"
User: "VP Sales, CROs"

Sam: "Which industries have you seen the most success in?"
User: "Fintech, healthcare tech"
```

---

### Stage 3: Products & Offerings
**When**: KB overall <70%  
**Skip if**: `products >= 70%`

```
Sam: "Walk me through your main products or services."
User: "We have a lead gen platform with AI personalization"

Sam: "What makes it unique vs. competitors?"
User: "Our AI writes personalized messages based on LinkedIn + website data"
```

---

### Stage 4: Messaging & Positioning
**When**: KB overall <70% OR `messaging < 70%`

```
Sam: "What's your elevator pitch—how do you describe what you do in 30 seconds?"
User: "We help B2B sales teams generate qualified leads 10x faster using AI"

Sam: "What's your top 3 value props?"
User: "Save time, better personalization, higher response rates"
```

---

### Stage 5: Competition & Objections
**When**: KB overall <40% OR `competition < 70%` OR `objections < 70%`

```
Sam: "Who are your main competitors?"
User: "Apollo, Sales Navigator, Outreach"

Sam: "What's the most common objection you hear?"
User: "Too expensive"

Sam: "How do you typically handle that?"
User: "We show ROI in first 60 days—3x pipeline increase"
```

---

### Stage 6: Campaign Generation
**When**: Critical sections ≥70% OR user explicitly requests campaign

```
Sam: "Perfect! I have what I need. Ready to generate a campaign?"
User: "Yes"

Sam: "Great! Who should I target? (job title, location, industry)"
User: "VP Sales in New York, fintech companies"

Sam: "Campaign name?"
User: "Fintech VP Outreach Q1"

Sam: "#trigger-search 
{
  \"job_title\": \"VP Sales\",
  \"location\": \"New York\",
  \"industry\": \"fintech\",
  \"campaign_name\": \"Fintech VP Outreach Q1\"
}"
```

---

## Question-Skipping Logic

### Decision Tree

```
┌─────────────────────────────┐
│ User asks question or       │
│ SAM needs to ask question   │
└─────────────────────────────┘
            ↓
    ┌───────────────┐
    │ Check KB      │
    │ completeness  │
    └───────────────┘
            ↓
   ┌────────┴────────┐
   │                 │
Section ≥70%    Section <70%
   │                 │
   ▼                 ▼
Skip &          Ask Question
Acknowledge     (Targeted)
   │                 │
   └────────┬────────┘
            ↓
      Continue Flow
```

### Example: Skipping Product Questions

**Scenario**: User has `products: 100% (3 entries, depth: 90)`

```
❌ Don't Ask:
- "Walk me through your main products"
- "What makes your product unique?"
- "What are the key features?"

✅ Do Instead:
- "I see you offer [product name from KB]. Should we generate campaigns for all 
  products or focus on one?"
- "Looking at your product docs, I'm seeing [feature]. Is that the main hook 
  for this campaign?"
```

---

## Implementation Details

### Code Integration Points

1. **Completeness Check**: `app/api/knowledge-base/completeness/route.ts`
2. **Helper Function**: `lib/supabase-knowledge.ts::checkKBCompleteness()`
3. **Chat Integration**: `app/api/sam/threads/[threadId]/messages/route.ts` (lines 1017-1037)
4. **System Prompt Injection**: Same file (lines 1120-1153)

### Performance Optimization

- KB completeness check runs **once per conversation start**
- Results cached in system prompt context
- Doesn't slow down individual message responses
- Fallback gracefully if API fails (proceeds with normal flow)

---

## User Experience Improvements

### Before (Without KB Awareness)
```
User: [Uploads 50-page pitch deck with detailed ICP, products, messaging]
Sam: "Hey! Tell me about your company. What do you do?"
User: "Ugh... it's all in the deck I just uploaded"
Sam: "Great! What's your ICP?"
User: "ALSO IN THE DECK"
```

### After (With KB Awareness)
```
User: [Uploads 50-page pitch deck with detailed ICP, products, messaging]
Sam: "I see you've uploaded comprehensive docs about your company, ICP, and 
products. I have everything I need! 

Want to generate a campaign now, or should we refine something first?"
User: "Generate campaign"
Sam: "On it. Who should I target?"
```

---

## Edge Cases

### Case 1: Partial Document Upload
**Scenario**: User uploads only product sheet (no ICP or messaging)

```
products: 100%
icp: 0%
messaging: 0%
Overall: 28%
```

**SAM's Response**:
```
"I see you've uploaded product details—great! I'm missing info about your 
ideal customer and messaging approach. Let me ask a few questions about those, 
then we can generate campaigns."
```

---

### Case 2: Document Upload Mid-Conversation
**Scenario**: User starts discovery, then uploads docs halfway through

**Behavior**:
- KB completeness recalculated on next message
- SAM acknowledges new uploads
- Skips remaining questions for newly-filled sections

```
Sam: "What's your pricing model?"
User: [Uploads pricing sheet]
Sam: "Got the pricing doc! I see it's $99-499/month based on seats. Perfect. 
Next—what's your main competitor?"
```

---

### Case 3: KB Check Fails
**Scenario**: API error or workspace not found

**Fallback**:
```typescript
kbCompleteness = null
// Proceeds with normal discovery flow
// No error shown to user
```

---

## Analytics & Monitoring

### Metrics to Track

1. **KB Completeness Distribution**
   - % of workspaces at each completeness level
   - Average time to reach 70% complete

2. **Question Skip Rate**
   - % of discovery questions skipped
   - Most commonly skipped sections

3. **Time to Campaign**
   - With KB ≥70%: Target <2 minutes
   - With KB 40-70%: Target <5 minutes
   - With KB <40%: Target <15 minutes

4. **User Satisfaction**
   - Feedback on "redundant questions"
   - Campaign quality vs. KB completeness correlation

---

## Future Enhancements

### Phase 2: Smart Document Intelligence
- Auto-detect document type on upload
- Extract structured data without user prompts
- Pre-populate KB sections automatically

### Phase 3: Continuous Learning
- Track which sections correlate with campaign success
- Suggest specific missing knowledge for better results
- Adaptive question prioritization

### Phase 4: Multi-User Knowledge
- Team members contribute to shared KB
- Role-based KB editing permissions
- Version control and change tracking

---

## Testing Scenarios

### Test Case 1: New User, No KB
```
Workspace: Empty (0% complete)
Expected: Full discovery flow (15-20 questions)
```

### Test Case 2: User with Comprehensive KB
```
Workspace: 90% complete (all critical sections filled)
Expected: Immediate campaign generation offer (0 discovery questions)
```

### Test Case 3: User with Partial KB
```
Workspace: 55% complete (ICP + products filled, messaging missing)
Expected: 3-5 targeted questions about messaging only
```

### Test Case 4: API Failure
```
KB completeness check fails
Expected: Graceful fallback to normal flow, no user-facing error
```

---

## Conclusion

This KB-aware conversational flow dramatically improves user experience by:

✅ Eliminating redundant questions  
✅ Respecting uploaded documentation  
✅ Accelerating time-to-campaign  
✅ Maintaining conversation quality  
✅ Providing intelligent, context-aware responses  

The system is now **production-ready** and actively running in the chat route.

---

**Document Version**: 2.0  
**Implementation Status**: ✅ Complete  
**Last Tested**: 2025-01-20
