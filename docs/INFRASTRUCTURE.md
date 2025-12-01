# SAM AI Infrastructure Documentation

**Last Updated:** November 27, 2025
**Status:** Production
**URL:** https://app.meet-sam.com

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER BROWSER                                    │
│                                                                             │
│  React Frontend (Next.js 15 App Router)                                     │
│  - CampaignHub.tsx (main campaign UI)                                       │
│  - React Query for data fetching/caching                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           NETLIFY (Hosting)                                  │
│                                                                             │
│  Static Assets + Serverless Functions                                       │
│  URL: https://app.meet-sam.com                                              │
│  Deploy: `netlify deploy --prod`                                            │
│                                                                             │
│  API Routes (Next.js):                                                      │
│  - /api/campaigns                    → Campaign CRUD                        │
│  - /api/campaigns/direct/*           → Direct Unipile operations            │
│  - /api/cron/process-send-queue      → Queue processor (external cron)      │
│  - /api/cron/poll-accepted-connections → Check accepted CRs                 │
│  - /api/linkedin-commenting/*        → Commenting agent                     │
│  - /api/sam/*                        → SAM AI conversations                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌──────────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐
│     SUPABASE         │  │    UNIPILE      │  │   NETLIFY SCHEDULED FUNCS   │
│                      │  │                 │  │                             │
│  PostgreSQL + Auth   │  │  LinkedIn API   │  │  Native Netlify scheduling  │
│  + Row Level Security│  │  + Email API    │  │  Calls /api/cron/* every    │
│                      │  │                 │  │  minute                     │
│  URL: supabase.co    │  │  api6.unipile   │  │                             │
│  Project: latxad...  │  │  .com:13670     │  │  See netlify/functions/     │
└──────────────────────┘  └─────────────────┘  └─────────────────────────────┘
```

---

## Core Components

### 1. Frontend (Next.js 15 + React)

**Location:** `/app/` directory

**Key Files:**
- `/app/components/CampaignHub.tsx` - Main campaign management UI (~8500 lines)
- `/app/workspace/[workspaceId]/page.tsx` - Workspace dashboard
- `/app/providers/` - React context providers

**Data Fetching:**
- Uses React Query (`@tanstack/react-query`) for caching
- API calls to `/api/*` endpoints
- Response format: `{ success: true, data: { ... }, timestamp: "..." }`

**Important:** Frontend expects `response.data.campaigns` NOT `response.campaigns`

### 2. Backend (Next.js API Routes)

**Location:** `/app/api/` directory

**Campaign APIs:**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/campaigns` | GET | List campaigns for workspace |
| `/api/campaigns` | POST | Create new campaign |
| `/api/campaigns/direct/send-connection-requests-queued` | POST | Queue LinkedIn CRs |
| `/api/campaigns/direct/process-follow-ups` | POST | Send follow-up messages |
| `/api/cron/process-send-queue` | POST | Process queued messages (cron) |
| `/api/cron/poll-accepted-connections` | POST | Check accepted connections (cron) |

**Response Helper:**
```typescript
// lib/api-error-handler.ts
apiSuccess({ campaigns })
// Returns: { success: true, data: { campaigns: [...] }, timestamp: "..." }
```

### 3. Database (Supabase PostgreSQL)

**Connection:**
- Host: `db.latxadqrvrrrcvkktrog.supabase.co`
- Port: 5432
- Database: postgres

**Key Tables:**

| Table | Purpose |
|-------|---------|
| `workspaces` | Multi-tenant containers |
| `workspace_members` | User access control (RLS) |
| `campaigns` | Campaign definitions |
| `campaign_prospects` | Prospects assigned to campaigns |
| `campaign_messages` | Email message history |
| `send_queue` | Queued LinkedIn connection requests |
| `linkedin_posts_discovered` | Commenting agent posts |
| `linkedin_comment_queue` | Queued comments |
| `knowledge_base` | RAG knowledge store |

**Row Level Security (RLS):**
- All tables use RLS policies
- Filter by `workspace_id` + user membership in `workspace_members`
- Service role key bypasses RLS for admin operations

**Common Query Pattern:**
```typescript
// Use service role to bypass RLS when needed
const supabaseAdmin = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { cookies: { ... } }
);

// Verify membership before returning data
const { data: membership } = await supabaseAdmin
  .from('workspace_members')
  .select('id')
  .eq('workspace_id', workspaceId)
  .eq('user_id', user.id)
  .eq('status', 'active')
  .single();
```

### 4. LinkedIn Integration (Unipile)

**Configuration:**
- DSN: `api6.unipile.com:13670`
- API Key: Set via `netlify env:set UNIPILE_API_KEY "..."`

**Critical Bug Fix (Nov 22):**
- NEVER use `/api/v1/users/profile?identifier=` for vanity URLs with numbers
- USE `/api/v1/users/{vanity}?account_id=...` (legacy endpoint)
- Or use `provider_id` with `/api/v1/users/profile?provider_id=...`

**Endpoints Used:**
```
GET  /api/v1/accounts                    # List connected accounts
GET  /api/v1/users/{vanity}?account_id=  # Lookup user profile
POST /api/v1/messages/send               # Send connection request/message
GET  /api/v1/users/me/relations          # Get accepted connections
```

### 5. Netlify Scheduled Functions

**Location:** `/netlify/functions/`

**How it works:**
- Native Netlify scheduled functions (no external service needed)
- Uses `schedule` property in function config
- Calls internal `/api/cron/*` endpoints with auth header

**Jobs:**
| Function | Schedule | Purpose |
|----------|----------|---------|
| `process-send-queue.ts` | Every 1 min | Send queued LinkedIn CRs |
| `poll-accepted-connections.ts` | Every 5 min | Check for accepted connections |
| `poll-message-replies.ts` | Every 15 min | Detect prospect replies, stop follow-ups |

**Authentication:**
- Functions use `CRON_SECRET` env var to authenticate with API routes

### 6. N8N Workflows (NOT used for campaigns)

**URL:** https://workflows.innovareai.com

**Current Usage:**
- LinkedIn Commenting Agent (discovers posts, triggers comment generation)
- NOT used for campaign execution (we use direct Unipile API)

**Workflow IDs:**
- `aVG6LC4ZFRMN7Bw6` - SAM Master Campaign Orchestrator (legacy, not active)

---

## Environment Variables

**Set via:** `netlify env:set VARIABLE_NAME "value"`

**Required Variables:**
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://latxadqrvrrrcvkktrog.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>

# Unipile (LinkedIn/Email)
UNIPILE_DSN=api6.unipile.com:13670
UNIPILE_API_KEY=<api_key>

# OpenRouter AI
OPENROUTER_API_KEY=<key>

# Cron Authentication
CRON_SECRET=792e0c09eeee1a229b78a6341739613177fad24f401b1c82f2673bbb9ee806a0
```

**Check Variables:**
```bash
netlify env:list
```

---

## Data Flow: Campaign Execution

### LinkedIn Connection Request Flow

```
1. User creates campaign in UI
   └─→ POST /api/campaigns
       └─→ Creates campaign + campaign_prospects records

2. User launches campaign
   └─→ POST /api/campaigns/direct/send-connection-requests-queued
       └─→ Validates prospects
       └─→ Creates send_queue records (scheduled 30min apart)
       └─→ Returns immediately (<2 seconds)

3. Cron job processes queue (every minute)
   └─→ POST /api/cron/process-send-queue
       └─→ Finds next pending message where scheduled_for <= NOW
       └─→ Calls Unipile API to send CR
       └─→ Updates send_queue status to 'sent'
       └─→ Updates campaign_prospects status to 'cr_sent'

4. Cron job checks accepted connections (every 5 minutes)
   └─→ POST /api/cron/poll-accepted-connections
       └─→ Calls Unipile /api/v1/users/me/relations
       └─→ Matches against campaign_prospects
       └─→ Schedules follow-up messages
```

### API Response Format

**All APIs use `apiSuccess()` wrapper:**
```json
{
  "success": true,
  "data": {
    "campaigns": [...],
    "other_field": "..."
  },
  "timestamp": "2025-11-27T17:00:00.000Z"
}
```

**Frontend must read:** `response.data.campaigns` NOT `response.campaigns`

---

## Deployment

### Deploy to Production
```bash
cd /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7
netlify deploy --prod
```

### Update Environment Variables
```bash
netlify env:set VARIABLE_NAME "value"
netlify deploy --prod  # Redeploy to pick up changes
```

### Check Logs
```bash
# View recent function logs
open https://app.netlify.com/projects/devin-next-gen-prod/logs/functions

# Check specific deploy
open https://app.netlify.com/projects/devin-next-gen-prod/deploys/<deploy-id>
```

### Database Access
```bash
PGPASSWORD='QFe75XZ2kqhy2AyH' psql \
  -h db.latxadqrvrrrcvkktrog.supabase.co \
  -p 5432 -U postgres -d postgres \
  -c "SELECT * FROM campaigns LIMIT 5;"
```

---

## Common Issues & Fixes

### 1. Campaigns Not Showing in UI
**Symptoms:** Active Campaigns tab is empty
**Causes:**
- API response format mismatch (reading `response.campaigns` instead of `response.data.campaigns`)
- RLS blocking queries (user not in `workspace_members`)
- N+1 query timeout (too many DB queries per campaign)

**Fix:**
```typescript
// Correct way to read campaigns
const result = await response.json();
const campaigns = result.data?.campaigns || result.campaigns || [];
```

### 2. Connection Requests Not Sending
**Symptoms:** CRs queued but never sent
**Causes:**
- Invalid Unipile API key
- Cron job not running
- Wrong UNIPILE_DSN format

**Fix:**
```bash
# Check/update API key
netlify env:set UNIPILE_API_KEY "correct_key"
netlify env:set UNIPILE_DSN "api6.unipile.com:13670"
netlify deploy --prod
```

### 3. Wrong LinkedIn Profile Returned
**Symptoms:** System rejects valid prospects as "invitation withdrawn"
**Cause:** Unipile `/api/v1/users/profile?identifier=` returns wrong profiles for vanity URLs with numbers

**Fix:** Use legacy endpoint:
```typescript
// WRONG - returns wrong profiles for vanities with numbers
const profile = await fetch(`${UNIPILE_DSN}/api/v1/users/profile?identifier=${vanity}`);

// CORRECT - legacy endpoint works for all vanities
const profile = await fetch(`${UNIPILE_DSN}/api/v1/users/${vanity}?account_id=${accountId}`);
```

### 4. RLS Blocking Legitimate Users
**Symptoms:** User can't see their own data
**Cause:** RLS policy recursion or missing `workspace_members` record

**Fix:**
```sql
-- Check user membership
SELECT * FROM workspace_members
WHERE user_id = '<user_id>' AND workspace_id = '<workspace_id>';

-- Add if missing
INSERT INTO workspace_members (workspace_id, user_id, role, status)
VALUES ('<workspace_id>', '<user_id>', 'member', 'active');
```

---

## Workspaces

| ID | Name | Owner |
|----|------|-------|
| `babdcab8-1a78-4b2f-913e-6e9fd9821009` | InnovareAI (IA1) | Main workspace |
| (others) | IA2, IA3, IA4 | Charissa, Michelle, Irish |

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `/app/api/campaigns/route.ts` | Campaign CRUD API |
| `/app/api/cron/process-send-queue/route.ts` | Queue processor |
| `/app/api/campaigns/direct/send-connection-requests-queued/route.ts` | Queue LinkedIn CRs |
| `/app/components/CampaignHub.tsx` | Main campaign UI |
| `/lib/api-error-handler.ts` | API response helpers |
| `/lib/supabase-route-client.ts` | Supabase client factory |
| `/CLAUDE.md` | Development instructions |

---

## Monitoring

### Database Queries
```sql
-- Check campaign status
SELECT id, name, status, created_at FROM campaigns
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
ORDER BY created_at DESC;

-- Check send queue
SELECT status, COUNT(*) FROM send_queue GROUP BY status;

-- Check prospect statuses
SELECT status, COUNT(*) FROM campaign_prospects
WHERE campaign_id = '<id>' GROUP BY status;
```

### Health Checks
```bash
# API health
curl https://app.meet-sam.com/api/version

# Check if campaigns API responds
curl "https://app.meet-sam.com/api/campaigns?workspace_id=babdcab8-..."
```
