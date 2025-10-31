# Complete Data Flow: Prospects and Campaigns

**Date:** October 31, 2025
**Purpose:** Document exactly where and how prospect and campaign data is saved

---

## Overview: The Session-Based Approach

You're correct - **prospects and campaigns are currently saved in sessions**, specifically using the **prospect approval workflow**. This is a multi-step process where data moves through several tables before finally becoming campaigns.

---

## The Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Step 1: LinkedIn Search                       │
│                                                                  │
│  User/SAM: "Find 100 VPs in Healthcare"                        │
│  API: /api/linkedin/search/simple                              │
│                                                                  │
│  Data Saved To:                                                 │
│  ├─ workspace_prospects (permanent CRM storage)                │
│  └─ prospect_approval_sessions (temporary approval workflow)   │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              Step 2: Create Approval Session                     │
│                                                                  │
│  Table: prospect_approval_sessions                              │
│  Purpose: Group prospects for Human-in-the-Loop approval        │
│                                                                  │
│  CREATE TABLE prospect_approval_sessions (                      │
│    id UUID PRIMARY KEY,                                         │
│    workspace_id UUID NOT NULL,                                  │
│    campaign_name TEXT,  -- Future campaign name                 │
│    campaign_tag TEXT,   -- Campaign identifier                  │
│    status TEXT,         -- pending, in_progress, completed      │
│    prospect_source TEXT -- linkedin, csv, api                   │
│  );                                                              │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│           Step 3: Store Prospects in Approval Data              │
│                                                                  │
│  Table: prospect_approval_data                                  │
│  Purpose: Temporary storage for HITL approval                   │
│                                                                  │
│  CREATE TABLE prospect_approval_data (                          │
│    id UUID PRIMARY KEY,                                         │
│    session_id UUID REFERENCES prospect_approval_sessions(id),   │
│    prospect_id UUID, -- Links to workspace_prospects            │
│                                                                  │
│    -- Prospect data stored as JSONB:                            │
│    name TEXT,                                                   │
│    contact JSONB,  -- { email, linkedin_url }                   │
│    company JSONB,  -- { name, industry, website }               │
│    professional JSONB, -- { title, location }                   │
│                                                                  │
│    approval_status TEXT, -- pending, approved, rejected         │
│    confidence_score NUMERIC,                                    │
│    needs_review BOOLEAN                                         │
│  );                                                              │
│                                                                  │
│  Example Row:                                                    │
│  {                                                               │
│    "id": "uuid-1",                                              │
│    "session_id": "session-uuid",                                │
│    "name": "John Doe",                                          │
│    "contact": {                                                 │
│      "email": "john@acme.com",                                  │
│      "linkedin_url": "https://linkedin.com/in/johndoe"          │
│    },                                                            │
│    "company": {                                                 │
│      "name": "Acme Corp",                                       │
│      "industry": "Healthcare",                                  │
│      "website": "https://acme.com"                              │
│    },                                                            │
│    "professional": {                                            │
│      "title": "VP Engineering",                                 │
│      "location": "San Francisco, CA"                            │
│    },                                                            │
│    "approval_status": "pending"                                 │
│  }                                                               │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              Step 4: Human Approval (HITL)                       │
│                                                                  │
│  User reviews prospects in UI (Data Approval tab)               │
│  API: /api/prospect-approval/decide                            │
│                                                                  │
│  For each prospect:                                             │
│  └─ UPDATE prospect_approval_data                               │
│     SET approval_status = 'approved' OR 'rejected'              │
│     WHERE id = prospect_id                                      │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│         Step 5: Move Approved Prospects to Campaign             │
│                                                                  │
│  API: /api/campaigns/add-approved-prospects                    │
│                                                                  │
│  1. Fetch approved prospects from prospect_approval_data:       │
│     SELECT * FROM prospect_approval_data                        │
│     WHERE approval_status = 'approved'                          │
│     AND session_id IN (SELECT id FROM                           │
│       prospect_approval_sessions                                │
│       WHERE workspace_id = 'xxx')                               │
│                                                                  │
│  2. Create or use existing campaign:                            │
│     INSERT INTO campaigns (                                     │
│       workspace_id, name, status,                               │
│       created_by, settings                                      │
│     ) VALUES (...);                                              │
│                                                                  │
│  3. Insert prospects into campaign_prospects:                   │
│     INSERT INTO campaign_prospects (                            │
│       campaign_id, workspace_id,                                │
│       first_name, last_name,                                    │
│       company_name, job_title,                                  │
│       linkedin_url, email,                                      │
│       status, personalization_data                              │
│     ) VALUES (...);                                              │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│            Step 6: Campaign Execution                            │
│                                                                  │
│  Prospects now live in campaign_prospects table                 │
│  API: /api/campaigns/linkedin/execute-live                     │
│                                                                  │
│  For each prospect in campaign:                                 │
│  1. Fetch prospect from campaign_prospects                      │
│  2. Generate personalized message (SAM AI)                      │
│  3. Send via Unipile (LinkedIn/Email)                           │
│  4. UPDATE campaign_prospects                                   │
│     SET status = 'connection_requested',                        │
│         contacted_at = NOW()                                    │
│     WHERE id = prospect_id                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Tables

### 1. `workspace_prospects` (Permanent CRM)

**Purpose:** Central CRM storage for all prospects
**Lifecycle:** Permanent (never deleted)

```sql
CREATE TABLE workspace_prospects (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),

  -- Basic info
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  job_title TEXT,
  company_name TEXT,
  industry TEXT, -- Added Oct 31, 2025
  location TEXT,

  -- Contact info
  linkedin_profile_url TEXT NOT NULL,
  email_address TEXT,
  phone_number TEXT,

  -- BrightData enrichment (Oct 31, 2025)
  company_domain TEXT, -- Company website URL
  company_linkedin_url TEXT, -- Company LinkedIn page URL

  -- Metadata
  enrichment_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(workspace_id, linkedin_profile_url)
);
```

**Data Source:** LinkedIn search via `/api/linkedin/search/simple`

**Usage:**
- Permanent record of all prospects ever found
- Deduplicated by LinkedIn URL
- Source for enrichment via BrightData
- Can be queried for reporting/analytics

---

### 2. `prospect_approval_sessions` (Approval Workflow)

**Purpose:** Group prospects for Human-in-the-Loop (HITL) approval
**Lifecycle:** Temporary (archived after approval complete)

```sql
CREATE TABLE prospect_approval_sessions (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),

  -- Campaign association
  campaign_name TEXT, -- "20251031-ACME-Healthcare-VPs"
  campaign_tag TEXT,  -- "healthcare-vps-q4"

  -- Session metadata
  status TEXT DEFAULT 'pending', -- pending, in_progress, completed, archived
  prospect_source TEXT, -- linkedin, csv, manual, api

  -- Stats
  total_prospects INTEGER DEFAULT 0,
  approved_count INTEGER DEFAULT 0,
  rejected_count INTEGER DEFAULT 0,
  pending_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Data Source:** Created by `/api/linkedin/search/simple` after search completes

**Usage:**
- Group prospects from a single LinkedIn search
- Track approval progress (X/Y approved)
- Associate with future campaign name
- Shows in "Data Approval" tab in UI

---

### 3. `prospect_approval_data` (HITL Approval Queue)

**Purpose:** Store individual prospects waiting for approval
**Lifecycle:** Temporary (deleted or archived after campaign creation)

```sql
CREATE TABLE prospect_approval_data (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES prospect_approval_sessions(id),
  prospect_id UUID REFERENCES workspace_prospects(id),

  -- Prospect data (JSONB for flexibility)
  name TEXT,
  contact JSONB, -- { email, linkedin_url, phone }
  company JSONB, -- { name, industry, website, linkedin_url }
  professional JSONB, -- { title, location, headline }

  -- Approval workflow
  approval_status TEXT DEFAULT 'pending', -- pending, approved, rejected, needs_review
  confidence_score NUMERIC, -- 0-1 (from SAM's AI scoring)
  needs_review BOOLEAN DEFAULT FALSE,
  rejection_reason TEXT,

  -- Enrichment tracking
  enrichment_data JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Data Source:** Populated by `/api/linkedin/search/simple` from `workspace_prospects`

**Example Data:**
```json
{
  "id": "abc-123",
  "session_id": "session-456",
  "prospect_id": "prospect-789",
  "name": "John Doe",
  "contact": {
    "email": "john@acme.com",
    "linkedin_url": "https://linkedin.com/in/johndoe"
  },
  "company": {
    "name": "Acme Corporation",
    "industry": "Healthcare",
    "website": "https://acme.com",
    "linkedin_url": "https://linkedin.com/company/acme"
  },
  "professional": {
    "title": "VP Engineering",
    "location": "San Francisco, CA",
    "headline": "Building the future of healthcare tech"
  },
  "approval_status": "approved",
  "confidence_score": 0.92
}
```

**Usage:**
- User reviews each prospect in UI
- User approves/rejects individually
- Stores enriched data (email, company info)
- Moved to campaigns after approval

---

### 4. `campaigns` (Campaign Definitions)

**Purpose:** Define outreach campaigns
**Lifecycle:** Permanent (archived when complete)

```sql
CREATE TABLE campaigns (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),

  -- Campaign details
  name TEXT NOT NULL, -- "20251031-ACME-Healthcare-VPs"
  description TEXT,
  status TEXT DEFAULT 'draft', -- draft, active, paused, completed, archived

  -- Settings (JSONB for flexibility)
  settings JSONB DEFAULT '{}', -- { channels, message_templates, timing }

  -- Ownership
  created_by UUID REFERENCES users(id),

  -- Stats
  total_prospects INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  responses_received INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Data Source:** Created by `/api/campaigns/add-approved-prospects`

**Usage:**
- Defines campaign strategy (LinkedIn + Email, timing, etc.)
- Holds campaign-level settings
- Tracks campaign performance metrics

---

### 5. `campaign_prospects` (Campaign Execution)

**Purpose:** Prospects assigned to specific campaigns
**Lifecycle:** Permanent (for reporting and analytics)

```sql
CREATE TABLE campaign_prospects (
  id UUID PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),

  -- Prospect info (denormalized for performance)
  first_name TEXT,
  last_name TEXT,
  company_name TEXT,
  job_title TEXT,
  linkedin_url TEXT,
  email TEXT,

  -- Campaign execution
  status TEXT DEFAULT 'pending',
  -- pending, ready_to_message, connection_requested,
  -- connected, messaged, replied, converted, failed

  contacted_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,

  -- Personalization
  personalization_data JSONB DEFAULT '{}',
  -- {
  --   message_template_id,
  --   custom_message,
  --   pain_points,
  --   value_props,
  --   unipile_message_id
  -- }

  -- Unipile tracking
  unipile_account_id TEXT,
  unipile_message_id TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(campaign_id, linkedin_url)
);
```

**Data Source:** Populated by `/api/campaigns/add-approved-prospects` from `prospect_approval_data`

**Usage:**
- Execution queue for campaign
- Track individual prospect status
- Store personalized messages
- Record Unipile message IDs for tracking

---

## API Endpoints and Data Operations

### 1. LinkedIn Search → Create Session + Prospects

**Endpoint:** `POST /api/linkedin/search/simple`

**Input:**
```json
{
  "filters": {
    "keywords": "VP Engineering",
    "company_size": "201-500",
    "industry": "Healthcare"
  },
  "limit": 100
}
```

**Data Operations:**
```typescript
// 1. Search LinkedIn via Unipile
const results = await unipileSearch(filters);

// 2. Insert into workspace_prospects (permanent CRM)
await supabase
  .from('workspace_prospects')
  .insert(results.map(r => ({
    workspace_id,
    first_name: r.firstName,
    last_name: r.lastName,
    company_name: r.company || 'unavailable',
    industry: r.industry || 'unavailable',
    linkedin_profile_url: r.linkedinUrl,
    email_address: null, // Will be enriched later
    company_domain: null,
    company_linkedin_url: null
  })));

// 3. Create approval session
const sessionId = crypto.randomUUID();
await supabase
  .from('prospect_approval_sessions')
  .insert({
    id: sessionId,
    workspace_id,
    campaign_name: generateCampaignName(), // "20251031-ACME-Healthcare"
    status: 'pending',
    total_prospects: results.length
  });

// 4. Create approval data (one row per prospect)
await supabase
  .from('prospect_approval_data')
  .insert(results.map(r => ({
    session_id: sessionId,
    prospect_id: r.prospectId, // From workspace_prospects
    name: `${r.firstName} ${r.lastName}`,
    contact: {
      email: r.email,
      linkedin_url: r.linkedinUrl
    },
    company: {
      name: r.company,
      industry: r.industry
    },
    professional: {
      title: r.title,
      location: r.location
    },
    approval_status: 'pending'
  })));
```

**File:** `app/api/linkedin/search/simple/route.ts:896-1050`

---

### 2. Approve Prospects (HITL)

**Endpoint:** `POST /api/prospect-approval/decide`

**Input:**
```json
{
  "prospect_id": "uuid-123",
  "decision": "approved" // or "rejected"
}
```

**Data Operations:**
```typescript
// Update approval status
await supabase
  .from('prospect_approval_data')
  .update({
    approval_status: decision, // 'approved' or 'rejected'
    updated_at: new Date().toISOString()
  })
  .eq('id', prospect_id);

// Update session counts
await supabase
  .from('prospect_approval_sessions')
  .update({
    approved_count: supabase.raw('approved_count + 1'),
    pending_count: supabase.raw('pending_count - 1')
  })
  .eq('id', session_id);
```

**File:** `app/api/prospect-approval/decide/route.ts`

---

### 3. Create Campaign from Approved Prospects

**Endpoint:** `POST /api/campaigns/add-approved-prospects`

**Input:**
```json
{
  "campaign_name": "Healthcare VPs Q4 2025",
  "session_ids": ["session-1", "session-2"],
  "workspace_id": "workspace-123"
}
```

**Data Operations:**
```typescript
// 1. Create campaign
const { data: campaign } = await supabase
  .from('campaigns')
  .insert({
    workspace_id,
    name: campaign_name,
    status: 'draft',
    created_by: user.id,
    settings: defaultCampaignSettings
  })
  .select()
  .single();

// 2. Fetch approved prospects
const { data: approvedProspects } = await supabase
  .from('prospect_approval_data')
  .select('*')
  .in('session_id', session_ids)
  .eq('approval_status', 'approved');

// 3. Insert into campaign_prospects
await supabase
  .from('campaign_prospects')
  .insert(approvedProspects.map(p => ({
    campaign_id: campaign.id,
    workspace_id,
    first_name: p.name.split(' ')[0],
    last_name: p.name.split(' ').slice(1).join(' '),
    company_name: p.company.name,
    job_title: p.professional.title,
    linkedin_url: p.contact.linkedin_url,
    email: p.contact.email,
    status: 'pending',
    personalization_data: {
      pain_points: p.professional.pain_points,
      value_props: p.professional.value_props
    }
  })));

// 4. Update session status
await supabase
  .from('prospect_approval_sessions')
  .update({ status: 'completed' })
  .in('id', session_ids);
```

**File:** `app/api/campaigns/add-approved-prospects/route.ts`

---

### 4. Execute Campaign (Send Messages)

**Endpoint:** `POST /api/campaigns/linkedin/execute-live`

**Input:**
```json
{
  "campaign_id": "campaign-123",
  "max_prospects": 10
}
```

**Data Operations:**
```typescript
// 1. Fetch prospects ready for messaging
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('campaign_id', campaign_id)
  .eq('status', 'pending')
  .limit(max_prospects);

// 2. For each prospect:
for (const prospect of prospects) {
  // Generate personalized message (SAM AI)
  const message = await generateMessage(prospect);

  // Send via Unipile
  const response = await unipile.sendConnectionRequest({
    linkedin_url: prospect.linkedin_url,
    message
  });

  // Update prospect status
  await supabase
    .from('campaign_prospects')
    .update({
      status: 'connection_requested',
      contacted_at: new Date().toISOString(),
      personalization_data: {
        ...prospect.personalization_data,
        unipile_message_id: response.message_id,
        message_sent: message
      }
    })
    .eq('id', prospect.id);
}

// 3. Update campaign stats
await supabase
  .from('campaigns')
  .update({
    messages_sent: supabase.raw('messages_sent + ?', [prospects.length])
  })
  .eq('id', campaign_id);
```

**File:** `app/api/campaigns/linkedin/execute-live/route.ts:418-463`

---

## Summary: Where Data Lives

| Stage | Data Location | Purpose | Lifecycle |
|-------|--------------|---------|-----------|
| **1. LinkedIn Search** | `workspace_prospects` | Permanent CRM | Forever (deduplicated) |
| **2. Approval Session** | `prospect_approval_sessions` | HITL workflow grouping | Temporary (archived) |
| **3. Approval Queue** | `prospect_approval_data` | HITL review queue | Temporary (moved to campaigns) |
| **4. Campaign Definition** | `campaigns` | Campaign settings | Permanent (archived when done) |
| **5. Campaign Execution** | `campaign_prospects` | Execution queue + tracking | Permanent (for analytics) |

---

## Key Insights

1. **Prospects are saved TWICE:**
   - `workspace_prospects` = Permanent CRM (all prospects ever found)
   - `prospect_approval_data` = Temporary approval queue (specific search session)

2. **Sessions are temporary:**
   - `prospect_approval_sessions` groups prospects for approval
   - Archived after prospects moved to campaigns
   - Multiple sessions can feed one campaign

3. **Campaigns are permanent:**
   - `campaigns` table never deleted (archived instead)
   - `campaign_prospects` keeps full execution history
   - Used for reporting, analytics, learning

4. **Data flows one direction:**
   - LinkedIn Search → workspace_prospects + prospect_approval_data
   - Approval → prospect_approval_data (status updated)
   - Campaign Creation → campaign_prospects (new records)
   - Execution → campaign_prospects (status updated)

5. **No data in Agent SDK sessions:**
   - Agent SDK only holds conversation context
   - All business data (prospects, campaigns) in Supabase
   - Agent SDK sessions can be lost (server restart)
   - Supabase data is permanent

---

**Last Updated:** October 31, 2025
**By:** Claude AI (Sonnet 4.5)
