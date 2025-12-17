# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 🛑🛑🛑 ABSOLUTE PROHIBITION: DO NOT MODIFY WORKING SYSTEMS 🛑🛑🛑

**UPDATED: DECEMBER 17, 2025 - THIS IS NON-NEGOTIABLE**

### 📚 MANDATORY REFERENCE DOCUMENTATION

**Before making ANY changes to these systems, READ the corresponding doc:**

| System | Documentation | Lines of Code |
|--------|---------------|---------------|
| Campaign/Queue System | **`docs/UNIPILE_SEND_QUEUE_SYSTEM.md`** | 8,000+ |
| LinkedIn Commenting Agent | **`docs/LINKEDIN_COMMENTING_AGENT.md`** | 10,000+ |
| LinkedIn Messaging Agent | **`docs/LINKEDIN_MESSAGING_AGENT.md`** | 8,000+ |

**`docs/UNIPILE_SEND_QUEUE_SYSTEM.md`** covers:
- Full database schema (8 tables, all columns)
- Unipile API integration details
- Campaign execution flow
- Rate limiting & anti-detection logic
- Cron job schedules
- ERD and table relationships

**`docs/LINKEDIN_COMMENTING_AGENT.md`** covers:
- AI comment generation & quality scoring
- Author relationship memory
- Performance tracking & anti-detection
- Brand guidelines integration

**`docs/LINKEDIN_MESSAGING_AGENT.md`** covers:
- Queue-based campaign execution
- Multi-country timezone support
- Reply detection & follow-up automation
- Unipile integration for messaging

**These documents are the source of truth. Changes require explicit approval.**

### ⛔ FORBIDDEN ACTIONS (REQUIRE EXPLICIT HUMAN CONFIRMATION):

**YOU MUST ASK FOR EXPLICIT HUMAN CONFIRMATION BEFORE:**

1. Modifying ANY database table structure (migrations, ALTER TABLE, etc.)
2. Changing ANY foreign key relationships
3. Modifying the `user_unipile_accounts` table or its relationships
4. Modifying the `campaigns` table schema
5. Changing how `linkedin_account_id` is stored or referenced
6. Modifying workspace-account associations
7. Deleting or archiving ANY data
8. Changing RLS policies
9. Modifying cron job schedules or logic
10. "Fixing" or "improving" any system that is currently working
11. Modifying the `send_queue` processing logic
12. Changing rate limits in `MESSAGE_HARD_LIMITS`
13. Modifying Unipile API integration code
14. **ADDING MESSAGES TO CAMPAIGNS - ABSOLUTELY FORBIDDEN**
    - ❌ NEVER add `connection_message` content
    - ❌ NEVER add `alternative_message` content
    - ❌ NEVER add `follow_up_message_1`, `follow_up_message_2`, etc.
    - ❌ NEVER add placeholder messages
    - ❌ NEVER add "test" messages
    - ❌ NEVER populate ANY message field
    - Users MUST configure their own messages in the UI
    - If a campaign has no message, that is the USER'S responsibility to fix

### 🔒 PROTECTED TABLES (DO NOT TOUCH WITHOUT HUMAN APPROVAL):

- `user_unipile_accounts` - LinkedIn account storage
- `campaigns` - Campaign definitions (45 columns)
- `campaign_prospects` - Prospect data (42 columns)
- `send_queue` - LinkedIn message queue
- `email_queue` - Email message queue
- `prospect_approval_sessions` - Approval batches
- `prospect_approval_data` - Prospects pending approval
- `workspace_members` - Workspace access
- `workspaces` - Workspace definitions

### ✅ BEFORE ANY DATABASE OR SYSTEM CHANGE:

1. **READ** the relevant documentation first:
   - Campaign/Queue: `docs/UNIPILE_SEND_QUEUE_SYSTEM.md`
   - Commenting: `docs/LINKEDIN_COMMENTING_AGENT.md`
   - Messaging: `docs/LINKEDIN_MESSAGING_AGENT.md`
2. **STOP** and describe the exact change you want to make
3. **WAIT** for explicit human confirmation ("yes", "approved", "do it")
4. **DO NOT** assume silence or context means approval
5. **DO NOT** chain changes together without separate approvals

### 📜 WHY THIS RULE EXISTS:

- Multiple "fixes" have broken the linkedin_account_id relationships
- Data has been lost due to well-intentioned changes
- Working systems have been destroyed by "improvements"
- The workspace_members table was emptied by a "fix"
- Unipile accounts were disconnected from workspaces by a "cleanup"

**If you are unsure, ASK. If it's working, DON'T TOUCH IT.**

---

## 🎯 WORK DELEGATION: ORCHESTRATOR PATTERN

**The main Claude agent acts as an ORCHESTRATOR only. All actual work is delegated to subagents.**

### 📋 MANDATORY WORKFLOW:

1. **Receive user request**
2. **Plan the approach** (brief, in your response)
3. **Delegate to appropriate subagent(s)** using the Task tool
4. **Summarize results** from subagent(s) back to user

### 🤖 SUBAGENT TYPES:

| Subagent | Use For |
|----------|---------|
| `Explore` | Finding files, understanding codebase structure, searching code |
| `Plan` | Designing implementation approaches, architecture decisions |
| `general-purpose` | Multi-step coding tasks, complex implementations |
| `unipile-expert` | Any Unipile API integration questions |
| `LI-Data-Model-Analyst` | Campaign data model questions, schema analysis |

### ✅ CORRECT PATTERN:
```
User: "Find where we handle connection request errors"
Orchestrator: "I'll search the codebase for this."
→ Task(subagent_type="Explore", prompt="Find all files handling connection request errors...")
→ Summarize: "Found in 3 files: [x], [y], [z]"
```

### ❌ INCORRECT PATTERN:
```
User: "Find where we handle connection request errors"
Orchestrator: *runs 10 Grep commands directly*
```

### 🚫 DO NOT:
- Run extensive Grep/Glob searches directly (use Explore subagent)
- Write large amounts of code without using general-purpose subagent
- Make database schema decisions without Plan subagent
- Answer Unipile questions without unipile-expert subagent

### ✅ EXCEPTIONS (do these directly):
- Reading a specific known file path
- Quick single-file edits
- Running a single command (npm, git, etc.)
- Answering questions from memory/context

---

## 🚨 CAMPAIGN EXECUTION ARCHITECTURE

**The system calls Unipile API directly. No N8N, no Inngest, no workflows.**

### ✅ WHAT WE USE:
- **Connection Requests**: Direct Unipile REST API via `send_queue`
- **Follow-up Messages**: Direct Unipile REST API
- **Queue Processing**: Netlify cron every minute

### ❌ WHAT WE DO NOT USE:
- ❌ N8N - NOT used for campaign execution
- ❌ Inngest - NOT used for campaign execution

**Unipile Configuration:**
- DSN: `api6.unipile.com:13670`
- API Key: Set via `netlify env:set UNIPILE_API_KEY`

### 📊 CAMPAIGN TYPES

| Type | `campaign_type` | Queue Table | Use Case |
|------|-----------------|-------------|----------|
| LinkedIn | `null` or `linkedin_only` | `send_queue` | Connection requests, InMails |
| Email-only | `email_only` | `email_queue` | Cold email inbox agent (no LinkedIn) |
| Multi-channel | `multi_channel` | Both | LinkedIn + Email combined |
| Messenger | `messenger` | `send_queue` | Direct messages to 1st connections |

**Example Email-only Campaigns:**
- **Jennifer Fleming** - Inbox agent for replying to cold email campaigns. NO LinkedIn account needed.

**QA Monitor Behavior:**
- LinkedIn campaigns → checked via `send_queue`
- Email-only campaigns → checked via `email_queue`
- The QA monitor skips email-only campaigns when checking "stuck campaigns" in `send_queue`

---

## 🌍 ENVIRONMENTS & DEPLOYMENT

### Environment Structure

| Environment | URL | Purpose | Deploy Method |
|-------------|-----|---------|---------------|
| **LOCAL** | localhost:3000 | Development | `npm run dev` |
| **STAGING** | staging.meet-sam.com | Testing/QA | `npm run deploy:staging` |
| **PRODUCTION** | app.meet-sam.com | Live system | `npm run deploy:production` |

### 🛡️ MANDATORY DEPLOYMENT WORKFLOW

**ALL development follows this path:**

1. **Develop locally** → `npm run dev`
2. **Test on staging** → `npm run deploy:staging`
3. **Verify staging works** → Manual QA on staging.meet-sam.com
4. **Deploy to production** → `npm run deploy:production` (requires confirmation)

### 🚨 PRODUCTION PROTECTION RULES

**PRODUCTION IS READ-ONLY:**

- ❌ **NEVER** make changes directly to production
- ❌ **NEVER** test experimental code on production
- ❌ **NEVER** deploy without staging verification
- ✅ **ALWAYS** test on staging first
- ✅ **ALWAYS** verify staging works before production deploy
- ✅ **ALWAYS** use `npm run deploy:production` (has pre-flight checks)

**Pre-production checklist runs automatically:**
- Must be on main branch
- No uncommitted changes
- Tenant isolation passes
- User confirmation required

---

## 📋 QUICK REFERENCE

### Production (🔒 PROTECTED)
- **URL:** https://app.meet-sam.com
- **Netlify:** devin-next-gen-prod
- **Database:** https://latxadqrvrrrcvkktrog.supabase.co
- **Branch:** `main`

### Staging (✅ DEVELOPMENT)
- **URL:** https://sam-staging.netlify.app
- **Netlify:** sam-staging
- **Database:** https://cuiqpollusiqkewpvplm.supabase.co
- **Branch:** `staging`

### Workspace ID (InnovareAI)
- **Production:** `babdcab8-1a78-4b2f-913e-6e9fd9821009`

### Key Commands
```bash
npm run dev                     # Local development
npm run dev:staging             # Local dev with staging env
npm run deploy:staging          # Deploy to staging
npm run deploy:production       # Deploy to production (with checks)
netlify env:list                # View env vars
```

### Key Files
- **Campaign Hub:** `app/components/CampaignHub.tsx`
- **Queue Processor:** `app/api/cron/process-send-queue/route.ts`
- **Rate Limits:** `lib/anti-detection/message-variance.ts`

---

## 🚨 DIRECTORY SAFETY

**LOCKED TO:** `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7`

**NEVER ACCESS:**
- ❌ `/Users/tvonlinz/Dev_Master/3cubed/` (killed this project before)
- ❌ `/Users/tvonlinz/Dev_Master/SEO_Platform/` (killed this project before)
- ❌ Any path without `Sam-New-Sep-7`

**BEFORE EVERY FILE OPERATION:**
```bash
pwd  # Must return: /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7
```

---

## 📚 KEY DOCUMENTATION

### Technical Documentation (READ THESE)
- **`docs/UNIPILE_SEND_QUEUE_SYSTEM.md`** - Campaign/queue system (source of truth)
- **`docs/LINKEDIN_COMMENTING_AGENT.md`** - Commenting agent system
- **`docs/LINKEDIN_MESSAGING_AGENT.md`** - Messaging agent system
- **`docs/INFRASTRUCTURE.md`** - Complete infrastructure guide
- **`docs/MEETING_AGENT.md`** - Meeting booking & reminders

### Onboarding
- **`QUICK_START_GUIDE.md`** - 5-minute quick start
- **`NEW_ASSISTANT_ONBOARDING.md`** - 30-minute detailed onboarding

---

## 🔧 MULTI-TENANT SAFETY

```typescript
// ✅ CORRECT: Use workspace_members for user access
const { data } = await supabase
  .from('workspace_members')
  .select('*')
  .eq('workspace_id', workspaceId);

// ❌ WRONG: workspace_users table doesn't exist
const { data } = await supabase
  .from('workspace_users')  // This will fail
  .select('*');
```

---

## 📊 TECH STACK

- **Framework**: Next.js 15 (App Router) + TypeScript
- **Database**: Supabase PostgreSQL with RLS
- **AI**: OpenRouter API (Claude 3.5 Sonnet)
- **LinkedIn/Email**: Unipile API
- **Deployment**: Netlify + Supabase Cloud

---

**Last Updated**: December 17, 2025
**System Status**: Production
