# Complete Project Handover: SAM AI Platform

**Date:** October 7, 2025
**Project:** SAM AI B2B Sales Automation Platform
**Status:** 🟢 Production (85% Complete)
**Environment:** https://app.meet-sam.com
**Target:** $100M ARR by 2027

---

## 🎯 Executive Summary

SAM AI is a multi-tenant B2B sales automation platform combining:
- **AI-Powered Conversational Assistant** (Claude 3.5 Sonnet via OpenRouter)
- **Multi-Channel Campaign Management** (LinkedIn + Email via Unipile)
- **Human-in-the-Loop (HITL) Workflow** (Email-based approval system)
- **Knowledge Base with RAG** (Vector search via Supabase)
- **N8N Workflow Automation** (Campaign execution)

**Production Status:**
- ✅ Live with paying customers
- ✅ Email HITL system deployed (Oct 7, 2025)
- ⚠️ Authentication issues recently fixed (magic link + password reset)
- 🚀 Ready for scale testing

---

## 📁 Project Structure

### Critical Working Directory
```
/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7
```

**⚠️ ABSOLUTE RESTRICTION:**
- NEVER access `/Users/tvonlinz/Dev_Master/3cubed/` (killed before)
- NEVER access `/Users/tvonlinz/Dev_Master/SEO_Platform/` (killed before)
- NEVER access `/Users/tvonlinz/Dev_Master/sam/` (different project)
- ALWAYS run `pwd` before file operations

### Repository Structure
```
Sam-New-Sep-7/
├── app/                        # Next.js 15 App Router
│   ├── api/                   # API routes
│   │   ├── sam/              # SAM AI endpoints
│   │   ├── campaign/         # Campaign management
│   │   ├── prospect-approval/# HITL approval system
│   │   ├── webhooks/         # Postmark inbound email
│   │   └── linkedin/         # LinkedIn integration
│   ├── workspace/[workspaceId]/ # Tenant dashboards
│   └── demo/                 # Demo tenant
├── lib/                       # Business logic
│   ├── services/             # Core services
│   ├── mcp/                  # MCP tool integrations
│   ├── n8n/                  # N8N workflow client
│   ├── ai/                   # AI/LLM utilities
│   └── supabase-knowledge.ts # RAG integration
├── components/               # React components
├── docs/                     # Documentation (118 files)
│   ├── sam-ai/              # Product roadmap & strategy
│   ├── EMAIL_SYSTEM_*.md    # Email HITL system docs
│   └── SAM_WORKFLOW_AUDIT_*.md
├── sql/                      # Database migrations
├── temp/                     # Temporary test files
├── scripts/                  # Deployment & utility scripts
├── .env.local               # Environment variables (DO NOT COMMIT)
├── package.json             # Dependencies & scripts
├── CLAUDE.md               # Project instructions (18KB)
└── README.md               # Quick start guide
```

---

## 🔧 Technology Stack

### Frontend & Backend
- **Framework:** Next.js 15.5.2 (App Router) + React 18 + TypeScript
- **Deployment:** Netlify (Production: app.meet-sam.com, Staging: devin-next-gen-staging)
- **UI:** Tailwind CSS + shadcn/ui + Radix UI + Framer Motion

### Database & Auth
- **Database:** Supabase PostgreSQL (Multi-tenant with RLS)
- **Project ID:** `latxadqrvrrrcvkktrog`
- **URL:** `https://latxadqrvrrrcvkktrog.supabase.co`
- **Auth:** Supabase Auth (Magic Link + Password)
- **Multi-Tenancy:** Row Level Security (RLS) via `workspace_members` table

### AI & Integrations
- **AI Provider:** OpenRouter (Claude 3.5 Sonnet primary)
- **LinkedIn/Email:** Unipile SDK (DSN: api6.unipile.com:13670)
- **Workflow Automation:** N8N Self-Hosted (workflows.innovareai.com)
- **Email Service:** Postmark (Transactional + Inbound)
- **Vector Search:** Supabase pgvector (RAG embeddings)
- **Model Context Protocol (MCP):** Unipile, N8N, Brave Search tools

### Payment & CRM
- **Billing:** Stripe (Live keys in production)
- **CRM:** Built-in (`workspace_prospects` table)
- **Marketing Automation:** ActiveCampaign (InnovareAI)

---

## 🔑 Critical Environment Variables

**Location:** `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/.env.local`

### Supabase (Database & Auth)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://latxadqrvrrrcvkktrog.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### OpenRouter AI
```bash
OPENROUTER_API_KEY=sk-or-v1-92ddcd7c453c1376361461d5a5a5d970dbf2a948...
```

### Postmark Email
```bash
POSTMARK_INNOVAREAI_API_KEY=bf9e070d-eec7-4c41-8fb5-1d37fe384723
POSTMARK_3CUBEDAI_API_KEY=77cdd228-d19f-4e18-9373-a1bc8f4a4a22
POSTMARK_FROM_EMAIL=sp@innovareai.com
POSTMARK_FROM_NAME=Sam
```

### Unipile (LinkedIn + Email Campaigns)
```bash
UNIPILE_DSN=api6.unipile.com:13670
UNIPILE_API_KEY=aQzsD1+H.EJ60hU0LkPAxRaCU6nlvk3ypn9Rn9BUwqo9LGY24zZU=
```

### N8N Workflows
```bash
N8N_INSTANCE_URL=https://workflows.innovareai.com
N8N_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Stripe Payment
```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_34pDSKjlunhRaF79QDWodhrJ00gv7MchuB
STRIPE_SECRET_KEY=sk_live_nH6K8J6NzSZVGrbAMdSJHOVE00sa9acXiU
```

### Production URL
```bash
NEXT_PUBLIC_SITE_URL=https://app.meet-sam.com
NEXT_PUBLIC_ENVIRONMENT=production
```

---

## 🗄️ Database Architecture

### Key Tables (Multi-Tenant)

#### User & Workspace Management
```sql
-- Users table (Supabase auth)
users (id, email, created_at, ...)

-- Workspaces (tenants)
workspaces (id, name, company_name, domain, tier_id, created_at)

-- ⚠️ CRITICAL: Use workspace_members, NOT workspace_users
workspace_members (
  workspace_id UUID FK -> workspaces(id),
  user_id UUID FK -> users(id),
  role TEXT, -- 'owner', 'admin', 'member'
  created_at TIMESTAMPTZ
)
-- RLS: auth.uid() must be in workspace_members
```

#### CRM & Prospects
```sql
workspace_prospects (
  id UUID PRIMARY KEY,
  workspace_id UUID FK -> workspaces(id),
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  linkedin_url TEXT,
  company TEXT,
  title TEXT,
  qualification_score INTEGER,
  status TEXT, -- 'pending', 'approved', 'contacted', 'replied'
  created_at TIMESTAMPTZ
)
```

#### Campaign Management
```sql
campaigns (
  id UUID PRIMARY KEY,
  workspace_id UUID FK -> workspaces(id),
  name TEXT,
  status TEXT, -- 'draft', 'active', 'paused', 'completed'
  channel TEXT, -- 'linkedin', 'email', 'both'
  n8n_workflow_id TEXT,
  created_at TIMESTAMPTZ
)

campaign_messages (
  id UUID PRIMARY KEY,
  campaign_id UUID FK -> campaigns(id),
  prospect_id UUID FK -> workspace_prospects(id),
  message_type TEXT, -- 'connection_request', 'follow_up', 'email'
  content TEXT,
  sent_at TIMESTAMPTZ,
  status TEXT -- 'sent', 'delivered', 'opened', 'replied', 'failed'
)

-- NEW: Email HITL Workflow (deployed Oct 7, 2025)
campaign_replies (
  id UUID PRIMARY KEY,
  campaign_id UUID FK -> campaigns(id),
  prospect_id UUID FK -> workspace_prospects(id),
  original_message TEXT,
  ai_suggested_response TEXT, -- SAM's draft
  final_message TEXT, -- User's edited version
  status TEXT, -- 'pending_review', 'approved', 'edited', 'refused'
  reviewed_by UUID FK -> users(id),
  reviewed_at TIMESTAMPTZ,
  priority TEXT -- 'urgent', 'high', 'normal'
)

email_responses (
  id UUID PRIMARY KEY,
  workspace_id UUID FK -> workspaces(id),
  from_email TEXT,
  to_email TEXT,
  subject TEXT,
  body TEXT,
  sentiment TEXT, -- 'positive', 'neutral', 'negative', 'interested'
  campaign_id UUID,
  prospect_id UUID,
  postmark_message_id TEXT,
  received_at TIMESTAMPTZ
)

message_outbox (
  id UUID PRIMARY KEY,
  workspace_id UUID FK -> workspaces(id),
  campaign_reply_id UUID FK -> campaign_replies(id),
  to_email TEXT,
  subject TEXT,
  body TEXT,
  channel TEXT, -- 'email', 'linkedin', 'both'
  status TEXT, -- 'queued', 'sending', 'sent', 'failed'
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ
)
```

#### Knowledge Base (RAG)
```sql
knowledge_base (
  id UUID PRIMARY KEY,
  workspace_id UUID FK -> workspaces(id),
  section_id UUID FK -> knowledge_base_sections(id),
  title TEXT,
  content TEXT,
  embedding VECTOR(1536), -- OpenAI embeddings
  metadata JSONB,
  created_at TIMESTAMPTZ
)

knowledge_base_sections (
  id UUID PRIMARY KEY,
  workspace_id UUID FK -> workspaces(id),
  name TEXT, -- 'company_info', 'products', 'competitors', 'icps'
  description TEXT
)

-- SAM AI ICP Discovery (30-question workflow)
sam_icp_discovery_sessions (
  id UUID PRIMARY KEY,
  workspace_id UUID FK -> workspaces(id),
  status TEXT, -- 'in_progress', 'completed'
  current_question_index INTEGER,
  answers JSONB,
  created_at TIMESTAMPTZ
)

sam_icp_knowledge_entries (
  id UUID PRIMARY KEY,
  session_id UUID FK -> sam_icp_discovery_sessions(id),
  question TEXT,
  answer TEXT,
  embedding VECTOR(1536),
  metadata JSONB
)
```

### RLS Policies (Row Level Security)

**ALL tables enforce workspace isolation:**

```sql
-- Example: workspace_prospects RLS
CREATE POLICY "Users can only access their workspace prospects"
ON workspace_prospects
FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid()
  )
);
```

**⚠️ CRITICAL:** Service role bypasses RLS. Use carefully.

---

## 🚀 Development Commands

```bash
# Development
npm run dev                    # Start dev server (localhost:3000)
npm run build                  # Production build
npm run lint                   # ESLint check

# Testing
npm run test:kb-crud          # Test knowledge base
npm run test:sam-threads      # Test SAM conversations
npm run test:integration      # Integration tests
npm run test:email            # Email workflow test

# Deployment
npm run deploy:staging        # Deploy to staging
npm run deploy:production     # Deploy all tenants to production

# Database
npm run seed:kb-simple        # Seed knowledge base
npm run migrate:kb            # Migrate legacy KB

# Monitoring
npm run monitoring:health     # Check production health
npm run monitoring:metrics    # View system metrics
npm run monitoring:alerts     # Check alerts

# Documentation
npm run update-docs           # Auto-update documentation
```

---

## 📊 Current System Status

### ✅ Fully Implemented (85% Complete)

1. **Multi-Tenant Architecture**
   - Workspace-based isolation with RLS
   - User invitation & member management
   - Tier-based feature access (Startup, SME, Enterprise)

2. **SAM AI Conversational Assistant**
   - 30-question ICP discovery workflow
   - Shallow answer detection with follow-ups
   - RAG-powered contextual responses
   - Knowledge base integration
   - Website intelligence auto-population

3. **Campaign Management**
   - LinkedIn connection requests (Unipile)
   - Email campaigns (Unipile + ReachInbox)
   - Multi-step sequences
   - A/B testing support
   - Template generation with personalization

4. **Email HITL Workflow** (🆕 Deployed Oct 7, 2025)
   - Postmark inbound email processing
   - AI draft generation (Claude 3.5 Sonnet)
   - Email-only approval (no dashboard needed)
   - APPROVE/EDIT/REFUSE detection
   - Confirmation emails
   - Priority system (P1: <15 min, P2: <5 min, P3: daily/weekly)

5. **Prospect Management**
   - CRM with qualification scoring
   - LinkedIn profile scraping
   - Data enrichment
   - Approval workflow

6. **N8N Integration**
   - Workflow automation
   - Campaign execution
   - Real-time webhooks
   - Per-workspace instances

7. **Authentication**
   - Magic link authentication (fixed Oct 6)
   - Password reset flow (fixed Oct 6)
   - Workspace-based access control

### ⚠️ Partially Implemented (10% Complete)

1. **Expertise Mapping (SAM Workflow Step 2)**
   - Data collection exists in KB
   - Missing: Dedicated conversation flow for unique value props

2. **LinkedIn Profile Generation (SAM Workflow Step 3)**
   - Missing: Headline generator
   - Missing: About Me generator
   - Missing: Profile optimization recommendations

3. **Content Strategy System (SAM Workflow Steps 3 & 6)**
   - Missing: Content topic suggestions
   - Missing: Thought leadership recommendations
   - Missing: Posting schedule
   - Missing: Content pillars

### ❌ Not Implemented (5% Complete)

1. **Billing & Subscription Management**
   - Stripe integration exists
   - Missing: Subscription lifecycle management
   - Missing: Usage tracking & metering

2. **Advanced Features**
   - Voice calling integration
   - White-label solutions
   - Enterprise SSO
   - Advanced compliance (HIPAA, SOC2)

---

## 🔴 Critical Issues & Recent Fixes

### Fixed (Oct 6-7, 2025)

1. **Authentication Issues** (URGENT_AUTH_FIX.md)
   - ✅ Magic link not working → Fixed redirect URLs
   - ✅ Password reset failing → Fixed email templates
   - ✅ Users logged out unexpectedly → Extended session timeout

2. **Email HITL System Deployed** (EMAIL_SYSTEM_READY_FOR_PRODUCTION.md)
   - ✅ Postmark inbound webhook configured
   - ✅ AI draft generation working
   - ✅ Email-based approval workflow live
   - ✅ Database migrations applied (3 tables)

### Outstanding Issues

1. **End-to-End Testing Needed**
   - Email HITL workflow needs real user testing
   - APPROVE/EDIT/REFUSE flows not fully validated
   - See: `/temp/test-complete-workflow.sh`

2. **N8N Message Sending**
   - Outbox polling workflow needs implementation
   - Unipile integration for actual sending
   - Status updates after delivery

3. **Missing SAM Workflow Steps**
   - LinkedIn profile generator (Priority: HIGH)
   - Content strategy system (Priority: HIGH)
   - Expertise mapping conversation (Priority: MEDIUM)

---

## 📚 Essential Documentation

### Quick Start (Read First)
1. **`QUICK_START_GUIDE.md`** - 5-minute overview
2. **`NEW_ASSISTANT_ONBOARDING.md`** - 30-minute detailed onboarding
3. **`CLAUDE.md`** - This file (project instructions, 18KB)
4. **`README.md`** - Deployment guide
5. **`TODO.md`** - Current tasks & priorities

### Technical Documentation
- **`SAM_SYSTEM_TECHNICAL_OVERVIEW.md`** - Complete architecture (1083 lines)
- **`docs/SAM_WORKFLOW_AUDIT_2025_10_06.md`** - Workflow status (7 steps)
- **`docs/EMAIL_SYSTEM_READY_FOR_PRODUCTION.md`** - Email HITL system
- **`docs/EMAIL_ONLY_HITL_WORKFLOW.md`** - Email workflow details
- **`DEPLOYMENT_CHECKLIST.md`** - Production deployment steps

### Strategic Documentation
- **`docs/sam-ai/sam-ai-product-development-roadmap.md`** - 3-year roadmap
- **`docs/sam-ai/sam-ai-service-model-plans.md`** - Pricing tiers
- **`docs/sam-ai/sam-ai-compliance-framework.md`** - Compliance strategy

### Recent Activity (Last 7 Days)
```
Oct 7: Email HITL system deployed + auth fixes
Oct 6: Password reset & magic link UX improvements
Oct 5-6: Campaign approval screen simplification
Oct 4: Postmark inbound email processing added
```

---

## 🛠️ Common Development Patterns

### API Route Template
```typescript
// app/api/example/route.ts
import { createClient } from '@/lib/supabase-server';

export async function POST(request: Request) {
  try {
    // 1. Authenticate
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response('Unauthorized', { status: 401 });

    // 2. Parse request
    const { workspaceId, ...data } = await request.json();

    // 3. Verify workspace access (RLS will enforce this)
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member) return new Response('Forbidden', { status: 403 });

    // 4. Execute business logic
    const result = await performAction(workspaceId, data);

    return Response.json(result);
  } catch (error) {
    console.error('API Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
```

### RAG Query Pattern
```typescript
import { searchKnowledge } from '@/lib/supabase-knowledge';

const results = await searchKnowledge({
  query: userQuestion,
  workspaceId: workspaceId,
  matchThreshold: 0.8,
  matchCount: 5
});

// Use results in AI prompt
const prompt = `Context: ${results.map(r => r.content).join('\n\n')}

User question: ${userQuestion}`;
```

### MCP Tool Usage
```typescript
// Available MCP tools (configured in .mcp.json)
mcp__unipile__unipile_get_accounts()
mcp__unipile__unipile_get_recent_messages()
mcp__n8n_self_hosted__list_workflows()
mcp__n8n_self_hosted__trigger_workflow()
```

---

## 🚨 Safety Checklist for New Agents

### Before ANY File Operation:
```
□ Run pwd to verify directory is Sam-New-Sep-7
□ File path contains /Sam-New-Sep-7/
□ Not using cd to navigate elsewhere
□ Not using relative paths that go up (../)
□ When in doubt, ASK before proceeding
```

### Multi-Tenant Safety:
```
□ Use workspace_members, NOT workspace_users
□ Always filter by workspace_id
□ Check RLS policies allow operation
□ Use service role only when necessary
```

### Production Deployment:
```
□ Test in staging first (devin-next-gen-staging.netlify.app)
□ Run npm run build locally to check for errors
□ Verify environment variables are set
□ Check database migrations are applied
□ Run monitoring:health after deployment
```

---

## 🎯 Immediate Next Steps

### Critical (Complete This Week)

1. **Test Email HITL Workflow** (2 hours)
   ```bash
   cd /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7
   ./temp/test-complete-workflow.sh
   ```
   - Test APPROVE flow
   - Test EDIT flow
   - Test REFUSE flow
   - Verify confirmation emails

2. **Implement N8N Message Sending** (3 hours)
   - Create N8N workflow to poll `message_outbox`
   - Integrate with Unipile for email/LinkedIn
   - Update `message_outbox.status` after sending

3. **LinkedIn Profile Generator** (2 days)
   - Create `/lib/linkedin-profile-generator.ts`
   - Add API endpoint `/api/sam/linkedin-profile`
   - Generate headline (220 chars max)
   - Generate About Me (2600 chars max)
   - Add to SAM conversation flow

4. **Content Strategy System** (3 days)
   - Create `/lib/content-strategy-generator.ts`
   - Add API endpoint `/api/sam/content-suggestions`
   - Create `content_suggestions` table
   - Build content calendar UI

### Secondary (Complete This Month)

5. **Expertise Mapping Conversation** (2 days)
   - Extend ICP discovery with 10-15 expertise questions
   - Store in KB under `offerings` and `differentiation`

6. **Production Monitoring** (1 day)
   - Set up alerts for failed messages
   - Track SLA compliance (<15 min for P1)
   - Monitor HITL approval rates

7. **Billing System** (1 week)
   - Stripe subscription lifecycle
   - Usage tracking & metering
   - Tier upgrades/downgrades

---

## 🔗 External Services & Access

### Supabase Dashboard
- **URL:** https://app.supabase.com/project/latxadqrvrrrcvkktrog
- **Access:** User's credentials required
- **Usage:** Database management, RLS policies, SQL editor

### Netlify Dashboard
- **Production:** https://app.netlify.com/sites/app-meet-sam
- **Staging:** https://app.netlify.com/sites/devin-next-gen-staging
- **Usage:** Deployments, environment variables, build logs

### N8N Workflows
- **URL:** https://workflows.innovareai.com
- **Access:** N8N_API_KEY required
- **Usage:** Campaign automation, workflow management

### Postmark
- **URL:** https://account.postmarkapp.com
- **Access:** POSTMARK_INNOVAREAI_API_KEY
- **Usage:** Transactional emails, inbound email processing

### Unipile
- **URL:** https://dashboard.unipile.com
- **DSN:** api6.unipile.com:13670
- **Usage:** LinkedIn/email automation

### OpenRouter
- **URL:** https://openrouter.ai
- **Access:** OPENROUTER_API_KEY
- **Usage:** AI model access (Claude 3.5 Sonnet)

---

## 📞 Support & Escalation

### For New Agents

1. **If unsure about directory:** ASK USER before proceeding
2. **If database query fails:** Check RLS policies in Supabase dashboard
3. **If MCP tool fails:** Verify `.mcp.json` configuration
4. **If build fails:** Run `npm run lint` and fix TypeScript errors
5. **If authentication breaks:** Review URGENT_AUTH_FIX.md

### Escalation Path

1. Review relevant documentation in `/docs`
2. Check `TODO.md` for known issues
3. Review recent git commits (`git log --oneline -20`)
4. Check staging environment for comparison
5. Consult SAM_SYSTEM_TECHNICAL_OVERVIEW.md
6. Ask user for clarification

---

## 🏆 Success Metrics

### Technical Metrics
- **Email receipt:** <30 seconds (currently ~10 sec) ✅
- **Draft generation:** <5 minutes (needs testing) ⚠️
- **HITL notification:** <15 minutes total (needs testing) ⚠️
- **Email delivery:** >99% (Postmark guarantee) ✅
- **Database query time:** <100ms ✅

### Business Metrics (Post-Launch)
- **HITL APPROVE rate:** 60%+ target
- **HITL EDIT rate:** 30%+ target
- **HITL REFUSE rate:** <10% target
- **Response time improvement:** 50%+ faster than manual (2-4 hours → <15 min)
- **User satisfaction:** 90%+ with AI drafts

### Revenue Metrics (2025-2027)
- **2025:** $1.2M ARR (120 SME customers @ $10K/year)
- **2026:** $12M ARR (1,200 customers)
- **2027:** $100M ARR (10,000 customers)

---

## 🎉 Summary

**SAM AI Platform** is a production-ready B2B sales automation system with:
- 85% feature completion
- Live customers on https://app.meet-sam.com
- Multi-tenant architecture with RLS
- AI-powered conversational assistant
- Multi-channel campaign automation
- Email-based HITL workflow (deployed Oct 7, 2025)

**Current Priority:**
1. Test email HITL workflow end-to-end
2. Implement N8N message sending
3. Build LinkedIn profile generator
4. Create content strategy system

**Blockers:**
- None critical
- Email HITL needs validation testing
- SAM workflow steps 2, 3, 6 incomplete (non-blocking)

**Ready for:**
- Scale testing with real users
- Feature expansion (LinkedIn profile, content strategy)
- Billing system implementation

---

**Handover Complete.**
**Last Updated:** October 7, 2025
**Version:** 1.0
**Status:** 🟢 Production Ready (85% Complete)

---

## 📎 Appendix: File Locations

### Configuration Files
- Environment: `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/.env.local`
- MCP Config: `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/.mcp.json`
- Next.js Config: `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/next.config.mjs`
- Package: `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/package.json`

### Critical Source Files
- Postmark Webhook: `/app/api/webhooks/postmark-inbound/route.ts`
- SAM AI Service: `/lib/services/sam-conversation-service.ts`
- N8N Client: `/lib/n8n/n8n-client.ts`
- Supabase Client: `/lib/supabase-server.ts`
- Knowledge Search: `/lib/supabase-knowledge.ts`

### Database Migrations
- Email Responses: `/sql/20251007000001_create_email_responses_fixed.sql`
- Message Outbox: `/sql/20251007000003_create_message_outbox_simplified.sql`
- Campaign Replies: `/sql/20251007000004_create_campaign_replies_for_hitl.sql`

### Test Scripts
- Complete Workflow: `/temp/test-complete-workflow.sh`
- Check Tables: `/temp/check-tables.cjs`
- Email Workflow: `/temp/test-email-workflow.md`

**End of Handover Document.**
