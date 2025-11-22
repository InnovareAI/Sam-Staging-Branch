# SAM AI Platform - Complete Architecture Guide

**Last Updated**: November 22, 2025
**Status**: Production Live (85% Complete)
**Production URL**: https://app.meet-sam.com

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Application Architecture](#application-architecture)
4. [API Routes & Endpoints](#api-routes--endpoints)
5. [Database Schema & RLS](#database-schema--rls)
6. [Component Architecture](#component-architecture)
7. [Service Layer](#service-layer)
8. [Data Flow](#data-flow)
9. [Integration Points](#integration-points)
10. [Deployment & Infrastructure](#deployment--infrastructure)

---

## System Overview

### What is SAM AI?

SAM AI is a B2B sales automation platform combining:

- **LinkedIn Campaign Automation** - Multi-channel prospecting via Unipile API
- **Email Campaign Management** - Postmark + ReachInbox integration
- **AI Conversational Assistant** - Claude 3.5 Sonnet via OpenRouter
- **Knowledge Base (RAG)** - Vector-based contextual AI responses
- **Workflow Automation** - N8N visual workflow engine
- **Human-in-the-Loop Approval** - Manual review before prospect contact
- **Multi-Tenant Architecture** - Complete data isolation using Supabase RLS

### Core Value Proposition

Enable B2B sales teams to:
1. Search LinkedIn for target prospects
2. Approve prospects before outreach (HITL compliance)
3. Send personalized connection requests at scale
4. Manage replies and conversations
5. Get AI-powered suggestions for responses
6. Track campaign metrics and ROI

### Target Market

- **Startup Tier** ($99/mo) - 100 CRs/week, basic email
- **SME Tier** ($399/mo) - 500 CRs/week, advanced features
- **Enterprise** ($899/mo) - Unlimited, custom integrations

---

## Technology Stack

### Frontend & Framework

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Framework | Next.js | 15.5.2 | App Router, SSR, API routes |
| UI Library | React | 18.x | Component framework |
| Language | TypeScript | 5.x | Type safety |
| Styling | Tailwind CSS | 3.4 | Utility-first CSS |
| Components | Shadcn/ui + Radix | Latest | Accessible component library |
| Forms | React Hook Form | 7.x | Form state management |
| State | TanStack Query | 5.x | Server state caching |

### Backend & Data

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Database | Supabase PostgreSQL | Multi-tenant with RLS |
| Auth | Supabase Auth | User authentication & sessions |
| Vector DB | pgvector + Supabase | RAG embeddings |
| ORM | Supabase JS SDK | Database access |

### AI & LLM

| Component | Service | Model |
|-----------|---------|-------|
| Primary LLM | OpenRouter | Claude 3.5 Sonnet (primary), GPT-4o fallback |
| Embeddings | OpenRouter | Text embedding models |
| RAG | pgvector + Supabase | Vector search for context |

### External Integrations

| Service | Purpose | API Type |
|---------|---------|----------|
| **Unipile** | LinkedIn/Email API | REST |
| **N8N** | Workflow automation | Webhook + REST |
| **Postmark** | Transactional email | REST |
| **ReachInbox** | Campaign email | REST |
| **OpenRouter** | LLM access | REST |

### Development Tools

| Tool | Purpose |
|------|---------|
| **Netlify** | Deployment, hosting, edge functions |
| **Vercel (legacy)** | Previous hosting (migrated to Netlify) |
| **GitHub** | Version control, CI/CD |
| **Docker** | N8N containerization |
| **VSCode** | IDE with Claude Code integration |

---

## Application Architecture

### Directory Structure

```
/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/
├── app/                       # Next.js App Router pages
│   ├── api/                   # API routes (79 features, 27+ main endpoints)
│   ├── workspace/[workspaceId]/
│   │   ├── campaign-hub/      # Main campaign UI
│   │   └── layout.tsx
│   ├── admin/                 # Admin panels
│   ├── auth/                  # Authentication flows
│   ├── demo/                  # Demo tenant
│   ├── layout.tsx             # Root layout
│   ├── page.tsx               # Homepage
│   └── providers.tsx          # React context providers
│
├── components/                # React components (94 files)
│   ├── ui/                    # Base UI components (50+ files)
│   ├── campaign/              # Campaign features
│   ├── admin/                 # Admin components
│   ├── dpa/                   # Data Privacy Approval
│   ├── signup/                # Onboarding
│   └── integrations/          # Integration UIs
│
├── lib/                       # Business logic (122 files)
│   ├── services/              # Core services (14 files)
│   ├── ai/                    # AI utilities
│   ├── llm/                   # LLM integration
│   ├── auth/                  # Authentication logic
│   ├── mcp/                   # MCP tool integration
│   ├── n8n/                   # N8N client
│   ├── middleware/            # Request middleware
│   ├── hooks/                 # React custom hooks
│   ├── templates/             # Message templates
│   ├── monitoring/            # Health & metrics
│   └── ...
│
├── public/                    # Static assets
├── sql/                       # Database SQL (64 files)
├── migrations/                # DB migrations (8 files)
├── supabase/                  # Supabase config
├── scripts/                   # Automation scripts
├── docs/                      # Documentation (250+ files)
│
├── package.json               # Dependencies (148 total)
├── next.config.mjs            # Next.js configuration
├── tsconfig.json              # TypeScript config
├── tailwind.config.js         # Tailwind config
├── .mcp.json                  # MCP servers (production)
├── .mcp-dev.json              # MCP servers (development)
├── .env.local                 # Environment variables
└── CLAUDE.md                  # Claude Code instructions
```

### App Router Structure

#### Page Hierarchies

**Workspace Dashboard** (`/workspace/[workspaceId]`):
- Dynamically routed per workspace
- Isolated data via workspace RLS policies
- Sub-routes:
  - `/campaign-hub` - Main campaign management
  - `/settings` - Workspace configuration
  - `/admin` - Admin panel

**Auth Flows** (`/auth`):
- Magic link login: `/auth/magic/[token]`
- OAuth callback: `/auth/callback`
- Password setup: `/auth/setup-password`
- Traditional signin: `/auth/signin`

**Onboarding** (`/signup`):
- Company signup: `/signup/innovareai`
- Completion: `/signup/complete`
- Integrations: `/integrations/linkedin`, `/integrations/unipile`

**Demo Tenant** (`/demo`):
- Hardcoded demo workspace
- Sub-routes mirror workspace structure
- For marketing/demo purposes

---

## API Routes & Endpoints

### Architecture

**Pattern**: RESTful API using Next.js route.ts handler pattern

**Location**: `/app/api/[feature]/route.ts`

**Methods**: GET, POST, PUT, DELETE

**Authentication**: Supabase Auth via Authorization header

**Authorization**: Multi-tenant RLS policies enforce workspace isolation

### Route Categories

#### 1. Campaign Management (18 endpoints)

**Purpose**: Create, manage, execute, and monitor campaigns

```
POST   /api/campaigns                       # Create campaign
GET    /api/campaigns                       # List campaigns
GET    /api/campaigns/[id]                  # Get campaign details
PUT    /api/campaigns/[id]                  # Update campaign
DELETE /api/campaigns/[id]                  # Delete campaign

POST   /api/campaigns/activate              # Activate campaign
POST   /api/campaigns/schedule              # Schedule execution
POST   /api/campaigns/clone                 # Clone campaign
POST   /api/campaigns/upload-prospects      # Bulk upload prospects
POST   /api/campaigns/add-approved-prospects # Add to existing campaign
POST   /api/campaigns/transfer-prospects    # Move prospects
POST   /api/campaigns/sync-linkedin-ids     # Sync LinkedIn IDs
POST   /api/campaigns/ab-testing            # Configure A/B tests
```

**Key Sub-systems**:
- `/api/campaigns/direct/send-connection-requests` - Send CRs via Unipile REST API
- `/api/campaigns/direct/process-follow-ups` - Send follow-up messages
- `/api/campaigns/linkedin/execute-via-n8n` - Execute via N8N workflow
- `/api/campaigns/email/` - Email campaign operations

#### 2. Prospect Management (12 endpoints)

**Purpose**: Human-in-the-loop approval system for prospects

```
GET    /api/prospect-approval               # Get approval list
POST   /api/prospect-approval/upload-csv    # CSV upload
POST   /api/prospect-approval/decide        # Single decision
POST   /api/prospect-approval/bulk-approve  # Batch approve
POST   /api/prospect-approval/approve       # Approve prospect
POST   /api/prospect-approval/reject        # Reject prospect
GET    /api/prospect-approval/prospects     # List prospects
GET    /api/prospect-approval/sessions      # List sessions
```

**Related**:
- `/api/prospects/` - Direct CRUD operations
- `/api/workspace-prospects/` - Workspace-scoped queries

#### 3. LinkedIn Integration (11 endpoints)

**Purpose**: LinkedIn profile search, connection requests, messaging

```
POST   /api/linkedin/search/direct          # Search LinkedIn (Unipile)
GET    /api/linkedin/accounts               # List LinkedIn accounts
POST   /api/linkedin/auth                   # OAuth authentication
GET    /api/linkedin/profiles/[id]          # Get profile data
POST   /api/linkedin/connections            # Manage connections
POST   /api/linkedin/messaging              # Send messages
```

**LinkedIn Commenting**:
- `/api/linkedin-commenting/monitors` - Setup comment monitoring
- `/api/linkedin-commenting/monitors/poll` - Poll for posts
- `/api/linkedin-commenting/post` - Post management

#### 4. SAM AI Features (8 endpoints)

**Purpose**: Conversational AI assistant with RAG knowledge base

```
POST   /api/sam/threads                     # Create conversation thread
GET    /api/sam/threads/[id]                # Get thread history
POST   /api/sam/messages                    # Send message
GET    /api/sam/context                     # Get RAG context
POST   /api/sam/knowledge                   # Search knowledge base
```

#### 5. Email & Messaging (10 endpoints)

**Purpose**: Message CRUD, template management, reply handling

```
POST   /api/messages                        # Create message
GET    /api/messages                        # List messages
GET    /api/messages/[id]                   # Get message
POST   /api/messaging/send                  # Send message
POST   /api/messaging-templates             # Manage templates
POST   /api/replies/[id]/draft              # Generate reply draft
POST   /api/replies/[id]/approve            # Approve reply
```

#### 6. Integrations (14 endpoints)

**Purpose**: Connect external services

```
POST   /api/unipile/[operation]             # Unipile API wrapper
POST   /api/n8n/[workflow]                  # N8N execution
POST   /api/webhooks/unipile                # Unipile webhook receiver
POST   /api/webhooks/postmark               # Postmark webhook receiver
POST   /api/webhooks/n8n                    # N8N webhook receiver
```

**MCP Integration**:
- `/api/mcp` - MCP tools availability
- `/api/mcp/execute` - Execute MCP tools

#### 7. Admin & System (20+ endpoints)

**Purpose**: System administration, monitoring, health checks

```
GET    /api/admin/health                    # System health
GET    /api/admin/settings                  # System settings
POST   /api/admin/settings                  # Update settings
GET    /api/cron/                           # Cron job status
GET    /api/workspace/[id]                  # Get workspace details
POST   /api/user/profile                    # User profile
GET    /api/organization                    # Organization info
```

**Cron Jobs**:
- `/api/cron/process-pending-prospects` - Process prospects every 5 min
- `/api/cron/poll-accepted-connections` - Check connection status
- `/api/cron/check-pending-notifications` - Process notifications

#### 8. Knowledge Base (4 endpoints)

**Purpose**: RAG vector search for AI context

```
POST   /api/kb/search                       # Search knowledge base
GET    /api/kb/[id]                         # Get KB entry
POST   /api/kb/                             # Create KB entry
POST   /api/knowledge/embed                 # Embed new knowledge
```

### Request/Response Patterns

**Successful Response (200 OK)**:
```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Operation successful"
}
```

**Error Response (400+)**:
```json
{
  "success": false,
  "error": "Error description",
  "code": "ERROR_CODE",
  "details": { /* additional info */ }
}
```

### Authentication & Authorization

**Header Format**:
```
Authorization: Bearer [supabase_jwt_token]
Content-Type: application/json
```

**RLS Enforcement**:
- All database queries use authenticated user's workspace ID
- Supabase RLS policies automatically filter data by workspace
- Admin endpoints use service role key for elevated access

---

## Database Schema & RLS

### Database Overview

**Type**: PostgreSQL via Supabase
**Total Tables**: 30+
**Row Level Security**: Enabled on all tables
**Vector Search**: pgvector for RAG embeddings
**Replication**: Real-time subscriptions enabled

### Core Tables

#### Multi-Tenancy Tables

**`workspaces`** - Tenant containers
```sql
id (uuid, pk)
name (text)
slug (text, unique)
created_at (timestamp)
updated_at (timestamp)
status (enum: active, suspended, deleted)
tier (enum: startup, sme, enterprise)
owner_id (uuid, fk: users)
```

**`workspace_members`** - User-workspace access control
```sql
id (uuid, pk)
workspace_id (uuid, fk: workspaces)
user_id (uuid, fk: users)
role (enum: owner, admin, member)
status (enum: active, invited, removed)
permissions (jsonb)
created_at (timestamp)
```

**`users`** - User accounts
```sql
id (uuid, pk)
email (text, unique)
name (text)
current_workspace_id (uuid, fk: workspaces)
auth_provider (enum: supabase, oauth)
created_at (timestamp)
updated_at (timestamp)
```

#### Campaign Tables

**`campaigns`** - Campaign definitions
```sql
id (uuid, pk)
workspace_id (uuid, fk: workspaces)
campaign_name (text)
status (enum: draft, active, paused, completed, archived)
campaign_type (enum: connection_request, email, linkedin_comment, skill_endorsement)
linkedin_account_id (uuid, fk: workspace_accounts)
message_templates (jsonb)
  └── connection_request (text)
  └── follow_up_1..5 (array of text)
  └── goodbye_message (text)
scheduled_at (timestamp)
starts_at (timestamp)
ends_at (timestamp)
created_at (timestamp)
updated_at (timestamp)
```

**`campaign_prospects`** - Prospects in campaigns
```sql
id (uuid, pk)
campaign_id (uuid, fk: campaigns)
workspace_id (uuid, fk: workspaces)
first_name (text)
last_name (text)
email (text)
linkedin_url (text)          # CLEANED: No query params
linkedin_user_id (text)      # Provider ID from Unipile
company_name (text)
title (text)
location (text)
status (enum: pending, approved, connection_request_sent,
               connected, messaging, replied, failed)
contacted_at (timestamp)
follow_up_due_at (timestamp)
follow_up_sequence_index (int)
notes (text)
created_at (timestamp)
updated_at (timestamp)
```

**`campaign_executions`** - Campaign run history
```sql
id (uuid, pk)
campaign_id (uuid, fk: campaigns)
executed_at (timestamp)
prospects_processed (int)
successful (int)
failed (int)
results (jsonb)
```

#### Communication Tables

**`messages`** - Message records
```sql
id (uuid, pk)
workspace_id (uuid, fk: workspaces)
conversation_id (uuid, fk: conversations)
sender_id (uuid, fk: users or system)
message_type (enum: connection_request, direct_message, email, ai_response)
content (text)
metadata (jsonb)
created_at (timestamp)
updated_at (timestamp)
```

**`conversations`** - Conversation threads
```sql
id (uuid, pk)
workspace_id (uuid, fk: workspaces)
prospect_id (uuid, fk: prospects)
contact_email (text)
contact_linkedin_url (text)
status (enum: active, closed, archived)
last_message_at (timestamp)
created_at (timestamp)
```

#### Knowledge Base (RAG)

**`knowledge_base`** - KB content with vectors
```sql
id (uuid, pk)
workspace_id (uuid, fk: workspaces)
title (text)
content (text)
embedding (vector(1536))      # pgvector for semantic search
source_type (enum: uploaded, crawled, synced)
category (text)
created_at (timestamp)
updated_at (timestamp)
```

**`knowledge_base_sections`** - Section hierarchy
```sql
id (uuid, pk)
parent_id (uuid, self-reference)
title (text)
order (int)
```

#### SAM AI Tables

**`sam_conversations`** - SAM AI conversations
```sql
id (uuid, pk)
workspace_id (uuid, fk: workspaces)
user_id (uuid, fk: users)
topic (text)
status (enum: active, archived)
created_at (timestamp)
```

**`sam_messages`** - SAM AI message history
```sql
id (uuid, pk)
conversation_id (uuid, fk: sam_conversations)
role (enum: user, assistant)
content (text)
context_used (jsonb)          # KB entries used for response
model_used (text)
tokens_used (int)
created_at (timestamp)
```

#### Integration Tables

**`workspace_accounts`** - Multi-account management
```sql
id (uuid, pk)
workspace_id (uuid, fk: workspaces)
account_type (enum: linkedin, email, webhook)
account_name (text)
unipile_account_id (text)     # Unipile provider account ID
status (enum: connected, disconnected, error)
rate_limit_remaining (int)
rate_limit_reset_at (timestamp)
metadata (jsonb)
created_at (timestamp)
updated_at (timestamp)
```

**`approval_sessions`** - DPA approval sessions
```sql
id (uuid, pk)
workspace_id (uuid, fk: workspaces)
user_id (uuid, fk: users)
campaign_name (text)
campaign_tag (text)
status (enum: active, completed, abandoned)
total_prospects (int)
pending_count (int)
approved_count (int)
rejected_count (int)
created_at (timestamp)
```

**`approval_decisions`** - User decisions
```sql
id (uuid, pk)
session_id (uuid, fk: approval_sessions)
prospect_id (uuid)
decision (enum: approved, rejected, flagged)
notes (text)
decided_at (timestamp)
```

### RLS Policies

**Pattern**: All tables enforce workspace isolation

**Example Policy**:
```sql
-- Users can only access data in their workspace
CREATE POLICY workspace_isolation ON campaigns
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );
```

**Enforce on**:
- All campaign tables
- All prospect tables
- All message tables
- Knowledge base
- SAM AI conversations

### Migrations

**Location**: `/migrations/` (8 files)

**Key Migrations**:
1. `001_initial_schema.sql` - Initial schema
2. `002_add_vectors.sql` - pgvector for RAG
3. `003_backfill_workspace_ids.sql` - Add workspace isolation
4. `04_seed_kb_sections.sql` - Seed knowledge base
5. `05_import_legacy_data.sql` - Data migration

---

## Component Architecture

### Component Organization

**Location**: `/components` (94 files across 8 categories)

### Base UI Components (`/components/ui`)

**Radix UI Wrapper Components** (50+ files):
```
button.tsx         - Primary CTA button
card.tsx           - Content container
dialog.tsx         - Modal dialog
input.tsx          - Text input field
select.tsx         - Dropdown select
textarea.tsx       - Multi-line input
tabs.tsx           - Tab navigation
badge.tsx          - Status/tag badge
avatar.tsx         - User avatar
table.tsx          - Data table
dropdown.tsx       - Dropdown menu
tooltip.tsx        - Hover tooltip
popover.tsx        - Content popover
sheet.tsx          - Side sheet drawer
... (30+ more)
```

**Pattern**: All Radix UI components wrapped with Tailwind classes

### Feature Components

#### Campaign Components (`/components/campaign`)

**CampaignHub.tsx** (Main Interface):
- List all campaigns
- Create new campaign
- Edit campaign
- Pause/Resume campaign
- View prospects
- View messages
- Launch campaign

**CampaignCard.tsx**:
- Campaign name & status
- Prospect count
- Message count
- Last updated
- Action buttons

**CampaignForm.tsx**:
- Campaign type selector
- Name input
- LinkedIn account selector
- Message template editor
- Schedule configuration

**ProspectUploader.tsx**:
- CSV file upload
- LinkedIn URL extraction
- Data preview
- Bulk add to campaign

**MessageTemplateEditor.tsx**:
- Connection request message
- Follow-up sequences (1-5)
- Goodbye message
- Variables: {first_name}, {last_name}, {company}
- Preview

#### Admin Components (`/components/admin`)

**AdminDashboard.tsx**:
- System health
- User management
- Workspace settings
- Integration status

**UserManager.tsx**:
- List users
- Invite new users
- Manage roles
- Revoke access

**WorkspaceManager.tsx**:
- Workspace settings
- Billing information
- Usage metrics
- API keys

#### Data Privacy Approval (`/components/dpa`)

**DPAWorkflow.tsx**:
- List prospects for approval
- Show prospect details
- Approve/Reject buttons
- Add notes

**ProspectReview.tsx**:
- Display prospect info
- LinkedIn profile preview
- Company details
- Enrichment score

**DecisionForm.tsx**:
- Approve/Reject/Flag options
- Notes input
- Submit decision

### Component Props Pattern

**Example**:
```typescript
interface CampaignCardProps {
  campaign: Campaign;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
}

export function CampaignCard({ campaign, onEdit, onDelete, isLoading }: CampaignCardProps) {
  // Component implementation
}
```

### Styling

**Framework**: Tailwind CSS
**Components**: Shadcn/ui (Radix UI + Tailwind)
**Dark Mode**: Enabled via CSS variables

**Color Scheme**:
```css
/* Primary */
--primary: 214 88% 46%        /* Blue */

/* Secondary */
--secondary: 217 33% 17%      /* Dark gray */

/* Accent */
--accent: 210 40% 96%         /* Light blue */

/* Destructive */
--destructive: 0 84% 60%      /* Red */
```

---

## Service Layer

### Services Architecture

**Location**: `/lib/services` (14 core services)

### 1. Unipile Sender Service

**File**: `lib/services/unipile-sender.ts`

**Purpose**: Send connection requests, messages via Unipile

**Key Functions**:
```typescript
async function sendConnectionRequest(
  unipileAccountId: string,
  linkedinUrl: string,
  message: string
): Promise<SendResult>

async function getLinkedInProfile(
  unipileAccountId: string,
  linkedinUrl: string
): Promise<LinkedInProfile>

async function checkInvitationStatus(
  unipileAccountId: string,
  linkedinUrl: string
): Promise<InvitationStatus>
```

**Integration**: Called from `/api/campaigns/direct/send-connection-requests`

### 2. LinkedIn Commenting Agent

**File**: `lib/services/linkedin-commenting-agent.ts`

**Purpose**: Monitor LinkedIn posts, generate AI comments

**Workflow**:
1. Monitor hashtags/profiles
2. Detect new posts (polling)
3. Generate AI comments
4. Post comments automatically

**Key Functions**:
```typescript
async function monitorHashtags(hashtags: string[]): Promise<void>
async function generateComments(post: Post): Promise<string[]>
async function postComment(postId: string, comment: string): Promise<void>
```

### 3. Reply Agent

**File**: `lib/services/reply-agent-draft-generation.ts`

**Purpose**: Generate AI responses to incoming messages

**Workflow**:
1. Receive incoming message
2. Get prospect context
3. Generate 3 draft replies
4. Show to human for approval
5. Send approved reply

**Key Functions**:
```typescript
async function generateReplyDrafts(
  message: string,
  prospectId: string,
  context: ProspectContext
): Promise<string[]>

async function enrichMessageContext(
  prospectId: string
): Promise<ProspectContext>
```

### 4. Follow-up Agent

**File**: `lib/services/follow-up-agent.ts`

**Purpose**: Automatically send follow-up messages

**Workflow**:
1. Check due dates (`follow_up_due_at`)
2. Get campaign follow-up templates
3. Personalize message
4. Send via Unipile
5. Update `follow_up_sequence_index`

**Sequence Timing**:
- CR sent → Wait 3 days
- Follow-up 1 → 5 days later
- Follow-up 2 → 7 days later
- ...up to 5 follow-ups

### 5. Knowledge Base Services

**Files**:
- `lib/services/knowledge-extraction.ts` - Extract knowledge from sources
- `lib/services/knowledge-classifier.ts` - Categorize KB content

**Purpose**: Manage RAG vector embeddings

**Workflow**:
1. Upload document/content
2. Extract text chunks
3. Generate embeddings
4. Store in pgvector
5. Use for RAG context retrieval

### 6. Data Enrichment Service

**File**: `lib/services/prospect-research.ts`

**Purpose**: Enrich prospect data from external sources

**Integration**: Bright Data, Apollo, LinkedIn Sales Navigator

**Enriches**:
- Email addresses
- Phone numbers
- Company information
- Job history
- Skills

### 7. Approval System Service

**File**: `lib/services/hitl-approval-email-service.ts`

**Purpose**: Send approval workflows via email

**Workflow**:
1. Upload prospects
2. Create approval session
3. Email user for review
4. User approves/rejects
5. Approved go to campaign

---

## Data Flow

### Campaign Creation to Execution

```
1. USER CREATES CAMPAIGN
   └─ POST /api/campaigns
      └─ Store in campaigns table
      └─ Get LinkedIn account (workspace_accounts)

2. USER UPLOADS PROSPECTS
   └─ POST /api/campaigns/upload-prospects
      └─ Parse CSV file
      └─ Extract names, LinkedIn URLs
      └─ Clean LinkedIn URLs (remove miniProfileUrn)
      └─ Create approval session
      └─ Store in prospect_approval_data

3. USER APPROVES PROSPECTS
   └─ POST /api/prospect-approval/approve
      └─ Move from approval_data to campaign_prospects
      └─ Set status = "approved"
      └─ Store provider_id (authoritative LinkedIn ID)

4. USER LAUNCHES CAMPAIGN
   └─ POST /api/campaigns/activate
      └─ Set campaign status = "active"
      └─ Trigger: /api/cron/process-pending-prospects

5. CRON JOB PROCESSES PROSPECTS
   └─ GET /api/cron/process-pending-prospects (every 5 min)
      └─ Find pending prospects
      └─ For each prospect:
         ├─ Fetch LinkedIn profile via Unipile
         ├─ Get provider_id (authoritative ID)
         ├─ Check invitation status
         ├─ Personalize message
         └─ Send CR via Unipile REST API
      └─ Update status = "connection_request_sent"
      └─ Schedule follow-up (3 days later)

6. MONITOR CONNECTIONS
   └─ GET /api/cron/poll-accepted-connections (every 30 min)
      └─ Check which CRs were accepted
      └─ Update status = "connected"
      └─ Trigger follow-up message

7. FOLLOW-UP MESSAGES
   └─ Service: follow-up-agent.ts
      └─ Check follow_up_due_at
      └─ Get next follow-up template
      └─ Send via Unipile
      └─ Increment follow_up_sequence_index

8. INCOMING REPLIES
   └─ Webhook: POST /api/webhooks/unipile
      └─ Receive message event
      └─ Store in conversations & messages
      └─ Create approval task for human
      └─ Generate AI drafts (reply-agent)
      └─ Human approves/edits
      └─ Send approved reply
```

### LinkedIn URL Cleaning (Critical Fix)

**Problem**: Unipile search returns URLs with `miniProfileUrn` query parameter that encodes a different provider_id

**Example**:
```
Original: https://www.linkedin.com/in/ronaldding?miniProfileUrn=urn:li:fs_miniProfile:ACoAABiau...
Cleaned:  https://www.linkedin.com/in/ronaldding
```

**Where URLs are Cleaned**:

1. **LinkedIn Search** (`/api/linkedin/search/direct`):
   ```typescript
   const cleanLinkedInUrl = (url: string) => {
     const match = url.match(/linkedin\.com\/in\/([^/?#]+)/);
     if (match) return `https://www.linkedin.com/in/${match[1]}`;
     return url;
   };
   ```

2. **CSV Upload** (`/api/prospect-approval/upload-prospects`):
   - Added URL cleaning function
   - Cleans before storing in approval_data

3. **Add Approved Prospects** (`/api/campaigns/add-approved-prospects`):
   - Cleans before storing in campaign_prospects

4. **Send Connection Requests** (`/api/campaigns/direct/send-connection-requests`):
   - Final cleanup before sending to Unipile

---

## Integration Points

### Unipile (LinkedIn/Email)

**Provider**: Unipile API (`api6.unipile.com:13670`)

**Use Cases**:
- Search LinkedIn
- Fetch profile data
- Send connection requests
- Send direct messages
- Receive inbound messages (webhook)

**API Pattern**:
```typescript
const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;

async function unipileRequest(endpoint: string, options: RequestInit) {
  const response = await fetch(`${UNIPILE_BASE_URL}${endpoint}`, {
    headers: {
      'X-Api-Key': process.env.UNIPILE_API_KEY,
      'Accept': 'application/json'
    },
    ...options
  });
  return response.json();
}
```

**Key Endpoints**:
- `POST /api/v1/users/invite` - Send connection request
- `GET /api/v1/users/profile` - Get profile data
- `POST /api/v1/messages` - Send message
- `POST /api/v1/messages/search` - Search LinkedIn

### N8N (Workflow Automation)

**Purpose**: Complex multi-step campaign orchestration

**Setup**:
- Self-hosted at `https://workflows.innovareai.com`
- Per-workspace workflow instances

**Workflow Example**:
```
1. Receive prospect batch → 2. Enrich data → 3. Check duplicates
→ 4. Send CRs → 5. Log results → 6. Update DB
```

**Integration**:
```typescript
// From /lib/n8n/n8n-client.ts
const N8N_API_KEY = process.env.N8N_API_KEY;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

async function executeWorkflow(workflowId: string, payload: any) {
  const response = await fetch(
    `${N8N_WEBHOOK_URL}/webhook/workflow-trigger`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${N8N_API_KEY}` },
      body: JSON.stringify(payload)
    }
  );
  return response.json();
}
```

### OpenRouter (LLM)

**Purpose**: Claude 3.5 Sonnet via OpenRouter

**Use Cases**:
- Generate reply drafts
- Generate LinkedIn comments
- Analyze conversations
- Classify prospects

**Integration**:
```typescript
// From /lib/llm/openrouter-client.ts
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

async function generateReply(context: string): Promise<string> {
  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-3.5-sonnet',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: context }
      ],
      max_tokens: 1000
    })
  });
  return response.json();
}
```

### Postmark (Email)

**Purpose**: Transactional emails

**Use Cases**:
- Send approval workflow emails
- System notifications
- Welcome emails

**Integration**:
```typescript
const POSTMARK_API_KEY = process.env.POSTMARK_SERVER_TOKEN;

async function sendEmail(to: string, subject: string, body: string) {
  const response = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      'X-Postmark-Server-Token': POSTMARK_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      From: 'noreply@meet-sam.com',
      To: to,
      Subject: subject,
      HtmlBody: body
    })
  });
  return response.json();
}
```

### MCP (Model Context Protocol)

**Purpose**: Standardized tool integration for AI

**Available Tools**:
```
mcp__unipile__unipile_get_accounts()
mcp__unipile__unipile_get_recent_messages()
mcp__n8n_self_hosted__list_workflows()
```

**Configuration**: `.mcp.json` (production), `.mcp-dev.json` (development)

---

## Deployment & Infrastructure

### Deployment Architecture

```
GitHub Repository
├─ main branch push
└─ Trigger Netlify build
   ├─ Build Next.js (standalone output)
   ├─ Run lint/typecheck
   ├─ Create edge functions
   ├─ Deploy to Netlify CDN
   └─ Update production at https://app.meet-sam.com
```

### Netlify Configuration

**File**: `next.config.mjs`

**Settings**:
- Output: `standalone` (optimized for Netlify Functions)
- Functions: Convert API routes to serverless functions
- Edge Cache: 60 seconds default
- Custom headers: Security headers

### Environment Variables

**Production** (`.env.production`):
```env
NEXT_PUBLIC_SUPABASE_URL=https://latxadqrvrrrcvkktrog.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon_key]
SUPABASE_SERVICE_ROLE_KEY=[service_role_key]
OPENROUTER_API_KEY=[api_key]
UNIPILE_DSN=api6.unipile.com:13670
UNIPILE_API_KEY=[api_key]
N8N_WEBHOOK_URL=https://workflows.innovareai.com
N8N_API_KEY=[api_key]
POSTMARK_SERVER_TOKEN=[token]
```

**Development** (`.env.local`):
- Same as production but with development credentials
- Can use localhost URLs for N8N, Supabase

### Database Backups

**Supabase**: Automated daily backups, 30-day retention

**Access**: Supabase dashboard → Database → Backups

### Monitoring

**Endpoint**: `/api/admin/health`

**Checks**:
- Supabase connection
- Unipile connectivity
- N8N webhook health
- Database table row counts
- API response times

**Metrics**:
- Campaign success rate
- Average response time
- Error rate by endpoint
- Cron job execution logs

---

## Summary

This architecture provides:

✅ **Multi-tenant isolation** via Supabase RLS
✅ **Scalable campaign execution** via direct Unipile API + N8N
✅ **AI-powered responses** via OpenRouter Claude
✅ **Human-in-the-loop approval** for compliance
✅ **RAG knowledge base** for contextual AI
✅ **Real-time updates** via Supabase subscriptions
✅ **Secure authentication** via Supabase Auth
✅ **Automated workflows** via N8N + cron jobs

**Next Steps for Development**:
1. See `SAM_FEATURE_ROLLOUT_PLAN.md` for roadmap
2. Check `QUICK_START_GUIDE.md` for local dev setup
3. Review recent `HANDOVER_*.md` docs for known issues
