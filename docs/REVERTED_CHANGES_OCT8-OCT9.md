# Reverted Changes: Oct 8-9, 2025

**Date Range:** October 8, 2025 14:42 PST → October 9, 2025
**Restore Point:** Commit `10e4534` - "fix: import missing campaign hub icons"
**Total Commits Reverted:** 90+ commits

This document details ALL changes that were made after the Oct 8 restore point and subsequently reverted due to persistent loading bubble issues. Use this as a reference to carefully re-implement these features.

---

## Table of Contents
1. [Infrastructure & DevOps](#infrastructure--devops)
2. [Security & Data Isolation](#security--data-isolation)
3. [Campaign Management](#campaign-management)
4. [LinkedIn Integration](#linkedin-integration)
5. [SAM AI Improvements](#sam-ai-improvements)
6. [CSV & Data Import](#csv--data-import)
7. [Authentication & Email](#authentication--email)
8. [UI/UX Bug Fixes](#uiux-bug-fixes-that-caused-problems)
9. [What NOT to Recreate](#what-not-to-recreate)

---

## Infrastructure & DevOps

### Restore Point System (✅ Safe to Recreate)
**Commits:** b769600, afc095d
**Files Added:**
- `.github/workflows/verify-imports.yml` (later removed)
- `RESTORE_POINTS_GUIDE.md` (403 lines)
- `package.json` - added restore-point scripts
- `scripts/list-restore-points.sh`
- `scripts/restore-point.sh` (192 lines)
- `scripts/verify-imports.js` → `verify-imports.cjs`
- `scripts/cleanup-unused-imports.js` → `cleanup-unused-imports.cjs`

**What It Did:**
- Created automated restore point system for project snapshots
- Added git bundle + uncommitted changes backup
- Automated restore script with safety checks

**How to Recreate:**
1. Copy `scripts/restore-point.sh` from commit b769600
2. Add npm scripts to package.json:
```json
{
  "scripts": {
    "restore-point": "bash scripts/restore-point.sh",
    "list-restore-points": "bash scripts/list-restore-points.sh"
  }
}
```

---

## Security & Data Isolation

### Critical Data Bleeding Fix (⚠️ URGENT - Recreate First)
**Commits:** a7e1cc5, 2c2e43d, fcee3d5, b0c3adc, 50b5b5e, 031c64a, de335b1
**Problem:** Workspace data was bleeding across tenants

**Files Created:**
- `docs/DATA_BLEEDING_FIX_URGENT.md` (214 lines)
- `docs/QUICK_VERIFICATION_QUERIES.md` (218 lines)
- `sql/audit-data-separation.sql` (224 lines)
- `sql/fix-data-bleeding-urgent.sql` (99 lines)
- `sql/ensure-complete-workspace-isolation.sql` (243 lines)
- `app/api/admin/verify-data-separation/route.ts` (140 lines)
- `app/api/admin/sync-unipile-accounts/route.ts` (230 lines)

**Files Modified:**
- `app/api/knowledge-base/data/route.ts` - Fixed workspace_id filter
- `app/api/sam/data-sources/route.ts` - Added workspace isolation

**Critical Fixes:**
1. **Knowledge Base API** - Was returning all workspaces' knowledge:
```typescript
// BEFORE (WRONG):
const { data } = await supabase
  .from('knowledge_base')
  .select('*');

// AFTER (CORRECT):
const { data } = await supabase
  .from('knowledge_base')
  .select('*')
  .eq('workspace_id', workspaceId);
```

2. **SAM Data Sources** - Was querying without workspace filter:
```typescript
// BEFORE (WRONG):
const { data } = await supabase
  .from('data_sources')
  .select('*');

// AFTER (CORRECT):
const { data } = await supabase
  .from('workspace_members')
  .select('workspace_id')
  .eq('user_id', user.id)
  .single();

const { data: sources } = await supabase
  .from('data_sources')
  .select('*')
  .eq('workspace_id', workspace.workspace_id);
```

**How to Recreate:**
1. Apply SQL fixes from `sql/ensure-complete-workspace-isolation.sql`
2. Update all API routes to filter by workspace_id
3. Run verification: `sql/audit-data-separation.sql`
4. Test with multiple workspaces to ensure no data leakage

---

### Stripe Subscription Management (✅ Safe to Recreate)
**Commits:** 1db8c07, 57fda24
**Files Added:**
- `app/api/webhooks/stripe/route.ts` (435 lines) - Full webhook handler
- `app/api/admin/cleanup-duplicates/route.ts` (236 lines)
- `app/admin/duplicate-cleanup/page.tsx` (307 lines)
- `lib/workspace-access.ts` (155 lines) - Tier-based feature access
- `netlify/functions/scheduled-duplicate-cleanup.ts` (62 lines)
- `scripts/setup-stripe-webhook.sh` (97 lines)
- `sql/add-subscription-tracking.sql` (103 lines)
- `sql/create-duplicate-detection-functions.sql` (120 lines)

**Documentation Created:**
- `docs/AUTOMATED_DUPLICATE_CLEANUP.md` (419 lines)
- `docs/DEPLOYMENT_CHECKLIST_STRIPE_WEBHOOK.md` (267 lines)
- `docs/PRODUCTION_WEBHOOK_SETUP.md` (241 lines)
- `docs/STRIPE_SUBSCRIPTION_CANCELLATION.md` (478 lines)
- `docs/STRIPE_WEBHOOK_SETUP_INSTRUCTIONS.md` (320 lines)

**What It Did:**
- Stripe webhook for subscription events (created, updated, cancelled)
- Automatic workspace access management based on subscription status
- Duplicate account detection and cleanup
- Scheduled cleanup function via Netlify

**How to Recreate:**
1. Apply SQL: `sql/add-subscription-tracking.sql`
2. Copy webhook handler: `app/api/webhooks/stripe/route.ts`
3. Set up Stripe webhook in dashboard → `https://app.meet-sam.com/api/webhooks/stripe`
4. Add environment variable: `STRIPE_WEBHOOK_SECRET`
5. Test with Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

---

### OAuth & Account Association (✅ Safe to Recreate)
**Commits:** 7a41c21, 45ea648, 744bef9, b9454f1, 630e40c, ee46997, 109ad68, 8b5be8b, a3f7158, 5052ce7
**Problem:** Users could sign up multiple times via LinkedIn/Google/Microsoft

**Files Added:**
- `docs/ACCOUNT_ASSOCIATION_ARCHITECTURE.md` (466 lines)
- `sql/verify-account-associations.sql` (136 lines)
- `sql/list-workspace-users.sql` (136 lines)
- `sql/find-and-cleanup-duplicate-accounts.sql` (176 lines)
- `app/email-integration/page.tsx` (250 lines) - Success page after OAuth

**Files Modified:**
- `app/api/unipile/hosted-auth/callback/route.ts` - Added duplicate detection:
```typescript
// Check if user already exists with this email
const { data: existingAuth } = await supabaseAdmin.auth.admin.listUsers();
const existingUser = existingAuth.users.find(u => u.email === email);

if (existingUser) {
  console.log('🔗 Linking OAuth account to existing user');
  // Link instead of creating new user
} else {
  console.log('✨ Creating new user account');
  // Create new user
}
```

**How to Recreate:**
1. Update OAuth callback with duplicate detection logic
2. Create email integration success page
3. Add comprehensive logging for account linking
4. Test signup flow: Email → LinkedIn → Google (should create ONE user)

---

## Campaign Management

### Remove Mock Data & Use Real APIs (✅ Safe to Recreate)
**Commits:** 9ca2264, c15d3a8, 2802a23, 26a715d, 825b34b, 7b66622, 1dbfc74, 875e355
**Problem:** Fake campaigns showing across all workspaces

**Files Modified:**
- `app/components/CampaignHub.tsx` - Removed 520+ lines of mock data
- `app/components/LeadPipeline.tsx` - Load real prospects from API
- `app/components/Analytics.tsx` - Disabled demo mode
- `app/components/KnowledgeBase.tsx` - Reset hardcoded metrics to 0

**Files Added:**
- `sql/remove-dummy-campaigns.sql` (49 lines)
- `sql/move-charissa-campaign-to-innovareai.sql` (33 lines)

**Key Changes:**

**CampaignHub.tsx:**
```typescript
// BEFORE - Hardcoded mock data (REMOVED 520 LINES):
const mockCampaigns = [
  { id: 1, name: "Q4 Enterprise Outreach", ...},
  { id: 2, name: "Healthcare Decision Makers", ...},
  // ... 8 more fake campaigns
];

// AFTER - Real API calls:
useEffect(() => {
  async function loadCampaigns() {
    const response = await fetch(`/api/campaigns?workspace_id=${workspaceId}`);
    const data = await response.json();
    setCampaigns(data.campaigns || []);
  }
  loadCampaigns();
}, [workspaceId]);
```

**LeadPipeline.tsx:**
```typescript
// BEFORE - Hardcoded 7 fake prospects
const mockProspects = [
  { id: 1, name: "CoreTech Solutions", ...},
  // ... 6 more
];

// AFTER - Real API with proper prospect_status mapping:
const { data: prospects } = await supabase
  .from('workspace_prospects')
  .select('*')
  .eq('workspace_id', workspaceId);

// Map prospect_status to pipeline stages:
const stageMapping = {
  'replied': 'Positive Replies',
  'contacted': 'Demos',
  'closed': 'Closed'
};
```

**How to Recreate:**
1. Remove all mock data arrays from components
2. Add useEffect hooks to load real data from APIs
3. Ensure all API calls include `workspace_id` filter
4. Run SQL cleanup: `sql/remove-dummy-campaigns.sql`

---

### Campaign Owner & Reassignment (✅ Safe to Recreate)
**Commits:** 84a0ff3
**Files Added:**
- `app/api/campaigns/[id]/reassign/route.ts` (87 lines)
- `supabase/migrations/20251008_add_campaign_owner.sql` (28 lines)

**Files Modified:**
- `app/api/campaigns/route.ts` - Set created_by and assigned_to on creation
- `app/components/CampaignHub.tsx` - Display assigned user name

**Migration SQL:**
```sql
-- Add campaign ownership fields
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_created_by ON campaigns(created_by);
CREATE INDEX IF NOT EXISTS idx_campaigns_assigned_to ON campaigns(assigned_to);

-- Backfill existing campaigns with workspace admin
UPDATE campaigns c
SET created_by = (
  SELECT wm.user_id
  FROM workspace_members wm
  WHERE wm.workspace_id = c.workspace_id
  AND wm.role = 'admin'
  LIMIT 1
)
WHERE created_by IS NULL;
```

**API Changes:**
```typescript
// POST /api/campaigns - Create with owner
const { data: campaign } = await supabase
  .from('campaigns')
  .insert({
    name,
    workspace_id,
    created_by: user.id,
    assigned_to: user.id,
    status: 'draft'
  })
  .select('*, created_by:users!created_by(id, email, raw_user_meta_data)')
  .single();

// PUT /api/campaigns/[id]/reassign
const { data } = await supabase
  .from('campaigns')
  .update({ assigned_to: newUserId })
  .eq('id', campaignId)
  .eq('workspace_id', workspaceId);
```

**How to Recreate:**
1. Apply migration: `20251008_add_campaign_owner.sql`
2. Create reassignment API route
3. Update campaign creation to set owners
4. Display assigned user in CampaignHub

---

### Campaign Execution & Reply Agent (⚠️ Complex - Review Carefully)
**Commits:** be9d8ce, 3a6f065
**Files Added:**
- `app/api/campaigns/[id]/approve/route.ts` (285 lines)
- `app/api/campaigns/execute/route.ts` (256 lines)
- `app/api/cron/process-follow-ups/route.ts` (374 lines)
- `app/api/follow-up-agent/approve/route.ts` (294 lines)
- `app/api/webhooks/n8n/campaign-status/route.ts` (131 lines)
- `app/api/webhooks/unipile/inbound-reply/route.ts` (296 lines)
- `lib/notifications/follow-up-approval-email.ts` (251 lines)
- `lib/notifications/hitl-approval-email.ts` (512 lines)

**Documentation:**
- `docs/CAMPAIGN_EXECUTION_WITH_REPLY_AGENT.md` (447 lines)
- `docs/CAMPAIGN_FLOW_BUILDER_INTEGRATION.md` (806 lines)
- `docs/CENTRALIZED_CAMPAIGN_EXECUTION_ARCHITECTURE.md` (477 lines)
- `docs/FOLLOW_UP_AGENT.md` (547 lines)
- `docs/LINKEDIN_CONNECTION_GUIDE.md` (345 lines)
- `docs/SAM_BYPASS_MODE.md` (184 lines)

**Migrations:**
```sql
-- supabase/migrations/20251008000000_add_bypass_mode.sql
ALTER TABLE campaigns ADD COLUMN bypass_approval BOOLEAN DEFAULT false;

-- supabase/migrations/20251008100000_campaign_history_tracking.sql
CREATE TABLE campaign_execution_history (...);
CREATE TABLE campaign_performance_summary (...);

-- supabase/migrations/20251008110000_campaign_prospects_and_approvals.sql
CREATE TABLE campaign_prospects (...);
CREATE TABLE message_approvals (...);

-- supabase/migrations/20251008120000_follow_up_agent.sql
CREATE TABLE follow_up_sequences (...);
CREATE TABLE follow_up_approvals (...);
```

**How to Recreate:**
1. Read ALL 4 documentation files first
2. Apply migrations in order (000 → 100 → 110 → 120)
3. Implement campaign approval flow
4. Create webhook handlers for N8N and Unipile
5. Implement HITL (Human-in-the-Loop) approval emails
6. Test end-to-end: Campaign → N8N → LinkedIn → Reply → Approval

---

## LinkedIn Integration

### Fix LinkedIn Search API (✅ Safe to Recreate)
**Commits:** 3fcd8d4, 41fbf57, 5dbc860, fcdd3f1, a5847c4
**Problem:** LinkedIn search was calling mock API endpoint

**Files Modified:**
- `app/campaigns/page.tsx` - Changed endpoint from `/api/unipile/linkedin-search` to `/api/linkedin/search`
- `components/DataCollectionHub.tsx` - Same endpoint change
- `app/api/sam/find-prospects/route.ts` - Added LinkedIn search option
- `app/api/linkedin/search/route.ts` - Fixed URL construction bug
- `app/api/linkedin/get-connection-ids/route.ts` - Fixed Unipile URL
- `app/api/linkedin/test-message/route.ts` - Fixed Unipile URL
- `app/api/prospects/linkedin-search/route.ts` - Fixed Unipile URL

**Critical Bug Fix:**
```typescript
// BEFORE (WRONG - Double domain):
const url = `https://${UNIPILE_DSN}.unipile.com:13443/api/v1/users/search`;
// Result: https://api6.unipile.com:13670.unipile.com:13443/... (BROKEN)

// AFTER (CORRECT):
const url = `https://${UNIPILE_DSN}/api/v1/users/search`;
// Result: https://api6.unipile.com:13670/api/v1/users/search (WORKS)
```

**Diagnostic Scripts Created:**
- `scripts/check-michelle-account.js` (51 lines)
- `scripts/check-michelle-linkedin.mjs` (79 lines)
- `scripts/diagnose-linkedin-issue.js` (156 lines)
- `scripts/test-linkedin-search.js` (205 lines)
- `scripts/verify-linkedin-deployment.sh` (83 lines)

**How to Recreate:**
1. Update all Unipile API calls to use correct URL format
2. Change frontend to call `/api/linkedin/search` instead of mock endpoint
3. Add LinkedIn search to SAM's prospect finding options
4. Test with: `NEXT_PUBLIC_SITE_URL=https://app.meet-sam.com node scripts/test-linkedin-search.js`

---

## SAM AI Improvements

### SAM Memory System (✅ Safe to Recreate)
**Commits:** 20ae1da, dbfe9e1, 556d609
**Problem:** SAM had no permanent memory between conversations

**Files Added:**
- `supabase/migrations/20251009000000_memory_system_for_threads.sql` (201 lines)
- `scripts/diagnose-sam-memory.mjs` (188 lines)
- `scripts/apply-memory-migration-direct.mjs` (206 lines)
- `scripts/apply-memory-migration.sh` (84 lines)

**Files Modified:**
- `app/api/sam/threads/[threadId]/messages/route.ts` - Disabled broken knowledge loader

**Migration Creates:**
```sql
-- Memory snapshot table
CREATE TABLE memory_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID REFERENCES sam_conversation_threads(id) ON DELETE CASCADE,
  snapshot_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User memory preferences
CREATE TABLE user_memory_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  retention_days INTEGER DEFAULT 7,
  auto_archive BOOLEAN DEFAULT true
);

-- Memory functions
CREATE FUNCTION create_memory_snapshot(p_thread_id UUID) RETURNS UUID;
CREATE FUNCTION restore_memory_snapshot(p_snapshot_id UUID) RETURNS BOOLEAN;
```

**How to Recreate:**
1. Apply migration via Supabase dashboard SQL editor
2. Verify tables exist: `scripts/diagnose-sam-memory.mjs`
3. Test snapshot creation and restoration
4. Enable knowledge context loading (was disabled at line 835-847)

---

### SAM LinkedIn Prospect Search (⚠️ Partially Working)
**Commits:** 67edec4, 89ba50d, ecb25e2, 5545c69, d6d1ef5, be287a8, dc639c0, 5a6f7aa, f010f5a, 7d78ff5, c66bbbc, 1d2dca7
**Problem:** SAM would promise to search LinkedIn but never return results

**Files Modified:**
- `app/api/sam/prospect-intelligence/route.ts` - Complete rewrite of LinkedIn search
- `app/api/sam/threads/[threadId]/messages/route.ts` - Added user_id passing

**Key Fixes:**

**1. Replaced Non-Existent MCP Tool with Real API:**
```typescript
// BEFORE (BROKEN):
const result = await callMCPTool('icp_prospect_discovery', {
  jobTitles,
  industry,
  geography
});
// Tool doesn't exist in MCP server!

// AFTER (WORKS):
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const { data: linkedinAccount } = await supabase
  .from('user_unipile_accounts')
  .select('unipile_account_id')
  .eq('user_id', user.id)
  .eq('platform', 'LINKEDIN')
  .eq('connection_status', 'active')
  .single();

const response = await fetch(`https://${UNIPILE_DSN}/api/v1/users/search`, {
  method: 'POST',
  headers: {
    'X-API-KEY': UNIPILE_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    account_id: linkedinAccount.unipile_account_id,
    keywords: jobTitles.join(' OR '),
    advanced_keywords: {
      title: jobTitles.join(' OR ')
    },
    limit: 20
  })
});
```

**2. Fixed Server-to-Server Authentication:**
```typescript
// Messages route passes user_id to prospect-intelligence API
const intelligenceResponse = await fetch('/api/sam/prospect-intelligence', {
  method: 'POST',
  body: JSON.stringify({
    type: 'icp_research_search',
    data: { jobTitles, geography, connectionDegree },
    user_id: user.id // Pass user ID for server-side auth
  })
});

// Prospect intelligence accepts user_id instead of cookies
const user_id = body.user_id;
const user = user_id
  ? { id: user_id }
  : await getUserFromCookies(); // Fallback
```

**3. Expanded Trigger Keywords:**
```typescript
const icpKeywords = [
  'find prospects', 'search linkedin', 'linkedin search',
  'my connections', 'my network', 'connections', 'network',
  '1st degree', '2nd degree', '3rd degree',
  'look into', 'check my', 'from my',
  'startup', 'startups', 'seo', 'marketing', 'sales'
];
```

**4. Smarter Job Title Generation:**
```typescript
// Extract keywords and generate variations
function generateJobTitles(keyword) {
  const variations = [
    `${keyword} Manager`,
    `${keyword} Director`,
    `${keyword} Specialist`,
    `Head of ${keyword}`,
    keyword
  ];
  return variations;
}
```

**Scripts Created:**
- `scripts/test-sam-linkedin-search.mjs` - End-to-end test
- `scripts/test-marketing-connections.mjs` - Test connection search
- `scripts/stress-test-1000-prospects.mjs` - Load testing
- `scripts/stress-test-with-pagination.mjs` - Pagination test

**How to Recreate:**
1. Update `app/api/sam/prospect-intelligence/route.ts` with real Unipile integration
2. Pass user_id from messages route to prospect intelligence API
3. Add expanded keyword detection
4. Implement smart job title extraction
5. Test with: `node scripts/test-sam-linkedin-search.mjs`

---

### SAM Pagination Support (✅ Safe to Recreate)
**Commits:** fe7e3dd, e228215, fe74c7b
**Problem:** LinkedIn returns max 50 results, need to handle 1000+ prospects

**Files Modified:**
- `app/api/sam/prospect-intelligence/route.ts` - Increased maxResults from 50 to 1000
- `components/DataApprovalPanel.tsx` - Added pagination UI (50 per page)

**Pagination Implementation:**
```typescript
// DataApprovalPanel.tsx
const [currentPage, setCurrentPage] = useState(1);
const itemsPerPage = 50;
const totalPages = Math.ceil(prospects.length / itemsPerPage);

const paginatedProspects = prospects.slice(
  (currentPage - 1) * itemsPerPage,
  currentPage * itemsPerPage
);

// Render only 50 prospects at a time for performance
{paginatedProspects.map(prospect => (
  <ProspectCard key={prospect.id} prospect={prospect} />
))}

// Pagination controls
<div className="flex justify-between">
  <button onClick={() => setCurrentPage(1)}>First</button>
  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>Previous</button>
  <span>Page {currentPage} of {totalPages}</span>
  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>Next</button>
  <button onClick={() => setCurrentPage(totalPages)}>Last</button>
</div>
```

**Stress Test Results:**
- Single API call: Max 50 prospects (Unipile limit)
- 20 API calls with different job titles: 964 unique prospects
- Deduplication by LinkedIn URL: Only 36 duplicates (3.6%)
- Total time: 100.9s (5s avg per call)
- UI renders 50 at a time for smooth performance

**How to Recreate:**
1. Add page state to DataApprovalPanel
2. Implement pagination controls (First/Prev/Next/Last)
3. Slice prospects array by page
4. Add "Showing X-Y of Z" indicator
5. Test with 1000+ prospects

---

## CSV & Data Import

### CSV Security & Field Support (✅ Safe to Recreate)
**Commits:** 16e9838, ecce2ec, 7ca8e48, e6755f4
**Files Modified:**
- `app/components/KnowledgeBase.tsx` - Better error handling
- `app/api/prospects/csv-upload/route.ts` - Support spaces in headers, add security
- Added fields: Industry, Company LinkedIn URL, Website

**Key Changes:**

**1. Support Spaces in Column Headers:**
```typescript
// BEFORE (BROKEN):
const firstName = row['First Name']; // undefined if spaces

// AFTER (WORKS):
function normalizeKey(key) {
  return key.trim().toLowerCase().replace(/\s+/g, '_');
}
const firstName = row[normalizeKey('First Name')]; // works!
```

**2. CSV Sanitization for Security:**
```typescript
function sanitizeCSVValue(value) {
  if (typeof value !== 'string') return value;

  // Remove formula injection characters
  if (value.startsWith('=') || value.startsWith('+') ||
      value.startsWith('-') || value.startsWith('@')) {
    return value.substring(1);
  }

  // Remove dangerous HTML/JS
  return value
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
}
```

**3. Added New CSV Fields:**
```typescript
const prospect = {
  first_name: sanitizeCSVValue(row.first_name),
  last_name: sanitizeCSVValue(row.last_name),
  email: sanitizeCSVValue(row.email),
  company: sanitizeCSVValue(row.company),
  title: sanitizeCSVValue(row.title),
  industry: sanitizeCSVValue(row.industry), // NEW
  linkedin_url: sanitizeCSVValue(row.linkedin_url || row.linkedin_profile_url), // NEW
  website: sanitizeCSVValue(row.website || row.company_website), // NEW
  phone: sanitizeCSVValue(row.phone),
  location: sanitizeCSVValue(row.location)
};
```

**4. Better Error Handling:**
```typescript
// Show detailed error messages to user
try {
  const response = await fetch('/api/prospects/csv-upload', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const error = await response.json();
    toastError(`CSV Upload Failed: ${error.details || error.error}`);
    console.error('CSV Upload Error:', error);
  }
} catch (err) {
  toastError('Network error uploading CSV');
  console.error('Upload error:', err);
}
```

**How to Recreate:**
1. Add CSV sanitization function
2. Normalize column header keys (support spaces)
3. Add new fields to prospect schema
4. Improve error messages in UI
5. Test with malicious CSV (formula injection, XSS)

---

## Authentication & Email

### Custom Email Verification (✅ Safe to Recreate)
**Commits:** bae443a, a725bca
**Files Added:**
- `app/api/auth/verify/route.ts` (203 lines)
- `lib/auth/email-verification.ts` (267 lines)
- `supabase/migrations/20251008130000_custom_email_verification.sql` (44 lines)

**Files Modified:**
- `app/api/auth/signup/route.ts` - Simplified to use email-verification lib
- `app/api/auth/reset-password/route.ts` - Use Postmark for password reset

**Migration:**
```sql
CREATE TABLE email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_email_verification_token ON email_verification_tokens(token);
CREATE INDEX idx_email_verification_expires ON email_verification_tokens(expires_at);
```

**Email Verification Flow:**
```typescript
// 1. Send verification email (Postmark)
import { sendVerificationEmail } from '@/lib/auth/email-verification';

await sendVerificationEmail({
  email: user.email,
  token: verificationToken,
  firstName: user.user_metadata?.first_name
});

// 2. User clicks link → /api/auth/verify?token=abc123
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  // Verify token in database
  const { data: tokenRecord } = await supabase
    .from('email_verification_tokens')
    .select('*')
    .eq('token', token)
    .eq('used', false)
    .gte('expires_at', new Date().toISOString())
    .single();

  if (!tokenRecord) {
    return new Response('Invalid or expired token', { status: 400 });
  }

  // Mark email as verified
  await supabase.auth.admin.updateUserById(tokenRecord.user_id, {
    email_confirmed_at: new Date().toISOString()
  });

  // Mark token as used
  await supabase
    .from('email_verification_tokens')
    .update({ used: true })
    .eq('id', tokenRecord.id);

  return Response.redirect('/dashboard?verified=true');
}
```

**How to Recreate:**
1. Apply migration: `20251008130000_custom_email_verification.sql`
2. Create `lib/auth/email-verification.ts` with Postmark templates
3. Update signup flow to send custom verification emails
4. Create `/api/auth/verify` endpoint
5. Test: Sign up → Check email → Click link → Verify works

---

## Campaign Naming & Client Codes

### Client Code System (⚠️ Review Carefully)
**Commits:** 8b7905f, 02a5b66, b1f52cb, a7151c4, 9f98b6c, 33cecf3, 0449b3c, 31c9a77
**Files Added:**
- `supabase/migrations/20251009100000_add_client_code_and_campaign_name.sql`
- `components/ProspectApprovalModal.tsx` - Campaign naming UI
- `scripts/test-campaign-naming-flow.mjs`
- `scripts/check-campaign-schema.mjs`
- `scripts/test-client-code-migration.mjs`

**Migration:**
```sql
-- Add client_code to workspaces (3 letters, auto-assigned, UNIQUE)
ALTER TABLE workspaces ADD COLUMN client_code VARCHAR(3) UNIQUE;
CREATE INDEX idx_workspaces_client_code ON workspaces(client_code);

-- Add campaign_name to campaigns (formatted: YYYYMMDD-CODE-Name)
ALTER TABLE campaigns ADD COLUMN campaign_name TEXT;
CREATE INDEX idx_campaigns_campaign_name ON campaigns(campaign_name);

-- Auto-assign function
CREATE OR REPLACE FUNCTION derive_client_code(workspace_name TEXT)
RETURNS VARCHAR(3) AS $$
DECLARE
  base_code VARCHAR(3);
  final_code VARCHAR(3);
  counter INTEGER := 2;
BEGIN
  -- Extract capital letters and numbers
  base_code := UPPER(SUBSTRING(
    REGEXP_REPLACE(workspace_name, '[^A-Z0-9]', '', 'g')
    FROM 1 FOR 3
  ));

  -- If less than 3 chars, take first 3 letters
  IF LENGTH(base_code) < 3 THEN
    base_code := UPPER(SUBSTRING(workspace_name FROM 1 FOR 3));
  END IF;

  final_code := base_code;

  -- Handle collisions with numeric suffix
  WHILE EXISTS (SELECT 1 FROM workspaces WHERE client_code = final_code) LOOP
    final_code := SUBSTRING(base_code FROM 1 FOR 2) || counter::TEXT;
    counter := counter + 1;
  END LOOP;

  RETURN final_code;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-assign
CREATE OR REPLACE FUNCTION auto_assign_client_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.client_code IS NULL OR NEW.client_code = '' THEN
    NEW.client_code := derive_client_code(NEW.name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_assign_client_code
BEFORE INSERT OR UPDATE ON workspaces
FOR EACH ROW EXECUTE FUNCTION auto_assign_client_code();
```

**Campaign Naming Format:**
```
YYYYMMDD-CODE-Campaign Name
20251009-IAI-Q4 Enterprise Outreach
20251009-BLL-Healthcare Leads
```

**Derivation Examples:**
- "InnovareAI" → "IAI" (capital letters: I, A, I)
- "3CubedAI" → "3AI" (number + capitals: 3, A, I)
- "Blue Label Labs" → "BLL" (acronym from 3 words)
- "Sendingcell" → "SEN" (first 3 letters)

**Collision Handling:**
- First workspace: "InnovareAI" → "IAI"
- Second workspace: "InnovareAI 2" → "IA2"
- Third workspace: "InnovareAI 3" → "IA3"

**UI Changes (ProspectApprovalModal):**
```typescript
const [campaignName, setCampaignName] = useState('');
const datePrefix = new Date().toISOString().split('T')[0].replace(/-/g, '');
const fullCampaignName = `${datePrefix}-${clientCode}-${campaignName}`;

<input
  type="text"
  value={campaignName}
  onChange={(e) => setCampaignName(e.target.value)}
  placeholder="Campaign Name (e.g., Q4 Outreach)"
  required
/>
<p>Full name: {fullCampaignName}</p>
```

**API Changes:**
```typescript
// POST /api/campaigns
const { data: campaign } = await supabase
  .from('campaigns')
  .insert({
    name: body.name,
    campaign_name: body.campaign_name, // NEW: Formatted name
    workspace_id,
    created_by: user.id
  });
```

**How to Recreate:**
1. Apply migration via Supabase dashboard SQL editor
2. Test derive_client_code function with various names
3. Verify UNIQUE constraint prevents duplicates
4. Update campaign creation API to accept campaign_name
5. Add campaign naming UI to ProspectApprovalModal
6. Test end-to-end: Approve prospects → Name campaign → Create

---

## Hashtag Shortcuts

### Quick Navigation Shortcuts (✅ Safe to Recreate)
**Commits:** aace5ae, fe7e3dd, fe130e6, 302e059, 99cf760, fb1b16b
**Files Modified:**
- `components/ThreadedChatInterface.tsx` - Hashtag detection and handling
- `app/api/sam/threads/[threadId]/messages/route.ts` - Shortcut expansion

**Implementation:**
```typescript
const hashtagShortcuts = {
  // Quick Actions
  '#help': 'Show me all available hashtag shortcuts and their usage',
  '#override': 'Override current workflow settings and campaign rules',

  // Lead Generation
  '#findleads': 'Start the prospect discovery workflow',
  '#linkedin': 'Search LinkedIn for specific prospects matching criteria',
  '#connections': 'Search my 1st-degree LinkedIn connections',
  '#upload': 'Upload CSV file or document with prospect data',

  // Knowledge Base
  '#knowledge': 'Access knowledge base to view/edit company information',
  '#icp': 'View and edit Ideal Customer Profile definitions',
  '#competitors': 'Access competitor intelligence and analysis',
  '#personas': 'View and edit buyer persona profiles',
  '#templates': 'Access message template library',

  // Campaign Management
  '#createcampaign': 'Complete campaign creation with approved prospects',
  '#createmessaging': 'Create personalized message templates',
  '#campaigns': 'View all campaigns in current workspace',
  '#analytics': 'View campaign performance analytics',
  '#schedule': 'Schedule a campaign for future execution',

  // Quick Approve
  '#approve': 'Quick approve pending items (prospects, messages, follow-ups)'
};

// Detect hashtag in message
function handleHashtagShortcuts(message: string) {
  const lowerMessage = message.toLowerCase().trim();
  const shortcut = hashtagShortcuts[lowerMessage];

  if (shortcut) {
    // Send expanded prompt to SAM
    sendMessage(shortcut);
    return true;
  }
  return false;
}

// Check before sending message (line 520-524)
if (handleHashtagShortcuts(inputMessage)) {
  setInputMessage('');
  return;
}
```

**How to Recreate:**
1. Add hashtag mappings object
2. Create handleHashtagShortcuts function
3. Check for hashtags before sending message
4. Expand hashtag to full prompt
5. Test each shortcut works correctly

---

## UI/UX Bug Fixes (That Caused Problems)

### ⚠️ Loading Bubble Fixes (DO NOT RECREATE - These Caused Issues)
**Commits:** f74a413, d330ff9, 5778871, 770614a, 72535bb, 2c05414, 058dc90, 8c5c279, fd09638, f1e5b70, 03d692f, 67292dd, 8bf40c8, 22cb2a1

**What Went Wrong:**
These commits tried to fix persistent loading bubbles but made it worse:

1. **Added force re-render** (770614a, 72535bb) - Caused performance issues
2. **Removed loading indicator** (2c05414, 058dc90) - Broke user feedback
3. **Added optimistic updates** (058dc90) - User messages appeared twice
4. **Removed animated cursor** (8c5c279) - Took away nice UX
5. **Overly strict validation** (fd09638) - Blocked valid messages
6. **Multiple cache busts** (03d692f, 67292dd) - Didn't help

**Root Cause:**
The loading bubbles existed in the Oct 8 version and worked fine. The issue was introduced by trying to "fix" something that wasn't broken.

**Lesson Learned:**
Don't touch the loading indicator code in app/page.tsx lines 4310-4334. It works correctly as-is in the Oct 8 version.

---

## Other Minor Fixes

### Build Fixes (✅ Safe to Recreate)
**Commits:** 3a6f065, a725bca, 8526f9b
- Fixed Supabase import paths
- Fixed Postmark import syntax
- Fixed React undefined error in ContactCenter

**Documentation Updates (✅ Safe to Recreate):**
**Commits:** 8348289
- Updated TODO.md with completed tasks

---

## What NOT to Recreate

### 1. Loading Bubble "Fixes" (❌ DON'T RECREATE)
All commits from f74a413 through 22cb2a1 that tried to fix loading bubbles. The Oct 8 version works correctly - leave it alone.

### 2. Force Re-render Mechanisms (❌ DON'T RECREATE)
The useEffect + useState force re-render pattern caused performance issues.

### 3. Optimistic UI Updates Without Proper State Management (❌ DON'T RECREATE)
Adding user messages immediately before API response can cause duplicates.

---

## Recommended Recreation Order

**Phase 1: Critical Security (Week 1)**
1. Data isolation fixes (workspace_id filters)
2. OAuth duplicate prevention
3. CSV sanitization

**Phase 2: Infrastructure (Week 1-2)**
4. Restore point system
5. Stripe webhooks
6. Email verification

**Phase 3: Core Features (Week 2-3)**
7. Remove mock data, use real APIs
8. Campaign ownership
9. SAM memory system
10. Client codes & campaign naming

**Phase 4: LinkedIn Integration (Week 3-4)**
11. Fix LinkedIn search URLs
12. SAM LinkedIn prospect search
13. Pagination support

**Phase 5: Advanced Features (Week 4-5)**
14. Campaign execution & reply agent
15. HITL approval system
16. Hashtag shortcuts

**Phase 6: Polish (Week 5)**
17. CSV improvements
18. Documentation updates
19. Testing & verification

---

## Testing Checklist

Before declaring a feature "done," verify:

- [ ] Works in multiple workspaces (test data isolation)
- [ ] No console errors in browser
- [ ] No TypeScript build errors
- [ ] Tested with real user accounts (not just admin)
- [ ] Tested on production domain (not just localhost)
- [ ] Hard refresh clears any cached issues
- [ ] Mobile responsive (if UI change)
- [ ] Database migrations applied successfully
- [ ] RLS policies prevent unauthorized access
- [ ] Error messages are user-friendly

---

## Files to Reference

All reverted code is available in git history. To view a specific commit:

```bash
# View full diff for a commit
git show <commit-hash>

# View specific file at that commit
git show <commit-hash>:path/to/file.ts

# Checkout entire commit to review
git checkout <commit-hash>
# (then git checkout main to return)

# Create branch from reverted commit to work on
git checkout -b feature/<name> <commit-hash>
```

**Example:**
```bash
# Review the campaign naming implementation
git show 31c9a77:app/api/campaigns/route.ts

# Review client code migration
git show a7151c4:supabase/migrations/20251009100000_add_client_code_and_campaign_name.sql
```

---

## Questions?

**For each feature you recreate:**
1. Read the commit message
2. Review the full diff: `git show <commit>`
3. Check if there are associated docs
4. Review any SQL migrations
5. Test in staging before production
6. Create a new restore point before deploying

**Remember:** The loading bubble issue happened because we changed code that was working. When recreating features, if something works - leave it alone!

---

**Document Created:** October 9, 2025
**Commits Covered:** b769600 through 22cb2a1 (90 commits)
**Restore Point:** 10e4534 (October 8, 2025 14:42 PST)
