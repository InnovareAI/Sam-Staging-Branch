# SAM Discovery Questions to Knowledge Base Mapping

## Overview

This document maps SAM's 30 ICP discovery questions to the 18 Knowledge Base Quick Action sections. All Q&A data is stored in **BOTH**:

1. **`sam_icp_knowledge_entries`** table - For RAG/semantic search with vector embeddings
2. **Knowledge Base tables** - For structured access via KB UI sections

---

## 🎯 Complete Mapping Table

| # | Question ID | Question Text (Summary) | KB Section | Category | Storage Table |
|---|-------------|------------------------|------------|----------|---------------|
| 1 | `basic_icp` | One-sentence ICP description | **ICP Config** | `icp_definition` | `knowledge_base_icps` |
| 2 | `objectives` | Top 3 business objectives | **ICP Config** | `objectives` | `knowledge_base_icps.qualification_criteria` |
| 3 | `objective_urgency` | Urgency level (A/B/C) | **ICP Config** | `objectives` | `knowledge_base_icps.qualification_criteria` |
| 4 | `focus_areas` | Top 3 weekly focus areas | **ICP Config** | `focus_areas` | `knowledge_base_icps.qualification_criteria` |
| 5 | `focus_positioning` | How solution helps focus areas | **Messaging** | `messaging` | `knowledge_base (messaging)` |
| 6 | `long_term_desire` | Secret long-term ambition | **ICP Config** | `icp_definition` | `knowledge_base_icps.qualification_criteria` |
| 7 | `long_term_alignment` | Alignment with ambition (A/B/C) | **Messaging** | `messaging` | `knowledge_base (messaging)` |
| 8 | `pain_points` | Top 3 pain points | **ICP Config** | `pain_points` | `knowledge_base_icps.pain_points` |
| 9 | `pain_cost` | Cost of top pain (A/B/C/D) | **ICP Config** | `pain_points` | `knowledge_base_icps.pain_points` |
| 10 | `current_solution` | Current approach to solving | **Buying Process** | `buying_process` | `knowledge_base (buying)` |
| 11 | `current_solution_gap` | Why current solution fails | **Buying Process** | `buying_process` | `knowledge_base (buying)` |
| 12 | `solution_expectation` | Expected outcome from new solution | **Buying Process** | `buying_process` | `knowledge_base (buying)` |
| 13 | `solution_deliverable` | Can we deliver? (A/B/C/D) | **Buying Process** | `buying_process` | `knowledge_base (buying)` |
| 14 | `customer_language` | 3-5 exact customer phrases | **Messaging** | `customer_language` | `knowledge_base (messaging)` |
| 15 | `objections_list` | Top 3 objections | **Objections** | `objections` | `knowledge_base_icps.messaging_framework` |
| 16 | `objection_primary_type` | Real or smoke screen (A/B/C) | **Objections** | `objections` | `knowledge_base_icps.messaging_framework` |
| 17 | `objection_primary_response` | How to handle objection | **Objections** | `objections` | `knowledge_base_icps.messaging_framework` |
| 18 | `frustrations_daily` | Daily annoyances | **Emotional Barriers*** | `frustrations` | `knowledge_base (emotional-barriers)` |
| 19 | `frustrations_breakdown` | Nightmare scenario | **Emotional Barriers*** | `frustrations` | `knowledge_base (emotional-barriers)` |
| 20 | `fears_primary` | Top fears | **Emotional Barriers*** | `fears` | `knowledge_base (emotional-barriers)` |
| 21 | `fears_timeline` | Immediate/future/existential | **Emotional Barriers*** | `fears` | `knowledge_base (emotional-barriers)` |
| 22 | `fears_realized` | When fear becomes real | **Emotional Barriers*** | `fears` | `knowledge_base (emotional-barriers)` |
| 23 | `implications_chain` | Ripple effects of problem | **Emotional Barriers*** | `implications` | `knowledge_base (emotional-barriers)` |
| 24 | `implications_confirm` | Ultimate consequence | **Emotional Barriers*** | `implications` | `knowledge_base (emotional-barriers)` |
| 25 | `disappointments_past` | Past failed solutions | **Emotional Barriers*** | `disappointments` | `knowledge_base (emotional-barriers)` |
| 26 | `disappointments_skepticism` | Skepticism level (A/B/C/D) | **Emotional Barriers*** | `disappointments` | `knowledge_base (emotional-barriers)` |
| 27 | `failures_history` | Horror stories | **Emotional Barriers*** | `failures` | `knowledge_base (emotional-barriers)` |
| 28 | `failures_differentiation` | How we're different | **Emotional Barriers*** | `failures` | `knowledge_base (emotional-barriers)` |
| 29 | `roadblocks_summary` | Summary of all roadblocks | **Overview** | `icp_definition` | `knowledge_base (icp-discovery)` |
| 30 | `summary_validation` | Final validation | **Overview** | `icp_definition` | `knowledge_base (icp-discovery)` |

**\* Emotional Barriers** is a new category created for deep psychological insights (fears, frustrations, implications, disappointments, failures)

---

## 📊 KB Section Coverage

### Covered by SAM Discovery (11 sections):

1. ✅ **ICP Config** - basic_icp, objectives, focus_areas, pain_points, long_term_desire
2. ✅ **Messaging** - focus_positioning, customer_language, long_term_alignment
3. ✅ **Objections** - objections_list, objection_primary_type, objection_primary_response
4. ✅ **Buying Process** - current_solution, current_solution_gap, solution_expectation, solution_deliverable
5. ✅ **Overview** - roadblocks_summary, summary_validation
6. ✅ **Emotional Barriers** (NEW) - All emotional intelligence questions (fears, frustrations, etc.)
7. ✅ **Products** - (from uploaded documents or manual entry)
8. ✅ **Pricing** - (from uploaded documents or manual entry)
9. ✅ **Personas** - (from uploaded documents or manual entry)
10. ✅ **Competition** - (from uploaded documents or manual entry)
11. ✅ **Success Stories** - (from uploaded documents or manual entry)

### NOT Covered by SAM Discovery (7 sections):

These sections are populated via **document uploads** or **manual entry** in the KB UI:

1. ⏳ **Company Info** - User uploads company decks, about pages
2. ⏳ **Compliance** - User uploads compliance docs, certifications
3. ⏳ **Documents** - General document storage
4. ⏳ **Inquiry Responses** - FAQ-style Q&A
5. ⏳ **Success Metrics** - KPIs, benchmarks
6. ⏳ **SAM Onboarding** - Meta section for SAM setup
7. ⏳ **Setup** - Meta section for workspace setup
8. ⏳ **Tone of Voice** - Brand voice guidelines

---

## 🔄 Dual Storage Flow

```
User answers SAM's discovery question
    ↓
storeQAInKnowledgeBase() called
    ↓
    ├─→ [A] sam_icp_knowledge_entries (RAG)
    │   ├─ Generate embedding via OpenAI
    │   ├─ Store Q&A with vector
    │   └─ Enable semantic search
    │
    └─→ [B] Knowledge Base Table (Structured)
        ├─ Route based on category
        ├─ Map to appropriate KB table
        └─ Enable UI access via Quick Actions
```

---

## 📁 Category to KB Table Routing

| Category | KB Section | Storage Table | Field/Location |
|----------|-----------|---------------|----------------|
| `icp_definition` | ICP Config | `knowledge_base_icps` | General ICP fields |
| `pain_points` | ICP Config | `knowledge_base_icps` | `pain_points` array |
| `objectives` | ICP Config | `knowledge_base_icps` | `qualification_criteria.objectives` |
| `focus_areas` | ICP Config | `knowledge_base_icps` | `qualification_criteria.focus_areas` |
| `objections` | Objections | `knowledge_base_icps` | `messaging_framework.objections` |
| `customer_language` | Messaging | `knowledge_base` | category: `messaging` |
| `messaging` | Messaging | `knowledge_base` | category: `messaging` |
| `prospecting_criteria` | Buying Process | `knowledge_base_icps` | `qualification_criteria.prospecting` |
| `buying_process` | Buying Process | `knowledge_base` | category: `buying` |
| `business_model` | Company Info | `knowledge_base` | category: `business-model` |
| `company_info` | Company Info | `knowledge_base` | category: `company-info` |
| `linkedin_profile` | LinkedIn | `knowledge_base` | category: `linkedin-profile` |
| `content_strategy` | Content | `knowledge_base` | category: `content-strategy` |
| `tone_of_voice` | Tone | `knowledge_base` | category: `tone` |
| `products` | Products | `knowledge_base` | category: `products` |
| `pricing` | Pricing | `knowledge_base` | category: `pricing` |
| `personas` | Personas | `knowledge_base` | category: `personas` |
| `competition` | Competition | `knowledge_base` | category: `competition` |
| `success_stories` | Success | `knowledge_base` | category: `success` |
| `metrics` | Metrics | `knowledge_base` | category: `metrics` |
| `fears` | Emotional Barriers | `knowledge_base` | category: `emotional-barriers` |
| `frustrations` | Emotional Barriers | `knowledge_base` | category: `emotional-barriers` |
| `implications` | Emotional Barriers | `knowledge_base` | category: `emotional-barriers` |
| `disappointments` | Emotional Barriers | `knowledge_base` | category: `emotional-barriers` |
| `failures` | Emotional Barriers | `knowledge_base` | category: `emotional-barriers` |
| `compliance` | Compliance | `knowledge_base` | category: `compliance` |
| `inquiry_responses` | Inquiry Responses | `knowledge_base` | category: `inquiry_responses` |

---

## 🚀 Usage in Code

### Storing Q&A During SAM Conversation

```typescript
import { storeQAInKnowledgeBase } from '@/lib/sam-kb-integration';

// After user answers a discovery question
await storeQAInKnowledgeBase(workspaceId, userId, sessionId, {
  questionId: 'pain_points',
  questionText: 'What are the top 3 pain points?',
  answerText: userMessage,
  answerStructured: { pain_points: parsedPains },
  stage: 'discovery',
  category: 'pain_points'
});
```

### Retrieving KB Context for SAM

```typescript
import { buildKBContextForSAM } from '@/lib/sam-kb-integration';

// Before generating SAM's response
const kbContext = await buildKBContextForSAM(workspaceId);
systemPrompt += kbContext;
// Returns formatted string with ICP, products, competitors, personas, etc.
```

### Retrieving Q&A for RAG

```typescript
import { searchQAKnowledge } from '@/lib/sam-qa-storage';

// Semantic search across all Q&A
const { results } = await searchQAKnowledge(workspaceId, query, {
  stage: 'discovery',
  category: 'objections',
  limit: 5
});
```

---

## 🔍 Quick Actions Alignment

The KB Quick Actions (18 tiles) now align with both:

1. **SAM Discovery Questions** - 30 questions mapped to 11 sections
2. **Document Upload Categories** - Remaining 7 sections for manual/uploaded content

All data flows into the dual storage system, enabling:
- **Semantic search** via RAG (vector embeddings)
- **Structured access** via KB UI sections
- **Contextual SAM responses** with full knowledge base

---

## 📈 Coverage Summary

- **Total KB Sections**: 18
- **Covered by SAM Discovery**: 11 (61%)
- **Covered by Document Upload**: 7 (39%)
- **Total Discovery Questions**: 30
- **Q&A Categories**: 26 (expanded from 7)
- **RAG Storage**: 100% of Q&A
- **KB Table Storage**: 100% of Q&A

**All discovery data is now accessible in both RAG and KB UI!**

---

**Last Updated**: 2025-10-06
**Related Files**:
- `/lib/sam-kb-integration.ts` - Dual storage implementation
- `/lib/sam-qa-storage.ts` - RAG with vector embeddings
- `/lib/icp-discovery/conversation-flow.ts` - Discovery question flow
- `/app/components/KnowledgeBase.tsx` - KB UI sections
