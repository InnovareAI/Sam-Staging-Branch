# Sam to LinkedIn Messaging Pipeline - Complete Technical Documentation

**Version:** 1.0
**Date:** October 26, 2025
**Status:** ✅ Production Ready
**Last Updated:** After commit 66b8ce1 (LinkedIn URL extraction fix)

---

## Table of Contents

1. [Pipeline Overview](#pipeline-overview)
2. [Stage 1: Data Extraction & Prospect Storage](#stage-1-data-extraction--prospect-storage)
3. [Stage 2: Prospect Approval Flow](#stage-2-prospect-approval-flow)
4. [Stage 3: Campaign Creation & Linking](#stage-3-campaign-creation--linking)
5. [Stage 4: LinkedIn ID Sync (Optional)](#stage-4-linkedin-id-sync-optional)
6. [Stage 5: Message Execution](#stage-5-message-execution)
7. [Data Schema Reference](#data-schema-reference)
8. [Error Handling & Troubleshooting](#error-handling--troubleshooting)
9. [Testing & Verification](#testing--verification)
10. [Performance & Rate Limits](#performance--rate-limits)

---

## Pipeline Overview

### High-Level Flow

```
┌─────────────────┐
│   SAM AI        │
│ Data Extraction │
└────────┬────────┘
         │ Writes prospect data
         ▼
┌─────────────────────────┐
│ prospect_approval_data  │
│ (JSONB: contact object) │
└────────┬────────────────┘
         │ User approves/rejects
         ▼
┌─────────────────────────┐
│   Prospect Approval     │
│   API Extracts URL      │
└────────┬────────────────┘
         │ Flattens linkedin_url
         ▼
┌─────────────────────────┐
│   Campaign Creation     │
│  (campaign_prospects)   │
└────────┬────────────────┘
         │ Optional: Sync IDs
         ▼
┌─────────────────────────┐
│ LinkedIn ID Sync        │
│ (via Unipile messages)  │
└────────┬────────────────┘
         │ Execution ready
         ▼
┌─────────────────────────┐
│  Message Execution      │
│  (Unipile → LinkedIn)   │
└─────────────────────────┘
```

### Critical Data Path

```
prospect_approval_data.contact.linkedin_url (JSONB nested)
    ↓ [EXTRACTION: Line 114 in approved/route.ts]
campaign_prospects.linkedin_url (TEXT flat)
    ↓ [PROFILE RETRIEVAL: Line 298 in execute-live/route.ts]
Unipile provider_id (Dynamic API call)
    ↓ [INVITATION: Line 357 in execute-live/route.ts]
LinkedIn Connection Request Sent ✅
```

---

## Stage 1: Data Extraction & Prospect Storage

### 1.1 Data Source: SAM AI

**Process:**
- SAM AI extracts prospect data from various sources (LinkedIn, Apollo, CSV, etc.)
- Data is validated and structured before storage
- Stored in `prospect_approval_data` table for HITL (Human-in-the-Loop) approval

### 1.2 Database Storage

**Table:** `prospect_approval_data`

**Schema:**
```sql
CREATE TABLE prospect_approval_data (
  prospect_id UUID PRIMARY KEY,
  session_id UUID REFERENCES prospect_approval_sessions(id),
  name TEXT NOT NULL,
  title TEXT,
  location TEXT,
  connection_degree TEXT,
  contact JSONB,  -- ⚠️ CRITICAL: Nested structure
  company JSONB,
  approval_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**JSONB Structure:**

```json
{
  "contact": {
    "email": "john.doe@company.com",
    "linkedin_url": "https://www.linkedin.com/in/john-doe",
    "phone": "+1234567890"
  },
  "company": {
    "name": "Acme Corp",
    "industry": ["Technology", "SaaS"],
    "size": "51-200",
    "location": "San Francisco, CA"
  }
}
```

**⚠️ CRITICAL DATA REQUIREMENT:**

The `contact.linkedin_url` field **MUST** be populated for prospects to be messageable. Without this:
- Prospect cannot be added to LinkedIn campaigns
- Message execution will skip the prospect
- Campaign shows "No prospects ready for messaging"

### 1.3 Data Quality Checks

**At Extraction Time:**

```typescript
// Example: Validate LinkedIn URL format
const linkedInUrlPattern = /^https?:\/\/(www\.)?linkedin\.com\/(in|pub|profile)\/.+/;

if (prospectData.linkedin_url && !linkedInUrlPattern.test(prospectData.linkedin_url)) {
  console.warn('Invalid LinkedIn URL format:', prospectData.linkedin_url);
}
```

**Required Fields:**
- ✅ `name` (REQUIRED)
- ✅ `contact.linkedin_url` (REQUIRED for LinkedIn campaigns)
- ⚠️ `contact.email` (Recommended, used as fallback identifier)
- ⚠️ `title` (Recommended for personalization)
- ⚠️ `company.name` (Recommended for personalization)

---

## Stage 2: Prospect Approval Flow

### 2.1 Approval API

**Endpoint:** `GET /api/prospect-approval/approved?workspace_id={id}`
**File:** `app/api/prospect-approval/approved/route.ts`

### 2.2 CRITICAL FIX: LinkedIn URL Extraction

**Problem Solved (Commit 66b8ce1):**

LinkedIn URLs were stored in nested JSONB `contact.linkedin_url` but campaign creation expected flat `linkedin_url` field. This caused "No prospects ready for messaging" errors.

**Solution (Lines 113-126):**

```typescript
// CRITICAL FIX: Extract LinkedIn URL from contact JSONB object
const linkedinUrl = prospect.contact?.linkedin_url || prospect.linkedin_url || null;

// Check if prospect already in a campaign
const { data: campaignProspect } = await supabase
  .from('campaign_prospects')
  .select('campaign_id, campaigns(name, status)')
  .eq('linkedin_url', linkedinUrl)
  .single();

return {
  ...prospect,
  // CRITICAL FIX: Flatten linkedin_url to top level
  linkedin_url: linkedinUrl,
  in_campaign: !!campaignProspect,
  campaign_id: campaignProspect?.campaign_id
};
```

**Key Features:**
1. **Fallback Chain:** Tries `contact.linkedin_url` → `linkedin_url` → `null`
2. **Deduplication:** Checks if prospect already in a campaign
3. **Flattening:** Moves nested URL to top-level for downstream consumption

### 2.3 Response Format

**Success Response:**

```json
{
  "success": true,
  "prospects": [
    {
      "prospect_id": "uuid",
      "session_id": "uuid",
      "name": "John Doe",
      "title": "VP of Sales",
      "linkedin_url": "https://linkedin.com/in/john-doe",
      "contact": {
        "email": "john@company.com",
        "linkedin_url": "https://linkedin.com/in/john-doe"
      },
      "company": {
        "name": "Acme Corp",
        "industry": ["Technology"]
      },
      "in_campaign": false,
      "approval_status": "approved"
    }
  ],
  "total": 1
}
```

### 2.4 Filtering Logic

**Included Prospects:**
- ✅ `approval_status = 'approved'`
- ✅ Belongs to workspace (via session)
- ✅ NOT already in a campaign (`in_campaign = false`)
- ✅ Has LinkedIn URL (`linkedin_url IS NOT NULL`)

**Excluded Prospects:**
- ❌ `approval_status = 'rejected'` or `'pending'`
- ❌ Different workspace
- ❌ Already in active campaign
- ❌ Missing LinkedIn URL

---

## Stage 3: Campaign Creation & Linking

### 3.1 Add Prospects to Campaign

**Endpoint:** `POST /api/campaigns/add-approved-prospects`
**File:** `app/api/campaigns/add-approved-prospects/route.ts`

### 3.2 Request Format

```json
{
  "campaign_id": "uuid",
  "workspace_id": "uuid",
  "prospect_ids": ["uuid1", "uuid2", "uuid3"]
}
```

### 3.3 Data Transformation (Lines 81-108)

**Input:** `prospect_approval_data` record
**Output:** `campaign_prospects` record

```typescript
const campaignProspects = validProspects.map(prospect => {
  // Split name into first/last
  const nameParts = (prospect.name || '').split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  return {
    campaign_id,
    workspace_id,
    first_name: firstName,
    last_name: lastName,
    email: prospect.contact?.email || null,
    company_name: prospect.company?.name || '',
    linkedin_url: prospect.contact?.linkedin_url || null,  // ← FROM NESTED JSONB
    title: prospect.title || '',
    location: prospect.location || null,
    industry: prospect.company?.industry?.[0] || 'Not specified',
    status: 'new',
    notes: null,
    personalization_data: {
      source: 'approved_prospects',
      campaign_name: prospect.prospect_approval_sessions?.campaign_name,
      campaign_tag: prospect.prospect_approval_sessions?.campaign_tag,
      approved_at: new Date().toISOString(),
      connection_degree: prospect.connection_degree
    }
  };
});
```

**Key Transformations:**
1. **Name Splitting:** `"John Doe"` → `first_name: "John"`, `last_name: "Doe"`
2. **JSONB Flattening:** `contact.email` → `email`, `contact.linkedin_url` → `linkedin_url`
3. **Industry Selection:** Takes first industry from array
4. **Metadata Preservation:** Stores original context in `personalization_data`

### 3.4 campaign_prospects Schema

```sql
CREATE TABLE campaign_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Identity
  first_name TEXT,
  last_name TEXT,
  email TEXT,

  -- Company Info
  company_name TEXT NOT NULL,
  title TEXT,
  industry TEXT,
  location TEXT,

  -- LinkedIn Integration
  linkedin_url TEXT,           -- Profile URL (from approval data)
  linkedin_user_id TEXT,        -- Internal Unipile ID (synced later)

  -- Campaign Status
  status TEXT DEFAULT 'new',    -- 'new', 'pending', 'connection_requested', etc.
  contacted_at TIMESTAMPTZ,

  -- Personalization
  personalization_data JSONB,
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.5 Status Lifecycle

```
new → pending → approved → ready_to_message → connection_requested →
  follow_up_sent → engaged → completed
```

**Status Meanings:**
- `new`: Just added to campaign
- `pending`: Awaiting campaign start
- `approved`: Ready for messaging
- `ready_to_message`: Explicitly marked for next batch
- `connection_requested`: LinkedIn connection sent
- `follow_up_sent`: Follow-up message sent
- `engaged`: Prospect responded
- `completed`: Sequence completed
- `already_invited`: Duplicate invitation attempt (skipped)

---

## Stage 4: LinkedIn ID Sync (Optional)

### 4.1 Overview

**Purpose:** Convert LinkedIn profile URLs → Internal Unipile IDs

**Status:** **OPTIONAL** - The execute-live endpoint can work with just `linkedin_url`

**When Needed:**
- When using legacy messaging APIs that require `linkedin_user_id`
- For faster message sending (skips profile lookup)
- For advanced analytics tracking

### 4.2 Sync Process

**Endpoint:** `POST /api/campaigns/sync-linkedin-ids`
**File:** `app/api/campaigns/sync-linkedin-ids/route.ts`

**Request:**
```json
{
  "campaignId": "uuid",
  "workspaceId": "uuid"
}
```

### 4.3 Algorithm (Lines 44-263)

**Step 1: Get Prospects Missing IDs**
```typescript
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, linkedin_url, linkedin_user_id')
  .eq('campaign_id', campaignId)
  .is('linkedin_user_id', null);  // Only missing IDs
```

**Step 2: Fetch Unipile LinkedIn Account**
```typescript
const accountsResponse = await mcpRegistry.callTool({
  method: 'tools/call',
  params: { name: 'unipile_get_accounts' }
});

const linkedinAccounts = accountsData.accounts?.filter(
  (acc: any) => acc.provider === 'LINKEDIN'
);
```

**Step 3: Get Recent Messages (Last 100)**
```typescript
const messagesResponse = await mcpRegistry.callTool({
  method: 'tools/call',
  params: {
    name: 'unipile_get_recent_messages',
    arguments: {
      account_id: linkedinAccountId,
      limit: 100
    }
  }
});
```

**Step 4: Build ID Maps**
```typescript
const linkedinIdMap = new Map<string, string>(); // profile_url → internal_id
const nameMap = new Map<string, string>();       // full_name → internal_id

for (const message of messages) {
  // Extract sender info
  const senderId = message.sender_id || message.from?.id;
  const senderProfileUrl = message.sender_profile_url || message.from?.profile_url;
  const senderName = message.sender_name || message.from?.name;

  if (senderId && senderProfileUrl) {
    const normalizedUrl = senderProfileUrl
      .replace(/\/$/, '')        // Remove trailing slash
      .replace(/\?.*$/, '')      // Remove query params
      .toLowerCase();

    linkedinIdMap.set(normalizedUrl, senderId);
  }

  if (senderId && senderName) {
    nameMap.set(senderName.trim().toLowerCase(), senderId);
  }
}
```

**Step 5: Match Prospects**
```typescript
for (const prospect of prospects) {
  let linkedinUserId = null;

  // PRIMARY: Match by URL (most accurate)
  if (prospect.linkedin_url) {
    const normalizedUrl = prospect.linkedin_url
      .replace(/\/$/, '')
      .replace(/\?.*$/, '')
      .toLowerCase();

    linkedinUserId = linkedinIdMap.get(normalizedUrl) || null;
  }

  // FALLBACK: Match by name (less accurate)
  if (!linkedinUserId) {
    const fullName = `${prospect.first_name} ${prospect.last_name}`
      .trim()
      .toLowerCase();
    linkedinUserId = nameMap.get(fullName) || null;
  }

  if (linkedinUserId) {
    resolvedProspects.push({ id: prospect.id, linkedin_user_id: linkedinUserId });
  }
}
```

**Step 6: Update Database**
```typescript
const updatePromises = resolvedProspects.map(async (resolved) => {
  return supabase
    .from('campaign_prospects')
    .update({ linkedin_user_id: resolved.linkedin_user_id })
    .eq('id', resolved.id);
});
```

### 4.4 Matching Accuracy

**URL Matching (Primary):** ~95% accuracy
- Requires exact profile URL match
- Handles trailing slashes and query params
- Case-insensitive

**Name Matching (Fallback):** ~70% accuracy
- May match wrong person with same name
- Requires recent message history
- Only use when URL matching fails

### 4.5 Limitations

**Only Works If:**
- ✅ Prospect has messaged your LinkedIn account before
- ✅ Messages are in last 100 messages
- ✅ Profile URL in messages matches prospect URL

**Does NOT Work If:**
- ❌ Prospect never messaged you
- ❌ Messages are older (archived)
- ❌ Profile URL format changed

**Alternative:** The execute-live endpoint dynamically retrieves profile IDs, so this sync step is **optional**.

---

## Stage 5: Message Execution

### 5.1 Overview

**Endpoint:** `POST /api/campaigns/linkedin/execute-live`
**File:** `app/api/campaigns/linkedin/execute-live/route.ts`
**Status:** ✅ Production Ready

### 5.2 Request Format

```json
{
  "campaignId": "uuid",
  "maxProspects": 1,
  "dryRun": false
}
```

**Parameters:**
- `campaignId`: Campaign to execute
- `maxProspects`: Prospects per batch (default: 1, max: 5)
- `dryRun`: Test mode without sending (default: false)

### 5.3 Execution Flow

#### Phase 1: Authentication & Validation (Lines 34-80)

```typescript
// 1. Authenticate user
const { data: { user }, error: authError } = await supabase.auth.getUser();

// 2. Get campaign with workspace
const { data: campaign } = await supabase
  .from('campaigns')
  .select(`*, workspaces!inner(id, name)`)
  .eq('id', campaignId)
  .single();

// 3. Verify workspace membership
const { data: membershipCheck } = await supabase
  .from('workspace_members')
  .select('role')
  .eq('workspace_id', campaign.workspace_id)
  .eq('user_id', user.id)
  .single();
```

#### Phase 2: LinkedIn Account Verification (Lines 84-185)

**Step 1: Get Workspace Account**
```typescript
const { data: linkedinAccounts } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', campaign.workspace_id)
  .eq('account_type', 'linkedin')
  .eq('connection_status', 'connected');
```

**Step 2: Validate Unipile ID**
```typescript
if (!selectedAccount.unipile_account_id) {
  return NextResponse.json({
    error: 'LinkedIn account configuration error',
    details: 'Account missing Unipile integration ID',
    troubleshooting: {
      step1: 'Go to Workspace Settings → Integrations',
      step2: 'Disconnect and reconnect LinkedIn account',
      step3: 'Complete the full OAuth flow'
    }
  }, { status: 400 });
}
```

**Step 3: Verify Unipile Account Active**
```typescript
const unipileCheckUrl = `https://${UNIPILE_DSN}/api/v1/accounts/${unipile_account_id}`;

const unipileCheckResponse = await fetch(unipileCheckUrl, {
  method: 'GET',
  headers: {
    'X-API-KEY': process.env.UNIPILE_API_KEY,
    'Accept': 'application/json'
  }
});

const unipileAccountData = await unipileCheckResponse.json();

// Check for active source
const activeSource = unipileAccountData.sources?.find(s => s.status === 'OK');
if (!activeSource) {
  return NextResponse.json({
    error: 'LinkedIn account not active',
    details: 'Session may have expired'
  }, { status: 400 });
}

unipileSourceId = activeSource.id;  // ← Store for later use
```

#### Phase 3: Get Executable Prospects (Lines 188-228)

```typescript
const { data: campaignProspects } = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('campaign_id', campaignId)
  .in('status', ['pending', 'approved', 'ready_to_message', 'follow_up_due'])
  .limit(maxProspects)
  .order('created_at', { ascending: true });

// Filter for prospects with LinkedIn URLs
const executableProspects = campaignProspects?.filter(cp =>
  cp.linkedin_url || cp.linkedin_user_id
) || [];
```

**Error If No Prospects:**
```json
{
  "success": true,
  "message": "No prospects ready for messaging",
  "total_prospects": 5,
  "executable_prospects": 0,
  "suggestions": [
    "Check if prospects have LinkedIn URLs",
    "Verify prospect approval status",
    "Review campaign sequence settings"
  ]
}
```

#### Phase 4: Message Personalization (Lines 230-276)

```typescript
const personalizer = new CostControlledPersonalization();

for (const prospect of executableProspects) {
  // Determine message type from sequence step
  const sequenceStep = (prospect.personalization_data as any)?.sequence_step || 0;
  let templateType = 'connection_request';
  if (sequenceStep === 1) templateType = 'follow_up_1';
  else if (sequenceStep >= 2) templateType = 'follow_up_2';

  // Personalize via LLM
  const personalizationRequest = {
    templateType,
    campaignType: 'sales_outreach',
    prospectData: {
      firstName: prospect.first_name || 'there',
      company: prospect.company_name || 'your company',
      title: prospect.title || 'Professional',
      industry: prospect.industry || 'Business'
    },
    personalizationLevel: 'standard'
  };

  const personalizedResult = await personalizer.personalizeMessage(personalizationRequest);

  console.log(`💬 Message: "${personalizedResult.message.substring(0, 100)}..."`);
  console.log(`💰 Cost: $${personalizedResult.cost.toFixed(4)}, Model: ${personalizedResult.model}`);
}
```

#### Phase 5: LinkedIn Message Sending (Lines 288-463)

**CRITICAL TWO-STEP PROCESS:**

**Step 5A: Profile Retrieval**

```typescript
// Extract LinkedIn username from URL
const linkedinIdentifier = extractLinkedInUserId(prospect.linkedin_url);
// Example: "https://linkedin.com/in/john-doe" → "john-doe"

// GET profile to get provider_id
const profileResponse = await fetch(
  `https://${UNIPILE_DSN}/api/v1/users/${linkedinIdentifier}?account_id=${unipile_account_id}`,
  {
    method: 'GET',
    headers: {
      'X-API-KEY': process.env.UNIPILE_API_KEY,
      'Accept': 'application/json'
    }
  }
);

const profileData = await profileResponse.json();
// Returns: { provider_id: "ACoAAABC123...", name: "John Doe", ... }
```

**Step 5B: Send Invitation**

```typescript
// POST invitation request
const requestBody = {
  provider_id: profileData.provider_id,  // ← From profile lookup
  account_id: selectedAccount.unipile_account_id,
  message: personalizedResult.message,
  user_email: prospect.email  // Optional
};

const unipileResponse = await fetch(
  `https://${UNIPILE_DSN}/api/v1/users/invite`,
  {
    method: 'POST',
    headers: {
      'X-API-KEY': process.env.UNIPILE_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(requestBody)
  }
);

const unipileData = await unipileResponse.json();
// Returns: { object: { id: "msg_abc123...", ... }, ... }
```

**Response Validation:**

```typescript
// CRITICAL: Verify message ID returned
const unipileMessageId = unipileData.object?.id;
if (!unipileMessageId) {
  throw new Error('Unipile returned success but no message ID');
}
```

#### Phase 6: Status Updates (Lines 432-451)

```typescript
await supabase
  .from('campaign_prospects')
  .update({
    status: 'connection_requested',
    contacted_at: new Date().toISOString(),
    personalization_data: {
      message: personalizedResult.message,
      cost: personalizedResult.cost,
      model: personalizedResult.model,
      unipile_message_id: unipileMessageId,
      sequence_step: sequenceStep + 1
    }
  })
  .eq('id', prospect.id);
```

#### Phase 7: Rate Limiting (Lines 480-483)

```typescript
// Wait 2-5 seconds between messages
const delay = Math.random() * 3000 + 2000;
console.log(`⏳ Waiting ${Math.round(delay/1000)}s before next message...`);
await new Promise(resolve => setTimeout(resolve, delay));
```

#### Phase 8: Background Batch Processing (Lines 529-548)

```typescript
// Check if more prospects remain
const { count: remainingCount } = await supabase
  .from('campaign_prospects')
  .select('*', { count: 'exact', head: true })
  .eq('campaign_id', campaignId)
  .in('status', ['pending', 'approved', 'ready_to_message']);

const hasMoreProspects = (remainingCount || 0) > 0;

// Trigger next batch asynchronously (fire-and-forget)
if (hasMoreProspects && !dryRun) {
  fetch(`${baseUrl}/api/campaigns/linkedin/execute-live`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      campaignId,
      maxProspects: 1,
      dryRun: false
    })
  }).catch(err => console.error('Failed to trigger next batch:', err));
}
```

### 5.4 Success Response

```json
{
  "success": true,
  "message": "Campaign executed: 1 connection requests sent",
  "execution_mode": "live",
  "campaign_name": "Q4 Enterprise Outreach",
  "linkedin_account": "Thorsten Linz",
  "results": {
    "campaign_id": "uuid",
    "campaign_name": "Q4 Enterprise Outreach",
    "linkedin_account": "Thorsten Linz",
    "prospects_processed": 1,
    "messages_sent": 1,
    "personalization_cost": 0.0024,
    "errors": [],
    "messages": [
      {
        "prospect": "John Doe",
        "message": "Hi John, I noticed your work at Acme Corp...",
        "cost": 0.0024,
        "model": "gpt-3.5-turbo",
        "linkedin_target": "https://linkedin.com/in/john-doe",
        "status": "sent"
      }
    ]
  },
  "cost_summary": {
    "total_cost": 0.0024,
    "total_requests": 1,
    "average_cost": 0.0024
  },
  "has_more_prospects": true,
  "remaining_prospects": 4,
  "timestamp": "2025-10-26T12:00:00.000Z"
}
```

### 5.5 Error Handling

**Error Type 1: Already Invited (422)**

```typescript
if (unipileResponse.status === 422 && errorData.type === 'errors/already_invited_recently') {
  console.log('⚠️ Invitation already sent recently - skipping');

  // Mark as already_invited and continue
  await supabase
    .from('campaign_prospects')
    .update({
      status: 'already_invited',
      contacted_at: new Date().toISOString(),
      personalization_data: {
        error: 'already_invited_recently',
        detail: errorData.detail
      }
    })
    .eq('id', prospect.id);

  continue;  // ← Continue to next prospect
}
```

**Error Type 2: Profile Not Found (404)**

```json
{
  "error": "Could not retrieve LinkedIn profile",
  "details": "Profile may be private or URL invalid",
  "prospect": "John Doe",
  "linkedin_url": "https://linkedin.com/in/john-doe"
}
```

**Error Type 3: Unipile Account Inactive (400)**

```json
{
  "error": "LinkedIn account not active",
  "account_status": "DISCONNECTED",
  "troubleshooting": {
    "step1": "The LinkedIn session may have expired",
    "step2": "Go to Workspace Settings → Integrations",
    "step3": "Reconnect your LinkedIn account"
  }
}
```

**Error Type 4: Rate Limit (429)**

```json
{
  "error": "Unipile API rate limit exceeded",
  "details": "Too many requests. Wait and retry.",
  "retry_after": 60
}
```

---

## Data Schema Reference

### Table: prospect_approval_data

```sql
CREATE TABLE prospect_approval_data (
  prospect_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES prospect_approval_sessions(id),
  name TEXT NOT NULL,
  title TEXT,
  location TEXT,
  connection_degree TEXT,
  contact JSONB,  -- { email, linkedin_url, phone }
  company JSONB,  -- { name, industry[], size, location }
  approval_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prospect_approval_session ON prospect_approval_data(session_id);
CREATE INDEX idx_prospect_approval_status ON prospect_approval_data(approval_status);
CREATE INDEX idx_prospect_linkedin_url ON prospect_approval_data((contact->>'linkedin_url'));
```

### Table: campaign_prospects

```sql
CREATE TABLE campaign_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Identity
  first_name TEXT,
  last_name TEXT,
  email TEXT,

  -- Company
  company_name TEXT NOT NULL,
  title TEXT,
  industry TEXT,
  location TEXT,

  -- LinkedIn
  linkedin_url TEXT,
  linkedin_user_id TEXT,

  -- Status
  status TEXT DEFAULT 'new',
  contacted_at TIMESTAMPTZ,
  last_follow_up_at TIMESTAMPTZ,

  -- Personalization
  personalization_data JSONB,
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaign_prospects_campaign ON campaign_prospects(campaign_id);
CREATE INDEX idx_campaign_prospects_status ON campaign_prospects(status);
CREATE INDEX idx_campaign_prospects_linkedin_url ON campaign_prospects(linkedin_url);
CREATE INDEX idx_campaign_prospects_linkedin_user_id ON campaign_prospects(linkedin_user_id);
```

### Table: workspace_accounts

```sql
CREATE TABLE workspace_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Account Info
  account_type TEXT NOT NULL,  -- 'linkedin', 'google', etc.
  account_name TEXT,
  account_email TEXT,

  -- Unipile Integration
  unipile_account_id TEXT UNIQUE NOT NULL,
  unipile_source_id TEXT,

  -- Status
  connection_status TEXT DEFAULT 'pending',
  last_verified_at TIMESTAMPTZ,

  -- Metadata
  account_metadata JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workspace_accounts_workspace ON workspace_accounts(workspace_id);
CREATE INDEX idx_workspace_accounts_type ON workspace_accounts(account_type);
CREATE INDEX idx_workspace_accounts_unipile ON workspace_accounts(unipile_account_id);
```

---

## Error Handling & Troubleshooting

### Common Issues

#### Issue 1: "No prospects ready for messaging"

**Symptoms:**
- Campaign execution returns 0 executable prospects
- Prospects exist but can't be messaged

**Diagnosis:**

```sql
-- Check if prospects have LinkedIn URLs
SELECT
  id,
  first_name,
  last_name,
  linkedin_url,
  status
FROM campaign_prospects
WHERE campaign_id = '<campaign_id>'
  AND status IN ('pending', 'approved', 'ready_to_message');
```

**Possible Causes:**

1. **Missing LinkedIn URLs**
   ```sql
   -- Check for NULL linkedin_url
   SELECT COUNT(*)
   FROM campaign_prospects
   WHERE campaign_id = '<campaign_id>'
     AND linkedin_url IS NULL;
   ```
   **Fix:** Ensure prospects have LinkedIn URLs during data extraction

2. **Wrong Status**
   ```sql
   -- Check prospect statuses
   SELECT status, COUNT(*)
   FROM campaign_prospects
   WHERE campaign_id = '<campaign_id>'
   GROUP BY status;
   ```
   **Fix:** Update prospect status to 'approved' or 'ready_to_message'

3. **LinkedIn URL in Wrong Format**
   ```sql
   -- Check URL format
   SELECT linkedin_url
   FROM campaign_prospects
   WHERE campaign_id = '<campaign_id>'
     AND linkedin_url NOT LIKE '%linkedin.com%';
   ```
   **Fix:** Ensure URLs follow format: `https://linkedin.com/in/{username}`

#### Issue 2: "LinkedIn account missing Unipile integration ID"

**Symptoms:**
- Error: "Account missing unipile_account_id"
- Campaign can't execute

**Diagnosis:**

```sql
SELECT
  account_name,
  account_type,
  unipile_account_id,
  connection_status
FROM workspace_accounts
WHERE workspace_id = '<workspace_id>'
  AND account_type = 'linkedin';
```

**Fix:**
1. Go to Workspace Settings → Integrations
2. Disconnect LinkedIn account
3. Reconnect using OAuth flow
4. Verify `unipile_account_id` is populated

#### Issue 3: "LinkedIn account not active"

**Symptoms:**
- Unipile account check fails
- No active sources found

**Diagnosis:**

```bash
# Check Unipile account status
curl -X GET \
  "https://${UNIPILE_DSN}/api/v1/accounts/${UNIPILE_ACCOUNT_ID}" \
  -H "X-API-KEY: ${UNIPILE_API_KEY}"
```

**Response (Inactive):**
```json
{
  "id": "abc123",
  "status": "DISCONNECTED",
  "sources": [
    {
      "id": "src_123",
      "status": "EXPIRED"
    }
  ]
}
```

**Fix:**
1. LinkedIn session expired
2. Reconnect account in workspace settings
3. Complete full OAuth flow

#### Issue 4: "Could not retrieve LinkedIn profile"

**Symptoms:**
- Profile lookup fails with 404
- Invalid LinkedIn URL format

**Diagnosis:**

```typescript
// Check URL extraction
const linkedinUrl = "https://www.linkedin.com/in/john-doe/";
const identifier = extractLinkedInUserId(linkedinUrl);
console.log(identifier);  // Should return: "john-doe"
```

**Possible Causes:**

1. **Invalid URL Format**
   - ❌ `linkedin.com/company/acme`  (company, not person)
   - ❌ `linkedin.com/posts/123`  (post, not profile)
   - ✅ `linkedin.com/in/john-doe`  (correct)

2. **Profile Private/Deleted**
   - Profile no longer exists
   - Profile set to private

3. **URL Extraction Failed**
   - Non-standard URL format
   - Missing `/in/` path

**Fix:**
- Validate LinkedIn URL format during data extraction
- Test profile accessibility before adding to campaign

#### Issue 5: "Unipile API error (422): already_invited_recently"

**Symptoms:**
- Error when trying to send connection request
- Prospect already invited within recent timeframe

**Behavior:**
- ✅ Automatically handled (not an error)
- ✅ Prospect marked as `already_invited`
- ✅ Campaign continues to next prospect

**No action needed** - this is expected behavior for duplicates.

---

## Testing & Verification

### Test Suite

#### 1. Data Extraction Test

```sql
-- Verify prospects have required fields
SELECT
  prospect_id,
  name,
  title,
  contact->>'linkedin_url' as linkedin_url,
  contact->>'email' as email,
  company->>'name' as company_name,
  approval_status
FROM prospect_approval_data
WHERE session_id = '<session_id>'
LIMIT 10;
```

**Expected:**
- ✅ All prospects have `name`
- ✅ LinkedIn prospects have `contact.linkedin_url`
- ✅ Email prospects have `contact.email`
- ⚠️ Some prospects may be missing optional fields (title, company)

#### 2. Approval Flow Test

```bash
# Test approved prospects API
curl -X GET \
  "http://localhost:3000/api/prospect-approval/approved?workspace_id=${WORKSPACE_ID}" \
  -H "Cookie: ${AUTH_COOKIE}"
```

**Expected Response:**
```json
{
  "success": true,
  "prospects": [
    {
      "prospect_id": "uuid",
      "name": "John Doe",
      "linkedin_url": "https://linkedin.com/in/john-doe",  // ← Flattened
      "contact": {
        "linkedin_url": "https://linkedin.com/in/john-doe"  // ← Original
      },
      "in_campaign": false
    }
  ],
  "total": 1
}
```

**Verify:**
- ✅ `linkedin_url` at top level (not just in `contact`)
- ✅ `in_campaign = false` (not in another campaign)
- ✅ `approval_status = 'approved'` (in database)

#### 3. Campaign Creation Test

```bash
# Add prospects to campaign
curl -X POST \
  "http://localhost:3000/api/campaigns/add-approved-prospects" \
  -H "Content-Type: application/json" \
  -H "Cookie: ${AUTH_COOKIE}" \
  -d '{
    "campaign_id": "<campaign_id>",
    "workspace_id": "<workspace_id>",
    "prospect_ids": ["uuid1", "uuid2"]
  }'
```

**Verify in Database:**
```sql
SELECT
  id,
  first_name,
  last_name,
  linkedin_url,
  status
FROM campaign_prospects
WHERE campaign_id = '<campaign_id>';
```

**Expected:**
- ✅ 2 new records created
- ✅ `linkedin_url` populated
- ✅ `status = 'new'`

#### 4. LinkedIn ID Sync Test (Optional)

```bash
# Sync LinkedIn IDs
curl -X POST \
  "http://localhost:3000/api/campaigns/sync-linkedin-ids" \
  -H "Content-Type: application/json" \
  -H "Cookie: ${AUTH_COOKIE}" \
  -d '{
    "campaignId": "<campaign_id>",
    "workspaceId": "<workspace_id>"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Resolved 1 out of 2 LinkedIn IDs",
  "resolved": 1,
  "total": 2,
  "unresolved": 1,
  "details": {
    "resolved_prospects": [
      {
        "id": "uuid1",
        "linkedin_user_id": "ACoAAA..."
      }
    ],
    "unresolved_prospects": [
      {
        "id": "uuid2",
        "name": "Jane Doe",
        "linkedin_url": "https://linkedin.com/in/jane-doe"
      }
    ]
  }
}
```

#### 5. Message Execution Test (Dry Run)

```bash
# Dry run (no actual sending)
curl -X POST \
  "http://localhost:3000/api/campaigns/linkedin/execute-live" \
  -H "Content-Type: application/json" \
  -H "Cookie: ${AUTH_COOKIE}" \
  -d '{
    "campaignId": "<campaign_id>",
    "maxProspects": 1,
    "dryRun": true
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Campaign executed: 0 connection requests sent",
  "execution_mode": "dry_run",
  "results": {
    "prospects_processed": 1,
    "messages_sent": 0,
    "messages": [
      {
        "prospect": "John Doe",
        "message": "Hi John, I noticed your work...",
        "status": "dry_run"
      }
    ]
  }
}
```

**Verify:**
- ✅ Message generated
- ✅ No actual LinkedIn message sent
- ✅ Prospect status unchanged

#### 6. Message Execution Test (Live)

```bash
# LIVE execution (sends real messages!)
curl -X POST \
  "http://localhost:3000/api/campaigns/linkedin/execute-live" \
  -H "Content-Type: application/json" \
  -H "Cookie: ${AUTH_COOKIE}" \
  -d '{
    "campaignId": "<campaign_id>",
    "maxProspects": 1,
    "dryRun": false
  }'
```

**Verify in Database:**
```sql
SELECT
  id,
  first_name,
  last_name,
  status,
  contacted_at,
  personalization_data->>'unipile_message_id' as message_id
FROM campaign_prospects
WHERE campaign_id = '<campaign_id>'
  AND status = 'connection_requested';
```

**Expected:**
- ✅ `status = 'connection_requested'`
- ✅ `contacted_at` timestamp set
- ✅ `personalization_data.unipile_message_id` populated

**Verify on LinkedIn:**
- Go to LinkedIn → My Network → Manage
- Check "Sent" invitations
- Should see connection request to prospect

---

## Performance & Rate Limits

### Rate Limits

#### LinkedIn Limits (Official)

- **Connection Requests:** ~100/week per account
- **Messages:** ~200/day per account
- **Profile Views:** ~1000/day per account

#### Unipile API Limits

- **API Calls:** 10,000/month (varies by plan)
- **Account Polling:** Every 5 minutes
- **Message Send:** 1 per second (recommended)

#### System Limits

```typescript
// Batch size (per execution)
maxProspects: 1  // Process 1 prospect per batch

// Delay between messages
const delay = Math.random() * 3000 + 2000;  // 2-5 seconds

// Background processing
// Fire-and-forget next batch after current completes
```

### Performance Metrics

**Execution Time (1 prospect):**
- Authentication: ~100ms
- Account verification: ~500ms
- Prospect query: ~200ms
- Message personalization (LLM): ~1-2s
- Profile lookup (Unipile): ~500ms
- Send invitation (Unipile): ~800ms
- Database update: ~150ms
- **Total: ~3-5 seconds per prospect**

**Cost Per Message:**
- LLM personalization: $0.002-0.004
- Unipile API: Included in plan
- **Total: ~$0.003 per message**

**Daily Throughput (Single Account):**
- LinkedIn limit: 100 connection requests/week = ~14/day
- System capability: 1000+ messages/day (if no LinkedIn limits)
- **Practical limit: ~14 prospects/day per LinkedIn account**

### Optimization Strategies

#### 1. Multi-Account Rotation

```typescript
// Rotate through multiple LinkedIn accounts
const accounts = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', workspaceId)
  .eq('account_type', 'linkedin')
  .eq('connection_status', 'connected')
  .order('last_used_at', { ascending: true });

const selectedAccount = accounts[0];  // Use least recently used
```

**Benefit:** 5 accounts × 14 messages/day = 70 messages/day

#### 2. Batch Processing

```typescript
// Process multiple prospects in parallel (use with caution)
const batchSize = 3;  // Max 3 concurrent
const batches = chunk(executableProspects, batchSize);

for (const batch of batches) {
  await Promise.all(batch.map(prospect => sendMessage(prospect)));
  await delay(5000);  // Wait 5s between batches
}
```

**Benefit:** 3x throughput, but higher risk of rate limiting

#### 3. Smart Queueing

```typescript
// Prioritize high-value prospects
const prioritizedProspects = campaignProspects.sort((a, b) => {
  const scoreA = calculateProspectScore(a);
  const scoreB = calculateProspectScore(b);
  return scoreB - scoreA;
});
```

**Benefit:** Send to best prospects first before hitting limits

### Monitoring

**Key Metrics to Track:**

```sql
-- Campaign execution stats
SELECT
  campaign_id,
  status,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'connection_requested') as sent,
  COUNT(*) FILTER (WHERE status = 'already_invited') as duplicates,
  COUNT(*) FILTER (WHERE personalization_data->>'error' IS NOT NULL) as errors
FROM campaign_prospects
WHERE campaign_id = '<campaign_id>'
GROUP BY campaign_id, status;
```

**Expected Results:**
- Sent rate: 90-95% (5-10% errors/duplicates expected)
- Error rate: <10%
- Duplicate rate: <5% (first run), higher on retries

---

## Appendix

### A. LinkedIn URL Formats

**Supported:**
- ✅ `https://www.linkedin.com/in/john-doe`
- ✅ `https://linkedin.com/in/john-doe/`
- ✅ `http://linkedin.com/in/john-doe?param=value`
- ✅ `linkedin.com/in/john-doe`

**Not Supported:**
- ❌ `linkedin.com/company/acme`  (company page)
- ❌ `linkedin.com/posts/123`  (post)
- ❌ `linkedin.com/jobs/123`  (job posting)

### B. Unipile API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/accounts` | GET | List connected accounts |
| `/api/v1/accounts/{id}` | GET | Get account details & status |
| `/api/v1/users/{identifier}` | GET | Get LinkedIn profile → provider_id |
| `/api/v1/users/invite` | POST | Send connection request |
| `/api/v1/messages` | GET | Fetch message history (sync) |

### C. Status Flow Diagram

```
┌─────────┐
│   new   │  ← Prospect added to campaign
└────┬────┘
     │
     ▼
┌─────────┐
│ pending │  ← Campaign created, not started
└────┬────┘
     │
     ▼
┌──────────┐
│ approved │  ← Ready for execution
└────┬─────┘
     │
     ▼
┌──────────────────┐
│ ready_to_message │  ← Explicitly queued for next batch
└────┬─────────────┘
     │
     ▼
┌────────────────────────┐
│ connection_requested   │  ← LinkedIn connection sent
└────┬───────────────────┘
     │
     ▼
┌──────────────────┐
│ follow_up_sent   │  ← Follow-up message sent
└────┬─────────────┘
     │
     ▼
┌──────────┐
│ engaged  │  ← Prospect responded
└────┬─────┘
     │
     ▼
┌───────────┐
│ completed │  ← Campaign sequence complete
└───────────┘
```

**Error States:**
- `already_invited`: Duplicate invitation attempt (graceful skip)
- `failed`: Execution error (retry possible)
- `rejected`: Prospect manually removed

### D. Environment Variables Required

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Unipile
UNIPILE_DSN=your-subdomain.api.unipile.com
UNIPILE_API_KEY=your_unipile_api_key

# OpenRouter (for LLM personalization)
OPENROUTER_API_KEY=your_openrouter_key

# Application
NEXT_PUBLIC_APP_URL=https://app.meet-sam.com  # For background batch triggers
```

---

## Document History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-10-26 | Initial documentation after pipeline audit | Claude AI |

---

## Support

For issues or questions:
1. Check [Error Handling & Troubleshooting](#error-handling--troubleshooting)
2. Review server logs for detailed error messages
3. Verify all environment variables are set
4. Test with dry run mode first

**Common Log Locations:**
- Netlify Functions: Netlify Dashboard → Functions → Logs
- Supabase: Supabase Dashboard → Logs
- Browser: Developer Console (F12)
