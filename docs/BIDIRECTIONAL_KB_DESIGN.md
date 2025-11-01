# Bidirectional Knowledge Base System Design

**Created:** November 1, 2025
**Status:** Design Phase
**Goal:** Create intelligent two-way flow between SAM conversations and the Knowledge Base

---

## Executive Summary

Design a **bidirectional KB system** where:
1. **SAM → KB**: Onboarding conversations automatically populate the knowledge base
2. **KB → SAM**: Knowledge base informs SAM's responses and search behavior
3. **ICP-Aware Search**: SAM asks users whether to use KB ICP or perform custom searches

---

## Current State Analysis

### ✅ What's Already Built

**1. SAM → KB Data Flow** (`lib/sam-kb-integration.ts`)
- Stores Q&A in `sam_icp_knowledge_entries` (RAG)
- Updates structured KB tables based on category:
  - `knowledge_base_icps` - ICP definitions
  - `knowledge_base` - General knowledge items
  - Category-specific storage (products, competitors, personas, etc.)
- Handles 16+ different Q&A categories
- Batch storage support

**2. KB → SAM Context** (`buildKBContextForSAM()`)
- Fetches full KB context for SAM's system prompt
- Includes: ICP, products, competitors, personas, business model
- Validates auto-detected items from website intelligence
- Provides conversational validation prompts

**3. RAG (Retrieval-Augmented Generation)**
- Vector search via `match_workspace_knowledge` RPC
- Embedding generation via OpenRouter (text-embedding-3-large)
- Semantic search across knowledge base

### ✅ What's Already Built (KB Review/Feedback System)

**4. KB Feedback & Review Subagent** (`app/api/sam/kb-feedback/route.ts`)
- ✅ **Document-level analysis**: Checks content quality, vectorization status, freshness
- ✅ **Section-level health**: Analyzes coverage across 12 critical sections
- ✅ **Critical section detection**: Flags missing essential content (products, ICP, messaging, pricing)
- ✅ **Actionable recommendations**: Specific suggestions like "Add 2-3 competitive battlecards"
- ✅ **Severity classification**: Critical, Warning, Suggestion, Success
- ✅ **Business-context awareness**: Checks for objection handling, success stories, competitor intel
- ✅ **Staleness detection**: Flags documents not updated in >1 month

**Example Feedback:**
- "Missing Essential Sales Content: I need products, pricing content to effectively handle sales conversations"
- "No Target Profile Defined: I don't know who we're targeting!"
- "No Objection Handling Content: When prospects push back, I may struggle to respond"

### ❌ What's Missing

1. **ICP-Aware Search Intent Detection**
   - SAM doesn't ask: "Should I use your existing ICP or search for something different?"
   - No differentiation between ICP-based vs custom searches

2. **Proactive KB Updates During Conversation**
   - KB only updates after discovery session completes
   - No real-time KB updates as user provides answers

3. **KB Confidence Scoring**
   - No way to track which KB items need validation
   - Auto-detected items marked for validation, but no confidence scores

4. **Search Recommendation Engine**
   - No logic to recommend using KB ICP based on user intent
   - Missing intelligence: "I see you have an ICP for X, should I use that?"

5. **KB Review Integration into SAM Conversations**
   - KB feedback API exists (`/api/sam/kb-feedback`) but not integrated into SAM's conversation flow
   - SAM should proactively mention critical gaps during onboarding
   - Example: "Before we search, I notice I don't have competitive intel. Should we add that first?"

6. **KB Version Control**
   - No way to track KB changes over time
   - Can't compare "before onboarding" vs "after onboarding" state

---

## Bidirectional KB System Design

### Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│                   USER CONVERSATION                     │
│                        (SAM)                            │
└───────────────────┬────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
┌───────────────┐      ┌───────────────────┐
│  INTENT       │      │  REAL-TIME KB     │
│  DETECTION    │      │  UPDATES          │
│               │      │                   │
│ • ICP search  │      │ • Q&A answered    │
│ • Custom      │      │ • Auto-extract    │
│ • Validation  │      │ • Confidence++    │
└───────┬───────┘      └────────┬──────────┘
        │                       │
        │                       │
        ▼                       ▼
┌────────────────────────────────────────────────────┐
│           KNOWLEDGE BASE (Multi-Table)              │
│                                                     │
│  1. sam_icp_knowledge_entries (RAG)                │
│  2. knowledge_base_icps (Structured ICP)           │
│  3. knowledge_base (General items)                 │
│  4. confidence_scores (Validation tracking)        │
└───────────────────┬────────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │  ICP-AWARE SEARCH     │
        │  DECISION ENGINE      │
        │                       │
        │  IF intent = search:  │
        │    - Check KB for ICP │
        │    - Ask user:        │
        │      "Use ICP or      │
        │       custom?"        │
        └───────────────────────┘
```

---

## Feature 1: ICP-Aware Search Intent Detection

### Problem
When a user says "find me prospects", SAM should intelligently ask:
> "I have your ICP for [industry] targeting [roles]. Should I search using that, or is this a different search?"

### Solution Design

**1. Intent Detection Patterns**

```typescript
// lib/sam-intent-detection.ts

interface SearchIntent {
  type: 'icp_search' | 'custom_search' | 'validation' | 'unknown';
  confidence: number;
  suggestedICP?: {
    id: string;
    name: string;
    summary: string;
  };
}

export async function detectSearchIntent(
  userMessage: string,
  workspaceId: string,
  conversationHistory: Message[]
): Promise<SearchIntent> {
  // 1. Check for search keywords
  const searchKeywords = [
    'find prospects', 'search for', 'look for',
    'identify leads', 'discover people', 'target',
    'reach out to', 'campaign for'
  ];

  const isSearchRequest = searchKeywords.some(kw =>
    userMessage.toLowerCase().includes(kw)
  );

  if (!isSearchRequest) {
    return { type: 'unknown', confidence: 0 };
  }

  // 2. Fetch workspace ICPs
  const icps = await supabaseKnowledge.getICPs({ workspaceId });

  if (icps.length === 0) {
    // No ICP exists - this is definitely custom
    return { type: 'custom_search', confidence: 1.0 };
  }

  // 3. Semantic similarity check between message and ICP
  const messageEmbedding = await createQueryEmbedding(userMessage);
  const icpText = icps[0].description + ' ' +
                  icps[0].industries?.join(' ') + ' ' +
                  icps[0].job_titles?.join(' ');
  const icpEmbedding = await createQueryEmbedding(icpText);

  const similarity = cosineSimilarity(messageEmbedding, icpEmbedding);

  // 4. Determine intent based on similarity
  if (similarity > 0.8) {
    return {
      type: 'icp_search',
      confidence: similarity,
      suggestedICP: {
        id: icps[0].id,
        name: icps[0].name || 'Your ICP',
        summary: `${icps[0].industries?.[0]} - ${icps[0].job_titles?.[0]}`
      }
    };
  } else if (similarity > 0.5) {
    // Similar but not exact - ask user
    return {
      type: 'validation',
      confidence: similarity,
      suggestedICP: {
        id: icps[0].id,
        name: icps[0].name || 'Your ICP',
        summary: `${icps[0].industries?.[0]} - ${icps[0].job_titles?.[0]}`
      }
    };
  } else {
    return { type: 'custom_search', confidence: 1 - similarity };
  }
}
```

**2. SAM Response Templates**

```typescript
// lib/sam-responses/icp-aware-search.ts

export function getICPAwareSearchPrompt(intent: SearchIntent): string {
  switch (intent.type) {
    case 'icp_search':
      return `I see you want to find prospects. I have your ICP saved:

**${intent.suggestedICP!.name}**
${intent.suggestedICP!.summary}

Should I search using this ICP, or is this a different search?`;

    case 'validation':
      return `Got it, you want to find prospects. Quick check - I have an ICP for:

**${intent.suggestedICP!.name}**
${intent.suggestedICP!.summary}

Is this what you're looking for, or something different?`;

    case 'custom_search':
      return `Sure! I can find prospects for you. What specific criteria should I use?

(You can give me industry, role, company size, location, etc.)`;

    default:
      return `I can help with that. Can you tell me more about what you're looking for?`;
  }
}
```

**3. Integration into SAM Message API**

```typescript
// app/api/sam/threads/[threadId]/messages/route.ts

// BEFORE generating SAM response
const searchIntent = await detectSearchIntent(
  userMessage,
  workspaceId,
  conversationHistory
);

if (searchIntent.type !== 'unknown') {
  // Inject ICP-aware search prompt
  const icpPrompt = getICPAwareSearchPrompt(searchIntent);

  systemPrompt += `\n\n**SEARCH INTENT DETECTED**
  User is requesting a search. Follow this response template:
  ${icpPrompt}

  Wait for user confirmation before proceeding with search.`;
}
```

---

## Feature 2: Real-Time KB Updates

### Problem
Currently, KB only updates at the END of discovery session. User provides valuable info during conversation but it's not immediately stored.

### Solution Design

**1. Trigger KB Updates on Every Q&A**

```typescript
// app/api/sam/threads/[threadId]/messages/route.ts

// AFTER SAM asks a question and user answers
if (discoverySession && userMessage) {
  // Extract Q&A from conversation
  const qa = await extractQAFromMessage({
    question: lastAssistantMessage.content,
    answer: userMessage,
    stage: discoverySession.current_stage,
    category: discoverySession.current_category
  });

  if (qa) {
    // ✅ NEW: Store in KB immediately (not waiting for session end)
    await storeQAInKnowledgeBase(
      workspaceId,
      userId,
      discoverySession.id,
      qa
    );

    console.log(`✅ KB updated in real-time: ${qa.questionId}`);
  }
}
```

**2. Progressive ICP Building**

Instead of building ICP at the end, build it progressively:

```typescript
// lib/icp-discovery/progressive-icp-builder.ts

export async function updateICPProgressively(
  workspaceId: string,
  userId: string,
  qa: QuestionAnswer
): Promise<void> {
  // Get current ICP state
  const { data: currentICP } = await supabase
    .from('knowledge_base_icps')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Map Q&A to ICP field updates
  const updates = mapQAToICPField(qa);

  if (currentICP) {
    // Update existing ICP
    await supabase
      .from('knowledge_base_icps')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
        completion_percentage: calculateCompletionPercentage(currentICP, updates)
      })
      .eq('id', currentICP.id);
  } else {
    // Create initial ICP record
    await supabase
      .from('knowledge_base_icps')
      .insert({
        workspace_id: workspaceId,
        created_by: userId,
        name: `ICP - ${new Date().toISOString().split('T')[0]}`,
        is_active: true,
        ...updates,
        completion_percentage: 10
      });
  }
}
```

**3. Show KB Completion Progress to User**

```typescript
// SAM can say things like:
"Great! I've saved that to your knowledge base.
Your ICP is now 45% complete (3 of 7 core questions answered)."
```

---

## Feature 3: KB Confidence Scoring

### Problem
No way to track which KB items are validated vs auto-detected vs user-provided.

### Solution Design

**1. Add Confidence Score Table**

```sql
-- supabase/migrations/20251101_kb_confidence_scores.sql

CREATE TABLE knowledge_base_confidence_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kb_item_id UUID NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,

  -- Confidence metrics
  confidence_score DECIMAL(3, 2) NOT NULL DEFAULT 0.5, -- 0.0 to 1.0
  source_type TEXT NOT NULL, -- 'user_input' | 'website_auto' | 'document_upload' | 'ai_inference'
  validation_status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'validated' | 'rejected' | 'corrected'

  -- Validation history
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES users(id),
  validation_feedback JSONB, -- { original_value, corrected_value, reason }

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(kb_item_id)
);

CREATE INDEX idx_kb_confidence_workspace ON knowledge_base_confidence_scores(workspace_id);
CREATE INDEX idx_kb_confidence_status ON knowledge_base_confidence_scores(validation_status);
```

**2. Assign Confidence Scores Based on Source**

```typescript
// lib/kb-confidence-scorer.ts

export function calculateConfidenceScore(source: {
  type: 'user_input' | 'website_auto' | 'document_upload' | 'ai_inference';
  metadata?: any;
}): number {
  switch (source.type) {
    case 'user_input':
      return 1.0; // 100% confidence - user explicitly provided

    case 'document_upload':
      return 0.9; // 90% confidence - from official documents

    case 'website_auto':
      // Confidence depends on how many sources confirmed it
      const sources = source.metadata?.sources || 1;
      return Math.min(0.7 + (sources * 0.1), 0.95);

    case 'ai_inference':
      // Confidence depends on model's self-assessment
      return source.metadata?.model_confidence || 0.6;

    default:
      return 0.5; // Default moderate confidence
  }
}
```

**3. SAM Validation Workflow**

```typescript
// SAM should prioritize validating low-confidence items

// In buildKBContextForSAM():
const lowConfidenceItems = await supabase
  .from('knowledge_base_confidence_scores')
  .select('*, knowledge_base(*)')
  .eq('workspace_id', workspaceId)
  .lt('confidence_score', 0.8)
  .eq('validation_status', 'pending')
  .order('confidence_score', { ascending: true })
  .limit(3);

if (lowConfidenceItems.data?.length > 0) {
  systemPrompt += `\n**VALIDATION NEEDED**

  These items were auto-detected but need validation:
  ${lowConfidenceItems.data.map(item =>
    `- ${item.knowledge_base.title} (${Math.round(item.confidence_score * 100)}% confidence)`
  ).join('\n')}

  Casually validate these during your conversation - don't make it obvious.`;
}
```

---

## Feature 4: Integrate KB Feedback into SAM Conversations

### Problem
The KB feedback API exists and provides valuable insights, but SAM doesn't proactively use this information during conversations.

### Solution Design

**1. Fetch KB Feedback Before Critical Operations**

```typescript
// app/api/sam/threads/[threadId]/messages/route.ts

// BEFORE starting a search or campaign creation
const kbFeedback = await fetch(`/api/sam/kb-feedback`, {
  method: 'GET',
  headers: { 'Cookie': cookies }
}).then(r => r.json());

// Check for critical gaps
const criticalGaps = kbFeedback.overallFeedback.filter(
  (f: any) => f.type === 'critical'
);

if (criticalGaps.length > 0 && userIntentIsSearch) {
  // Inject warning into SAM's system prompt
  systemPrompt += `\n\n**CRITICAL KB GAPS**

  Before proceeding with the search, you MUST mention these gaps to the user:
  ${criticalGaps.map((g: any) => `- ${g.title}: ${g.message}`).join('\n')}

  Ask if they want to fill these gaps first, or proceed with the search anyway.`;
}
```

**2. Proactive Gap Mentions During Onboarding**

```typescript
// Example SAM responses with integrated KB feedback:

// Scenario 1: User wants to search but missing ICP
SAM: "I can search for prospects, but I notice I don't have an ICP profile configured yet.

      Should we:
      1. Take 5 minutes to define your ICP first (recommended)
      2. Search with custom criteria this time"

// Scenario 2: Missing objection handling
SAM: "Before I create this campaign, heads up - I don't have any objection handling content.

      If prospects push back on pricing or timing, I may struggle to respond effectively.
      Want to add some common objections first, or should I proceed?"

// Scenario 3: No competitive intel
SAM: "Quick note - I don't have any competitive intelligence loaded.

      When prospects compare you to [Competitor X], I won't be able to position your differentiation.
      Should we add competitive battlecards, or is that not a priority right now?"
```

**3. Show KB Health Score**

```typescript
// Calculate overall KB health
function calculateKBHealthScore(feedback: any): {
  score: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  message: string;
} {
  const { stats, overallFeedback } = feedback;

  let score = 50; // Start at 50

  // ICP configured (+25 points)
  if (stats.icpCount > 0) score += 25;

  // Critical sections filled (+5 each, max 20)
  const criticalSections = ['products', 'messaging', 'pricing', 'objections'];
  const filledSections = criticalSections.filter(s =>
    feedback.sectionFeedback[s]?.status !== 'critical'
  );
  score += (filledSections.length / criticalSections.length) * 20;

  // Document count (+1 per doc, max 15)
  score += Math.min(stats.totalDocuments, 15);

  // Penalties for critical gaps
  const criticalGaps = overallFeedback.filter((f: any) => f.type === 'critical');
  score -= criticalGaps.length * 10;

  score = Math.max(0, Math.min(100, score));

  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  let message: string;

  if (score >= 90) {
    grade = 'A';
    message = "Excellent! I have everything I need to handle sales conversations effectively.";
  } else if (score >= 75) {
    grade = 'B';
    message = "Good foundation, but a few gaps remain.";
  } else if (score >= 60) {
    grade = 'C';
    message = "Minimal coverage - I can function but may struggle with some conversations.";
  } else if (score >= 40) {
    grade = 'D';
    message = "Critical gaps exist - I need more content to be effective.";
  } else {
    grade = 'F';
    message = "I don't have enough knowledge to handle sales conversations confidently.";
  }

  return { score, grade, message };
}
```

**4. Add `/kb-health` Command**

Allow users to check KB health anytime:

```typescript
// SAM conversation handler
if (userMessage.toLowerCase() === '/kb-health') {
  const kbFeedback = await getKBFeedback(workspaceId);
  const health = calculateKBHealthScore(kbFeedback);

  return `**Knowledge Base Health: ${health.grade} (${health.score}/100)**

${health.message}

**Coverage:**
- ICP Profiles: ${kbFeedback.stats.icpCount}
- Documents: ${kbFeedback.stats.totalDocuments}
- Sections Covered: ${kbFeedback.stats.sections}/12

**Critical Gaps:**
${kbFeedback.overallFeedback
  .filter((f: any) => f.type === 'critical')
  .map((f: any) => `- ${f.title}`)
  .join('\n') || '✅ None'}

Type \`/kb-details\` for full breakdown.`;
}
```

---

## Feature 5: Search Recommendation Engine

### Problem
SAM doesn't proactively suggest using KB ICP when user asks to find prospects.

### Solution Design

**1. Search Recommendation Logic**

```typescript
// lib/sam-search-recommender.ts

interface SearchRecommendation {
  useKBICP: boolean;
  reasoning: string;
  alternativePrompt?: string;
}

export async function getSearchRecommendation(
  userIntent: string,
  workspaceId: string
): Promise<SearchRecommendation> {
  // 1. Check if workspace has a validated ICP
  const icps = await supabaseKnowledge.getICPs({ workspaceId });

  if (icps.length === 0) {
    return {
      useKBICP: false,
      reasoning: 'No ICP exists in KB',
      alternativePrompt: 'Let me help you define your ICP first, then we can search.'
    };
  }

  const icp = icps[0];

  // 2. Check ICP completion percentage
  const completionScore = calculateICPCompletionScore(icp);

  if (completionScore < 0.5) {
    return {
      useKBICP: false,
      reasoning: 'ICP is less than 50% complete',
      alternativePrompt: 'I have a partial ICP, but let me ask a few more questions to make sure I search accurately.'
    };
  }

  // 3. Check confidence scores
  const { data: confidenceScores } = await supabase
    .from('knowledge_base_confidence_scores')
    .select('confidence_score')
    .eq('workspace_id', workspaceId)
    .in('kb_item_id', getICPRelatedKBItemIds(icp));

  const avgConfidence = confidenceScores.reduce((sum, s) => sum + s.confidence_score, 0) / confidenceScores.length;

  if (avgConfidence < 0.7) {
    return {
      useKBICP: false,
      reasoning: 'Low confidence in ICP data',
      alternativePrompt: 'I have an ICP but some details need validation. Let me confirm a few things first.'
    };
  }

  // 4. Recommend using KB ICP
  return {
    useKBICP: true,
    reasoning: `ICP is ${Math.round(completionScore * 100)}% complete with ${Math.round(avgConfidence * 100)}% confidence`,
    alternativePrompt: undefined
  };
}
```

**2. Integration Example**

```typescript
// In SAM conversation handler:

if (searchIntentDetected) {
  const recommendation = await getSearchRecommendation(
    userMessage,
    workspaceId
  );

  if (recommendation.useKBICP) {
    samResponse = `I can search for prospects matching your ICP:

**Industry:** ${icp.industries?.join(', ')}
**Roles:** ${icp.job_titles?.join(', ')}
**Company Size:** ${icp.company_size_min}-${icp.company_size_max} employees

Should I use this ICP or search for something different?`;
  } else {
    samResponse = recommendation.alternativePrompt ||
      'Let me help you define search criteria.';
  }
}
```

---

## Implementation Plan

### Phase 1: Foundation (Week 1)
- [ ] Add confidence scoring table migration
- [ ] Implement `detectSearchIntent()` function
- [ ] Add real-time KB updates to message handler
- [ ] Create confidence score calculator

### Phase 2: ICP-Aware Search (Week 2)
- [ ] Build search recommendation engine
- [ ] Add ICP vs custom search prompts to SAM
- [ ] Integrate intent detection into conversation flow
- [ ] Test with 10+ real user conversations

### Phase 3: Progressive ICP Building (Week 3)
- [ ] Implement progressive ICP builder
- [ ] Add completion percentage tracking
- [ ] Show KB completion progress to users
- [ ] Add validation workflow for low-confidence items

### Phase 4: Testing & Refinement (Week 4)
- [ ] A/B test with real users
- [ ] Refine confidence scoring thresholds
- [ ] Optimize semantic similarity matching
- [ ] Document user-facing KB features

---

## Success Metrics

1. **ICP Completion Rate**
   - Target: 80% of workspaces have >70% complete ICP within 30 days
   - Current: Unknown (need to establish baseline)

2. **Search Accuracy**
   - Target: 90% of searches use correct ICP (KB vs custom)
   - Measure: User doesn't correct SAM's ICP suggestion

3. **Validation Efficiency**
   - Target: Low-confidence items validated within 3 conversations
   - Measure: Time from auto-detection to validation

4. **KB Utilization**
   - Target: KB consulted in 100% of search requests
   - Current: 0% (no ICP-aware search logic exists)

---

## Next Steps

1. **Review this design** with product/engineering team
2. **Create database migrations** for confidence scoring
3. **Build intent detection** as first feature
4. **Test with pilot users** (5-10 workspaces)
5. **Iterate based on feedback**

---

**Status:** ⏸️ Awaiting review and approval
**Owner:** Development Team
**Estimated Effort:** 3-4 weeks (1 developer)
