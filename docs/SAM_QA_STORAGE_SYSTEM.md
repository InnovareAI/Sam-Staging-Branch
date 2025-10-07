# SAM Q&A Storage System - Complete Implementation

## Overview

This document describes the complete Q&A storage and RAG integration system for SAM AI, enabling SAM to reference past answers when asking clarifying questions or setting up campaigns.

---

## ✅ What Was Built

### 1. Database Schema

**Tables Created:**
- ✅ `sam_conversation_attachments` - Document upload system (PDFs, images, etc.)
- ✅ `sam_icp_knowledge_entries` - Q&A storage with vector embeddings for RAG

**Tables Enhanced:**
- ✅ `sam_icp_discovery_sessions` - Added fields for Q&A, industry context, prospecting criteria

**Functions Created:**
- ✅ `search_icp_knowledge()` - Semantic search across stored Q&A
- ✅ `get_discovery_qa_history()` - Get complete Q&A history for a session
- ✅ `get_prospecting_criteria()` - Get prospecting Q&A for campaigns

### 2. API Endpoints

- ✅ `POST /api/sam/upload-document` - Upload PDF, extract text, store in database
- ✅ `GET /api/sam/upload-document?id={id}` - Retrieve attachment with signed URL
- ✅ `DELETE /api/sam/upload-document?id={id}` - Delete attachment

### 3. TypeScript Modules

- ✅ `/lib/sam-qa-storage.ts` - Complete Q&A storage and RAG query functions
- ✅ Helper functions for embedding generation, context building, knowledge summaries

### 4. Storage Infrastructure

- ✅ Supabase Storage bucket: `sam-attachments` (10MB limit, private)
- ✅ Storage policies for user-specific access
- ✅ PDF parsing with `pdf-parse` library

---

## 📊 Database Schema Details

### sam_icp_knowledge_entries Table

Stores all question-answer pairs with vector embeddings for RAG retrieval.

**Key Fields:**
```sql
- question_id TEXT       -- e.g., 'objectives', 'pain_points', 'prospecting_linkedin_activity'
- question_text TEXT     -- The actual question asked
- answer_text TEXT       -- User's answer
- answer_structured JSONB -- Parsed JSON structure
- stage TEXT            -- e.g., 'stage_1_target_market', 'stage_2_icp'
- category TEXT         -- e.g., 'business_model', 'pain_points', 'prospecting_criteria'
- embedding VECTOR(1536) -- OpenAI text-embedding-3-small
- confidence_score DECIMAL(3,2) -- 0.0 to 1.0
- is_shallow BOOLEAN    -- Flag for generic answers
- needs_clarification BOOLEAN -- Flag for incomplete answers
- indexed_for_rag BOOLEAN -- Ready for semantic search
```

**Categorization:**

**Stages:**
- `stage_1_target_market` - Business model, industry, company size
- `stage_1b_industry` - Industry-specific questions (8 industries)
- `stage_2_icp` - Deep ICP discovery (27 questions)
- `stage_3_prospecting` - Prospecting criteria (12 questions)
- `stage_4_linkedin` - LinkedIn profile optimization
- `stage_5_content` - Content strategy and trending topics

**Categories:**
- `business_model` - What they sell, to whom, how
- `icp_definition` - Objectives, pain points, current solutions
- `pain_points` - Frustrations, costs, fears
- `prospecting_criteria` - LinkedIn activity, job tenure, tech stack
- `linkedin_profile` - Profile analysis, headline, about section
- `content_strategy` - Trending topics, post ideas, engagement

---

## 🔧 Usage Guide

### ⚠️ IMPORTANT: Dual Storage System

Q&A data is stored in **TWO PLACES**:

1. **`sam_icp_knowledge_entries`** table - For RAG/semantic search with vector embeddings
2. **Knowledge Base tables** - For structured access in the app (`knowledge_base_icps`, `knowledge_base`, etc.)

Always use `storeQAInKnowledgeBase()` from `/lib/sam-kb-integration.ts` to ensure data is stored in BOTH systems.

### Storing Q&A in SAM Message Route

When SAM asks a question and the user answers, store it in BOTH systems:

```typescript
import { storeQAInKnowledgeBase } from '@/lib/sam-kb-integration';

// After user answers a question
const result = await storeQAInKnowledgeBase(
  workspaceId,
  userId,
  discoverySessionId, // optional
  {
    questionId: 'pain_points',
    questionText: 'What are the top 3 pain points your buyers face?',
    answerText: 'Long sales cycles, low conversion rates, high CAC',
    answerStructured: {
      pain_points: [
        { description: 'Long sales cycles', intensity: 'high', cost_type: 'time' },
        { description: 'Low conversion rates', intensity: 'high', cost_type: 'money' },
        { description: 'High CAC', intensity: 'medium', cost_type: 'money' }
      ]
    },
    stage: 'stage_2_icp',
    category: 'pain_points', // Determines which KB table to update
    confidenceScore: 0.9,
    isShallow: false
  }
);

if (result.success) {
  console.log('✅ Q&A stored in BOTH sam_icp_knowledge_entries AND knowledge_base_icps');
} else {
  console.error('❌ Storage failed:', result.error);
}
```

### How Data is Routed to KB Tables

Based on the `category` field, Q&A is automatically stored in the appropriate KB table:

| Category | Stores in sam_icp_knowledge_entries | Also Updates KB Table |
|----------|-----------------------------------|----------------------|
| `icp_definition` | ✅ Yes | `knowledge_base_icps` |
| `pain_points` | ✅ Yes | `knowledge_base_icps.pain_points` |
| `objections` | ✅ Yes | `knowledge_base_icps.messaging_framework` |
| `prospecting_criteria` | ✅ Yes | `knowledge_base_icps.qualification_criteria.prospecting` |
| `business_model` | ✅ Yes | `knowledge_base` (category: business-model) |
| `linkedin_profile` | ✅ Yes | `knowledge_base` (category: linkedin-profile) |
| `content_strategy` | ✅ Yes | `knowledge_base` (category: content-strategy) |
| Other categories | ✅ Yes | `knowledge_base` (category: icp-discovery) |

### Querying for Context (RAG Search)

When SAM needs to reference past answers using semantic search:

```typescript
import { searchQAKnowledge, buildContextFromQA } from '@/lib/sam-qa-storage';

// Semantic search across Q&A (uses vector embeddings)
const { results } = await searchQAKnowledge(
  workspaceId,
  'Tell me about their pain points and frustrations',
  {
    category: 'pain_points',
    limit: 3
  }
);

// Build context string to prepend to system prompt
const context = await buildContextFromQA(
  workspaceId,
  'previous pain point discussion',
  { category: 'pain_points', limit: 5 }
);

// Use in system prompt
const systemPrompt = `${basePrompt}\n${context}\n\nBased on what the user told you earlier, ask a clarifying question...`;
```

### Querying Knowledge Base (Structured Data)

When SAM needs structured ICP data for campaign setup:

```typescript
import {
  getICPFromKnowledgeBase,
  getFullKnowledgeBaseContext,
  buildKBContextForSAM
} from '@/lib/sam-kb-integration';

// Get ICP and all Q&As
const { icp, qas } = await getICPFromKnowledgeBase(workspaceId);

console.log('ICP:', icp.pain_points); // ["Long sales cycles", "Low conversion", ...]
console.log('Q&As:', qas); // [{ question: "...", answer: "...", category: "..." }]

// Get full KB context (ICP, products, competitors, personas, etc.)
const kb = await getFullKnowledgeBaseContext(workspaceId);

console.log('Products:', kb.products);
console.log('Competitors:', kb.competitors);
console.log('Personas:', kb.personas);

// Build formatted context string for SAM's system prompt
const kbContext = await buildKBContextForSAM(workspaceId);

// Use in system prompt
const systemPrompt = `${basePrompt}\n${kbContext}\n\nYou have access to the user's complete knowledge base. Use it to provide personalized guidance.`;
```

### Getting Complete Q&A History

For campaign setup or summaries:

```typescript
import { getQAHistory } from '@/lib/sam-qa-storage';

const { history } = await getQAHistory(discoverySessionId);

history?.forEach(qa => {
  console.log(`Q: ${qa.question_text}`);
  console.log(`A: ${qa.answer_text}`);
  console.log(`Stage: ${qa.stage}, Category: ${qa.category}`);
});
```

### Getting Prospecting Criteria

When setting up campaigns:

```typescript
import { getProspectingCriteria } from '@/lib/sam-qa-storage';

const { criteria } = await getProspectingCriteria(workspaceId, userId);

// Use structured data for campaign setup
criteria?.forEach(item => {
  if (item.question_id === 'prospecting_linkedin_activity') {
    const needsActivePosting = item.answer_structured.active_posting_required;
    // Use in LinkedIn search filters
  }
});
```

### Batch Storing Multiple Q&As

For bulk operations:

```typescript
import { batchStoreQuestionAnswers } from '@/lib/sam-qa-storage';

const qaList = [
  {
    questionId: 'objectives',
    questionText: 'Top 3 objectives?',
    answerText: 'Increase pipeline, reduce sales cycle, improve conversion',
    stage: 'stage_2_icp',
    category: 'icp_definition'
  },
  {
    questionId: 'pain_points',
    questionText: 'Top 3 pain points?',
    answerText: 'Long sales cycles, low conversion, high CAC',
    stage: 'stage_2_icp',
    category: 'pain_points'
  }
];

const { stored, errors } = await batchStoreQuestionAnswers(
  workspaceId,
  userId,
  discoverySessionId,
  qaList
);

console.log(`✅ Stored ${stored} Q&As`);
if (errors.length > 0) {
  console.error('❌ Errors:', errors);
}
```

---

## 🎯 Integration Points in SAM Message Route

### 1. After User Answers a Question

In `/app/api/sam/threads/[threadId]/messages/route.ts`, after processing user's answer:

```typescript
// Import at top
import { storeQuestionAnswer } from '@/lib/sam-qa-storage';

// After extracting answer from user message
if (currentQuestion && userAnswer) {
  await storeQuestionAnswer(workspaceId, userId, sessionId, {
    questionId: currentQuestion.id,
    questionText: currentQuestion.text,
    answerText: userAnswer,
    answerStructured: parseAnswer(userAnswer, currentQuestion.id),
    stage: determineStage(currentQuestion.id),
    category: determineCategory(currentQuestion.id),
    isShallow: isGenericAnswer(userAnswer)
  });
}
```

### 2. When SAM Needs Clarification

Before generating SAM's response:

```typescript
import { searchQAKnowledge, buildContextFromQA } from '@/lib/sam-qa-storage';

// Check if related questions were answered shallowly
const { results } = await searchQAKnowledge(workspaceId, userMessage, {
  category: 'pain_points',
  limit: 3
});

const hasShallowAnswers = results?.some(r => r.confidence_score < 0.5);

if (hasShallowAnswers) {
  // SAM should ask clarifying questions
  const context = await buildContextFromQA(workspaceId, userMessage);
  systemPrompt += `\n${context}\n\nThe user gave shallow answers. Dig deeper.`;
}
```

### 3. When Setting Up Campaigns

In campaign setup flow:

```typescript
import { getProspectingCriteria, getQAByCategory } from '@/lib/sam-qa-storage';

// Get all prospecting criteria
const { criteria } = await getProspectingCriteria(workspaceId, userId);

// Get ICP definition
const { results: icpData } = await getQAByCategory(workspaceId, 'icp_definition');

// Build campaign configuration from stored answers
const campaignConfig = {
  targeting: buildTargetingFromQA(criteria),
  messaging: buildMessagingFromQA(icpData),
  // ...
};
```

---

## 📁 File Upload Integration

### Upload PDF Document

```typescript
// In frontend
const formData = new FormData();
formData.append('file', pdfFile);
formData.append('threadId', threadId);
formData.append('attachmentType', 'linkedin_profile');
formData.append('userNotes', 'Current LinkedIn profile for optimization');

const response = await fetch('/api/sam/upload-document', {
  method: 'POST',
  body: formData
});

const { attachment } = await response.json();
console.log('Extracted text:', attachment.extracted_text);
console.log('Page count:', attachment.extracted_metadata.pageCount);
```

### Reference Uploaded Documents in SAM

After PDF upload, the extracted text is stored in `sam_conversation_attachments`:

```typescript
// Get attachments for thread
const { data: attachments } = await supabase
  .from('sam_conversation_attachments')
  .select('*')
  .eq('thread_id', threadId)
  .eq('attachment_type', 'linkedin_profile');

// Use extracted text in SAM's analysis
if (attachments?.length > 0) {
  const linkedinText = attachments[0].extracted_text;
  // Analyze and generate recommendations
}
```

---

## 🧪 Testing

### Test Q&A Storage

```bash
node -e "
const { storeQuestionAnswer } = require('./lib/sam-qa-storage.ts');

const testQA = {
  questionId: 'test_pain_points',
  questionText: 'What are your top pain points?',
  answerText: 'Long sales cycles and low conversion',
  stage: 'stage_2_icp',
  category: 'pain_points'
};

storeQuestionAnswer('workspace-id', 'user-id', undefined, testQA)
  .then(result => console.log('✅ Result:', result))
  .catch(err => console.error('❌ Error:', err));
"
```

### Test RAG Search

```bash
node -e "
const { searchQAKnowledge } = require('./lib/sam-qa-storage.ts');

searchQAKnowledge('workspace-id', 'pain points and frustrations', {
  category: 'pain_points',
  limit: 5
}).then(({ results }) => {
  console.log('Found', results.length, 'relevant Q&As:');
  results.forEach(r => {
    console.log('Q:', r.question_text);
    console.log('A:', r.answer_text);
    console.log('Similarity:', r.similarity.toFixed(3));
  });
});
"
```

### Verify Database Deployment

```bash
node scripts/js/deploy-sam-enhancements.cjs
```

Should show:
- ✅ sam_conversation_attachments - DEPLOYED
- ✅ sam_icp_knowledge_entries - DEPLOYED
- ✅ sam-attachments bucket - Ready

---

## 📖 Complete Question Mapping

### Stage 1: Target Market & Business Model (8 questions)
- `target_industry` → `stage_1_target_market` / `business_model`
- `company_size` → `stage_1_target_market` / `business_model`
- `target_role` → `stage_1_target_market` / `business_model`
- `geography` → `stage_1_target_market` / `business_model`
- `revenue_model` → `stage_1_target_market` / `business_model`
- `sales_model` → `stage_1_target_market` / `business_model`
- `decision_maker` → `stage_1_target_market` / `business_model`
- `buying_committee` → `stage_1_target_market` / `business_model`

### Stage 1B: Industry-Specific (4 questions per industry × 8 industries = 32 questions)
- `industry_metrics` → `stage_1b_industry` / `industry_context`
- `industry_compliance` → `stage_1b_industry` / `industry_context`
- `industry_tech_stack` → `stage_1b_industry` / `industry_context`
- `industry_challenges` → `stage_1b_industry` / `industry_context`

### Stage 2: ICP Definition (27 questions)
- `objectives` → `stage_2_icp` / `icp_definition`
- `objective_urgency` → `stage_2_icp` / `icp_definition`
- `pain_points` → `stage_2_icp` / `pain_points`
- `pain_cost` → `stage_2_icp` / `pain_points`
- `current_solution` → `stage_2_icp` / `icp_definition`
- `customer_language` → `stage_2_icp` / `icp_definition`
- `objections` → `stage_2_icp` / `objections`
- `frustrations` → `stage_2_icp` / `pain_points`
- `fears` → `stage_2_icp` / `pain_points`
- `disappointments` → `stage_2_icp` / `icp_definition`
- ... (see full list in migration)

### Stage 3: Prospecting Criteria (12 questions)
- `prospecting_linkedin_activity` → `stage_3_prospecting` / `prospecting_criteria`
- `prospecting_job_tenure` → `stage_3_prospecting` / `prospecting_criteria`
- `prospecting_tech_stack` → `stage_3_prospecting` / `prospecting_criteria`
- `prospecting_warm_intro` → `stage_3_prospecting` / `prospecting_criteria`
- `prospecting_exclusions` → `stage_3_prospecting` / `prospecting_criteria`
- ... (see full list in system prompt)

### Stage 4: LinkedIn Profile (variable)
- `linkedin_current_headline` → `stage_4_linkedin` / `linkedin_profile`
- `linkedin_current_about` → `stage_4_linkedin` / `linkedin_profile`
- `linkedin_template_preference` → `stage_4_linkedin` / `linkedin_profile`

### Stage 5: Content Strategy (variable)
- `content_trending_topics` → `stage_5_content` / `content_strategy`
- `content_post_ideas` → `stage_5_content` / `content_strategy`
- `content_engagement_strategy` → `stage_5_content` / `content_strategy`

---

## 🚀 Deployment Checklist

- [x] Create database migrations
- [x] Deploy migrations to Supabase
- [x] Create storage bucket
- [x] Set up storage policies
- [x] Install pdf-parse library
- [x] Create upload API endpoint
- [x] Create Q&A storage module
- [ ] Integrate Q&A storage into SAM message route
- [ ] Add file upload UI to SAM chat
- [ ] Test end-to-end Q&A flow
- [ ] Test document upload flow
- [ ] Verify RAG search works

---

## 💡 Next Steps

1. **Integrate into SAM Message Route:**
   - Import `storeQuestionAnswer` function
   - Call after each user answer
   - Add context retrieval before generating responses

2. **Add File Upload UI:**
   - Create upload button in SAM chat interface
   - Handle file selection and upload
   - Display uploaded documents in thread

3. **Test Complete Flow:**
   - User answers ICP questions → Q&A stored
   - SAM asks clarifying question → References past answers
   - Campaign setup → Uses stored prospecting criteria
   - Document upload → Text extracted and analyzed

---

## 📊 Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     SAM Q&A Storage Flow                     │
└─────────────────────────────────────────────────────────────┘

1. User answers SAM's question
   ↓
2. storeQAInKnowledgeBase() called
   ↓
   ├─→ [A] Store in sam_icp_knowledge_entries (RAG)
   │   ├─ Generate vector embedding (OpenAI)
   │   ├─ Store Q&A with embedding
   │   └─ Enable semantic search
   │
   └─→ [B] Store in Knowledge Base tables (Structured)
       ├─ icp_definition → knowledge_base_icps
       ├─ pain_points → knowledge_base_icps.pain_points
       ├─ prospecting → knowledge_base_icps.qualification_criteria
       ├─ business_model → knowledge_base
       ├─ linkedin_profile → knowledge_base
       └─ content_strategy → knowledge_base

3. SAM can now retrieve data:
   ├─→ Semantic search: searchQAKnowledge() → Vector similarity
   └─→ Structured queries: getICPFromKnowledgeBase() → Direct access

4. Data used for:
   ├─ Clarifying questions (references past answers)
   ├─ Campaign setup (uses prospecting criteria)
   └─ Context in system prompt (KB context)
```

### Storage Tables and Their Purpose

| Table | Purpose | Access Method |
|-------|---------|---------------|
| `sam_icp_knowledge_entries` | RAG with vector embeddings | `searchQAKnowledge()` |
| `knowledge_base_icps` | Structured ICP data | `getICPFromKnowledgeBase()` |
| `knowledge_base` | General knowledge items | `supabaseKnowledge.getByCategory()` |
| `knowledge_base_products` | Product information | `getFullKnowledgeBaseContext()` |
| `knowledge_base_competitors` | Competitor info | `getFullKnowledgeBaseContext()` |
| `knowledge_base_personas` | Buyer personas | `getFullKnowledgeBaseContext()` |

---

## 📚 Related Files

**Database:**
- `supabase/migrations/20251006000000_create_sam_attachments.sql`
- `supabase/migrations/20251006000001_enhance_icp_discovery_for_rag.sql`
- `sql/deploy-sam-enhancements-combined.sql`

**TypeScript:**
- `lib/sam-qa-storage.ts` - Q&A storage with RAG (vector embeddings)
- `lib/sam-kb-integration.ts` - **NEW** Dual storage + KB integration
- `lib/supabase-knowledge.ts` - Knowledge base service
- `app/api/sam/upload-document/route.ts` - Document upload endpoint
- `app/api/sam/threads/[threadId]/messages/route.ts` - SAM message handler

**Scripts:**
- `scripts/js/deploy-sam-enhancements.cjs`
- `scripts/js/deploy-sam-attachments.cjs`

**Documentation:**
- This file: `docs/SAM_QA_STORAGE_SYSTEM.md`

---

## 🔄 Migration from Old to New System

If you were using `storeQuestionAnswer()` directly, update to:

```typescript
// OLD (only stores in sam_icp_knowledge_entries)
import { storeQuestionAnswer } from '@/lib/sam-qa-storage';
await storeQuestionAnswer(workspaceId, userId, sessionId, qa);

// NEW (stores in BOTH sam_icp_knowledge_entries AND knowledge base)
import { storeQAInKnowledgeBase } from '@/lib/sam-kb-integration';
await storeQAInKnowledgeBase(workspaceId, userId, sessionId, qa);
```

---

**System Status:** ✅ Database deployed • ✅ Dual storage ready • ⏳ Integration pending • 🎯 Test and deploy

**Last Updated:** 2025-10-06
