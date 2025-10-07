# Industry Intelligence Auto-Detection System
**Date:** October 7, 2025
**Feature:** Automatic industry detection and knowledge population from user accounts

---

## 🎯 Concept Overview

**Goal:** Automatically detect user's industry from their LinkedIn/email accounts and populate the Knowledge Base with relevant industry-specific content, messaging templates, and best practices.

**User Benefit:**
- Zero manual setup - SAM learns from your profile
- Industry-specific messaging from day 1
- Relevant templates, pain points, and value props
- Better personalization for outreach

---

## 🏗️ System Architecture

### Data Flow:
```
LinkedIn Account Connected
→ Extract Profile Data (via Unipile)
→ Detect Industry from Profile
→ Match to Industry Classification
→ Auto-populate Knowledge Base
→ Suggest Industry Templates
→ Configure ICP Settings
```

---

## 📊 Existing Infrastructure (Already Built!)

### 1. **Account Storage** ✅
**Table:** `workspace_accounts`
- Stores LinkedIn/email accounts
- Has `account_metadata` JSONB field (perfect for storing profile data)
- Already tracks Unipile account IDs

**Table:** `user_unipile_accounts`
- Stores user-account associations
- Tracks connection status

### 2. **Industry Classification** ✅
**Migration:** `20250916_thread_knowledge_extraction.sql`
Already has industry intelligence patterns:
- `industry_healthcare`
- `industry_finance`
- `industry_saas`

### 3. **Template System** ✅
**Table:** `sam_template_library`
- Already has `industry` TEXT field
- Ready for industry-specific templates

### 4. **ICP Configuration** ✅
**Table:** `icp_configurations`
- Has `industry_vertical` field
- Stores industry-specific settings

---

## 🔧 Implementation Plan

### Phase 1: LinkedIn Profile Extraction (2-3 hours)

#### Step 1.1: Create Profile Extraction API
**File:** `/app/api/industry-intelligence/extract-profile/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { unipileAccountId } = await req.json();

  // Call Unipile to get LinkedIn profile data
  const profile = await getLinkedInProfile(unipileAccountId);

  // Extract industry signals
  const industryData = {
    headline: profile.headline,
    industry: profile.industry, // LinkedIn's industry field
    companyIndustry: profile.currentCompany?.industry,
    summary: profile.summary,
    skills: profile.skills,
    experience: profile.experience.map(exp => ({
      company: exp.company,
      industry: exp.companyIndustry,
      title: exp.title
    }))
  };

  return NextResponse.json({ industryData });
}

async function getLinkedInProfile(accountId: string) {
  // Use Unipile MCP tool or API
  const response = await fetch(`https://${UNIPILE_DSN}/api/v1/users/me`, {
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'account-id': accountId
    }
  });
  return await response.json();
}
```

#### Step 1.2: Store Profile Data
Update `workspace_accounts.account_metadata`:
```typescript
{
  profile: {
    headline: "Sales Automation Expert",
    industry: "Software Development",
    companyIndustry: "Computer Software",
    detectedIndustries: ["SaaS", "Technology", "B2B Software"],
    confidence: 0.95
  }
}
```

### Phase 2: Industry Detection Algorithm (1-2 hours)

#### Step 2.1: Create Industry Classifier
**File:** `/lib/services/industry-classifier.ts`

```typescript
// Industry classification map
const INDUSTRY_PATTERNS = {
  saas: {
    keywords: ['saas', 'software', 'platform', 'cloud', 'subscription'],
    companyPatterns: ['software', 'technology', 'cloud computing'],
    titlePatterns: ['software', 'platform', 'cloud', 'devops'],
    confidence_threshold: 0.7
  },
  healthcare: {
    keywords: ['healthcare', 'medical', 'health', 'clinical', 'hospital', 'patient'],
    companyPatterns: ['healthcare', 'medical', 'pharmaceutical', 'biotechnology'],
    titlePatterns: ['medical', 'clinical', 'healthcare', 'nursing'],
    confidence_threshold: 0.8
  },
  finance: {
    keywords: ['finance', 'banking', 'fintech', 'investment', 'wealth'],
    companyPatterns: ['financial services', 'banking', 'investment', 'insurance'],
    titlePatterns: ['financial', 'banker', 'investment', 'wealth advisor'],
    confidence_threshold: 0.75
  },
  real_estate: {
    keywords: ['real estate', 'property', 'realtor', 'broker', 'housing'],
    companyPatterns: ['real estate', 'property management', 'commercial real estate'],
    titlePatterns: ['realtor', 'broker', 'property manager', 'real estate agent'],
    confidence_threshold: 0.8
  },
  manufacturing: {
    keywords: ['manufacturing', 'production', 'factory', 'assembly', 'industrial'],
    companyPatterns: ['manufacturing', 'industrial', 'production', 'automotive'],
    titlePatterns: ['manufacturing', 'production manager', 'operations', 'supply chain'],
    confidence_threshold: 0.75
  },
  professional_services: {
    keywords: ['consulting', 'advisory', 'services', 'professional services'],
    companyPatterns: ['consulting', 'professional services', 'management consulting'],
    titlePatterns: ['consultant', 'advisor', 'partner', 'strategist'],
    confidence_threshold: 0.7
  },
  ecommerce: {
    keywords: ['ecommerce', 'retail', 'online store', 'marketplace', 'shopify'],
    companyPatterns: ['retail', 'ecommerce', 'online marketplace', 'consumer goods'],
    titlePatterns: ['ecommerce', 'retail', 'merchandising', 'online sales'],
    confidence_threshold: 0.75
  }
};

export function detectIndustry(profileData: any): IndustryDetection {
  const scores: Record<string, number> = {};

  // Analyze each industry pattern
  for (const [industry, pattern] of Object.entries(INDUSTRY_PATTERNS)) {
    let score = 0;
    let matches = 0;

    // Check headline
    if (profileData.headline) {
      matches += countMatches(profileData.headline.toLowerCase(), pattern.keywords);
    }

    // Check LinkedIn industry field (high weight)
    if (profileData.industry) {
      matches += countMatches(profileData.industry.toLowerCase(), pattern.companyPatterns) * 2;
    }

    // Check current company industry
    if (profileData.companyIndustry) {
      matches += countMatches(profileData.companyIndustry.toLowerCase(), pattern.companyPatterns) * 1.5;
    }

    // Check experience
    profileData.experience?.forEach(exp => {
      if (exp.industry) {
        matches += countMatches(exp.industry.toLowerCase(), pattern.companyPatterns) * 0.5;
      }
      if (exp.title) {
        matches += countMatches(exp.title.toLowerCase(), pattern.titlePatterns) * 0.3;
      }
    });

    // Calculate confidence score (0-1)
    score = Math.min(matches / 10, 1);
    scores[industry] = score;
  }

  // Get top industries
  const sortedIndustries = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .filter(([_, score]) => score > 0.3);

  const primaryIndustry = sortedIndustries[0];

  return {
    primary: {
      name: primaryIndustry[0],
      confidence: primaryIndustry[1]
    },
    secondary: sortedIndustries.slice(1, 3).map(([name, confidence]) => ({
      name,
      confidence
    })),
    allScores: scores
  };
}

function countMatches(text: string, patterns: string[]): number {
  return patterns.filter(pattern => text.includes(pattern)).length;
}

interface IndustryDetection {
  primary: { name: string; confidence: number };
  secondary: { name: string; confidence: number }[];
  allScores: Record<string, number>;
}
```

### Phase 3: Knowledge Base Auto-Population (2-3 hours)

#### Step 3.1: Industry Knowledge Templates
**File:** `/lib/services/industry-knowledge-templates.ts`

```typescript
export const INDUSTRY_KNOWLEDGE = {
  saas: {
    pain_points: [
      "Customer churn and retention challenges",
      "Long sales cycles with enterprise clients",
      "Product-market fit validation",
      "Scalability and infrastructure costs",
      "Competitive differentiation in crowded market"
    ],
    value_propositions: [
      "Reduce churn by X% with proven retention strategies",
      "Accelerate sales cycle by Y weeks using automation",
      "Scale infrastructure efficiently with cloud-native architecture",
      "Differentiate through unique feature set and UX"
    ],
    messaging_themes: [
      "efficiency",
      "automation",
      "scalability",
      "data-driven",
      "integration"
    ],
    common_titles: [
      "VP of Sales",
      "Head of Product",
      "CTO",
      "Revenue Operations Manager",
      "Customer Success Director"
    ],
    typical_challenges: [
      "Difficulty tracking product metrics",
      "Manual processes slowing growth",
      "Integration complexity with existing tools",
      "Need for better customer insights"
    ]
  },

  healthcare: {
    pain_points: [
      "HIPAA compliance and data security",
      "Patient data management challenges",
      "Staff scheduling and efficiency",
      "Insurance billing complexity",
      "Patient engagement and retention"
    ],
    value_propositions: [
      "Ensure HIPAA compliance with enterprise-grade security",
      "Streamline patient data management workflows",
      "Optimize staff scheduling and reduce overtime costs",
      "Improve patient outcomes through better engagement"
    ],
    messaging_themes: [
      "compliance",
      "patient care",
      "efficiency",
      "security",
      "outcomes"
    ],
    common_titles: [
      "Practice Manager",
      "Chief Medical Officer",
      "Director of Nursing",
      "Healthcare Administrator",
      "Chief Information Officer"
    ],
    typical_challenges: [
      "Maintaining patient privacy and compliance",
      "Reducing administrative burden on staff",
      "Improving patient communication",
      "Managing complex billing processes"
    ]
  },

  // Add more industries...
};

export async function populateIndustryKnowledge(
  supabase: any,
  workspaceId: string,
  industry: string
) {
  const knowledge = INDUSTRY_KNOWLEDGE[industry];
  if (!knowledge) return;

  // Insert pain points
  for (const painPoint of knowledge.pain_points) {
    await supabase.from('knowledge_base').insert({
      workspace_id: workspaceId,
      title: `${industry.toUpperCase()} Pain Point: ${painPoint}`,
      content: painPoint,
      type: 'pain_point',
      category: 'industry_intelligence',
      tags: [industry, 'pain_point', 'auto_detected'],
      visibility: 'workspace',
      source: 'auto_detection'
    });
  }

  // Insert value propositions
  for (const valueProp of knowledge.value_propositions) {
    await supabase.from('knowledge_base').insert({
      workspace_id: workspaceId,
      title: `${industry.toUpperCase()} Value Prop: ${valueProp}`,
      content: valueProp,
      type: 'value_proposition',
      category: 'industry_intelligence',
      tags: [industry, 'value_prop', 'auto_detected'],
      visibility: 'workspace'
    });
  }

  // Create ICP configuration
  await supabase.from('icp_configurations').insert({
    workspace_id: workspaceId,
    name: `${industry.toUpperCase()} Default ICP`,
    industry_vertical: industry,
    target_titles: knowledge.common_titles,
    pain_points: knowledge.pain_points,
    messaging_framework: {
      themes: knowledge.messaging_themes,
      challenges: knowledge.typical_challenges
    },
    is_active: true,
    auto_generated: true
  });
}
```

#### Step 3.2: Auto-Detection Trigger
**File:** `/app/api/industry-intelligence/auto-detect/route.ts`

```typescript
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Get user's workspace
  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .single();

  // Get user's LinkedIn accounts
  const { data: accounts } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', member.workspace_id)
    .eq('account_type', 'linkedin')
    .eq('connection_status', 'connected');

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({
      error: 'No LinkedIn accounts connected'
    }, { status: 400 });
  }

  // Extract profile data from first account
  const profileData = await extractLinkedInProfile(accounts[0].unipile_account_id);

  // Detect industry
  const industryDetection = detectIndustry(profileData);

  // Store detection results
  await supabase
    .from('workspace_accounts')
    .update({
      account_metadata: {
        ...accounts[0].account_metadata,
        industry_detection: industryDetection,
        profile_data: profileData,
        last_analyzed: new Date().toISOString()
      }
    })
    .eq('id', accounts[0].id);

  // Populate knowledge base
  await populateIndustryKnowledge(
    supabase,
    member.workspace_id,
    industryDetection.primary.name
  );

  // Suggest templates
  const templates = await suggestTemplates(
    supabase,
    industryDetection.primary.name
  );

  return NextResponse.json({
    success: true,
    industry: industryDetection,
    knowledgeItemsAdded: 10,
    templatesAvailable: templates.length
  });
}
```

### Phase 4: User Interface Integration (1-2 hours)

#### Step 4.1: Add to Settings Page
**Location:** `/app/workspace/[workspaceId]/settings/page.tsx`

```typescript
<div className="border-b border-gray-700 pb-6">
  <div className="flex items-center justify-between mb-4">
    <div>
      <h4 className="text-white font-medium mb-2">Industry Intelligence</h4>
      <p className="text-gray-400 text-sm">
        Auto-detect your industry and populate relevant knowledge
      </p>
    </div>
    {detectedIndustry && (
      <div className="flex items-center gap-2">
        <CheckCircle className="text-green-400" size={20} />
        <span className="text-green-400 text-sm font-medium">
          {detectedIndustry.primary.name.toUpperCase()}
        </span>
        <span className="text-gray-400 text-xs">
          ({Math.round(detectedIndustry.primary.confidence * 100)}% confidence)
        </span>
      </div>
    )}
  </div>

  {!detectedIndustry ? (
    <button
      onClick={handleDetectIndustry}
      disabled={isDetecting}
      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg flex items-center gap-2"
    >
      {isDetecting ? (
        <>
          <RefreshCw className="animate-spin" size={16} />
          Analyzing...
        </>
      ) : (
        <>
          <Sparkles size={16} />
          Detect My Industry
        </>
      )}
    </button>
  ) : (
    <div className="space-y-3">
      <div className="bg-gray-750 rounded-lg p-4">
        <div className="text-sm text-gray-300 mb-2">Knowledge Base Populated:</div>
        <div className="flex flex-wrap gap-2">
          <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded">
            ✓ 5 Pain Points
          </span>
          <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded">
            ✓ 4 Value Props
          </span>
          <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded">
            ✓ ICP Configuration
          </span>
          <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded">
            ✓ {availableTemplates} Templates
          </span>
        </div>
      </div>

      <button
        onClick={() => setShowIndustryKnowledge(true)}
        className="text-purple-400 hover:text-purple-300 text-sm underline"
      >
        View Industry Knowledge Base →
      </button>
    </div>
  )}
</div>
```

#### Step 4.2: Industry Knowledge Modal
Show detected knowledge items in a modal:

```typescript
{showIndustryKnowledge && (
  <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
    <div className="bg-gray-800 rounded-lg w-full max-w-4xl mx-4 max-h-[80vh] overflow-y-auto border border-gray-600">
      <div className="p-6 border-b border-gray-700 sticky top-0 bg-gray-800">
        <h3 className="text-xl font-semibold text-white">
          Industry Knowledge: {detectedIndustry.primary.name.toUpperCase()}
        </h3>
      </div>

      <div className="p-6 space-y-6">
        {/* Pain Points */}
        <div>
          <h4 className="text-white font-medium mb-3">Pain Points</h4>
          <div className="space-y-2">
            {painPoints.map((point, i) => (
              <div key={i} className="bg-gray-700 rounded p-3 text-gray-300 text-sm">
                • {point}
              </div>
            ))}
          </div>
        </div>

        {/* Value Propositions */}
        <div>
          <h4 className="text-white font-medium mb-3">Value Propositions</h4>
          <div className="space-y-2">
            {valueProps.map((prop, i) => (
              <div key={i} className="bg-gray-700 rounded p-3 text-gray-300 text-sm">
                • {prop}
              </div>
            ))}
          </div>
        </div>

        {/* Available Templates */}
        <div>
          <h4 className="text-white font-medium mb-3">Available Templates</h4>
          <div className="grid grid-cols-2 gap-3">
            {templates.map((template, i) => (
              <div key={i} className="bg-gray-700 rounded p-3">
                <div className="text-white text-sm font-medium mb-1">{template.name}</div>
                <div className="text-gray-400 text-xs">{template.type}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
)}
```

### Phase 5: Automatic Trigger (30 min)

Add automatic detection when LinkedIn account is connected:

**File:** `/app/api/unipile/hosted-auth/callback/route.ts`

```typescript
// After successful LinkedIn connection
if (account.type === 'LINKEDIN') {
  // Trigger industry detection (async, non-blocking)
  fetch('/api/industry-intelligence/auto-detect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }).catch(err => console.error('Industry detection failed:', err));
}
```

---

## 🎯 User Experience Flow

### New User Journey:
1. **Connect LinkedIn** → User adds LinkedIn via Unipile OAuth
2. **Auto-Detect** → System analyzes profile in background
3. **Notification** → "We detected you're in SaaS! Adding relevant knowledge..."
4. **Knowledge Populated** → Pain points, value props, ICPs added to KB
5. **Templates Ready** → Industry-specific templates available
6. **SAM Enhanced** → SAM can now reference industry knowledge in conversations

### Settings Page:
```
┌─────────────────────────────────────────┐
│ Industry Intelligence                   │
│                                         │
│ ✓ SaaS (95% confidence)                │
│                                         │
│ Knowledge Base Populated:               │
│ ✓ 5 Pain Points                        │
│ ✓ 4 Value Props                        │
│ ✓ ICP Configuration                    │
│ ✓ 12 Templates                         │
│                                         │
│ [View Industry Knowledge →]            │
└─────────────────────────────────────────┘
```

---

## 📊 Database Schema Changes

### Update `workspace_accounts` metadata:
```sql
-- No schema changes needed!
-- Uses existing account_metadata JSONB field

-- Example data:
{
  "industry_detection": {
    "primary": {
      "name": "saas",
      "confidence": 0.92
    },
    "secondary": [
      { "name": "technology", "confidence": 0.78 },
      { "name": "b2b", "confidence": 0.65 }
    ],
    "last_analyzed": "2025-10-07T10:00:00Z"
  },
  "profile_data": {
    "headline": "VP of Sales at CloudCo",
    "industry": "Computer Software",
    "companyIndustry": "SaaS"
  }
}
```

### Mark auto-generated knowledge items:
```sql
-- Add source field to knowledge_base (may already exist)
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- Tag auto-detected items
UPDATE knowledge_base
SET source = 'auto_detection',
    tags = array_append(tags, 'auto_detected')
WHERE ...
```

---

## 🚀 Implementation Timeline

| Phase | Task | Time | Status |
|-------|------|------|--------|
| 1 | Profile extraction API | 2-3h | 🔴 Not started |
| 2 | Industry classifier | 1-2h | 🔴 Not started |
| 3 | KB auto-population | 2-3h | 🔴 Not started |
| 4 | UI integration | 1-2h | 🔴 Not started |
| 5 | Auto-trigger | 30min | 🔴 Not started |
| **Total** | | **7-11h** | |

---

## ✅ Success Criteria

1. **Detection Accuracy** - >80% confidence for primary industry
2. **Knowledge Coverage** - Min 5 pain points + 4 value props per industry
3. **Template Availability** - Min 10 templates per major industry
4. **User Adoption** - 70%+ of users trigger auto-detection
5. **SAM Improvement** - Measurably better message quality with industry context

---

## 🔮 Future Enhancements

### Phase 2 Features:
1. **Multi-industry Support** - Detect if user serves multiple industries
2. **Industry Trends** - Auto-update with latest industry trends from web
3. **Competitor Intelligence** - Detect competitors from user's market
4. **Custom Industry Profiles** - Allow users to define custom industries
5. **Performance Tracking** - Track which industries get best response rates

### Advanced Features:
1. **AI-Powered Detection** - Use LLM to analyze profile for nuanced detection
2. **Company Enrichment** - Use Clearbit/Apollo for additional data
3. **Industry News Integration** - Pull latest news for user's industry
4. **Peer Benchmarking** - Compare against other users in same industry

---

## 🛠️ Testing Plan

### Unit Tests:
- `detectIndustry()` function with sample profiles
- Pattern matching accuracy
- Edge cases (ambiguous industries, multiple matches)

### Integration Tests:
- Full flow: LinkedIn connect → detect → populate KB
- Unipile API integration
- Database writes

### User Acceptance Tests:
- Real LinkedIn profiles from various industries
- Verify knowledge accuracy
- Template relevance

---

## 📝 Documentation

### User Docs:
- "How Industry Detection Works"
- "Managing Your Industry Knowledge"
- "Using Industry Templates"

### Developer Docs:
- API documentation for industry endpoints
- Industry pattern customization guide
- Adding new industries

---

## ✨ Summary

This system will:
- ✅ **Save time** - No manual KB setup required
- ✅ **Improve quality** - Industry-specific messaging from day 1
- ✅ **Scale easily** - Works for any industry
- ✅ **Learn continuously** - Gets better over time

**Next Steps:**
1. Implement profile extraction API
2. Build industry classifier
3. Create knowledge templates for top 7 industries
4. Add UI to Settings page
5. Test with real user profiles

Ready to build this?
