# SAM AI Platform - Database Schema & RLS Guide

**Last Updated**: November 22, 2025
**Database**: Supabase PostgreSQL
**Total Tables**: 32
**RLS Enabled**: Yes, on all tables

---

## Table of Contents

1. [Overview](#overview)
2. [Multi-Tenancy Architecture](#multi-tenancy-architecture)
3. [Core Tables](#core-tables)
4. [Campaign Tables](#campaign-tables)
5. [Communication Tables](#communication-tables)
6. [Knowledge Base (RAG)](#knowledge-base-rag)
7. [Integration Tables](#integration-tables)
8. [RLS Policies](#rls-policies)
9. [Migrations](#migrations)
10. [Query Examples](#query-examples)

---

## Overview

### Database Architecture

```
Supabase PostgreSQL
├── Multi-tenant isolation via RLS policies
├── Vector embeddings (pgvector) for RAG
├── Real-time subscriptions enabled
├── Automated backups (daily)
└── 30+ tables with relationships
```

### Key Features

- **Multi-Tenancy**: Complete data isolation using Supabase RLS
- **Vector Search**: pgvector for semantic search in knowledge base
- **Real-time**: Supabase real-time subscriptions on tables
- **Encryption**: PII encrypted at rest
- **Compliance**: GDPR-compliant data deletion, audit logs

---

## Multi-Tenancy Architecture

### Fundamental Principle

**All data belongs to a workspace. Users can only access their workspace's data.**

### Enforcement Strategy

```sql
-- Example RLS policy
CREATE POLICY workspace_isolation ON campaigns
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );
```

### Permission Hierarchy

```
Workspace (tenant container)
├── Owner (full access, billing)
├── Admin (manage users, settings)
└── Member (create campaigns, view data)
     ├── Can create campaigns
     ├── Can upload prospects
     ├── Can view own campaigns
     └── Cannot view other members' campaigns
```

---

## Core Tables

### `workspaces` - Tenant containers

```sql
Table: workspaces
├── Columns:
│   ├── id (uuid, primary key)
│   ├── name (text, required)
│   ├── slug (text, unique)
│   ├── description (text)
│   ├── owner_id (uuid, foreign key → users)
│   ├── status (enum: active, suspended, deleted)
│   ├── tier (enum: startup, sme, enterprise)
│   ├── features (jsonb)
│   ├── settings (jsonb)
│   │   └── { "max_campaigns": 50, "max_prospects": 10000 }
│   ├── created_at (timestamp)
│   ├── updated_at (timestamp)
│   └── deleted_at (timestamp, soft delete)
│
├── Indexes:
│   ├── id (primary key)
│   ├── slug (unique)
│   └── owner_id (foreign key)
│
└── RLS:
    └── SELECT: User must be workspace member
        UPDATE: Owner or admin only
        DELETE: Owner only
```

**Example Row**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Tech Sales Inc",
  "slug": "tech-sales-inc",
  "owner_id": "660e8400-e29b-41d4-a716-446655440000",
  "status": "active",
  "tier": "enterprise",
  "features": ["linkedin_campaigns", "email_campaigns", "sam_ai"],
  "created_at": "2025-01-15T10:00:00Z"
}
```

### `workspace_members` - User-workspace access control

```sql
Table: workspace_members
├── Columns:
│   ├── id (uuid, primary key)
│   ├── workspace_id (uuid, foreign key → workspaces)
│   ├── user_id (uuid, foreign key → users)
│   ├── role (enum: owner, admin, member)
│   ├── status (enum: active, invited, suspended, removed)
│   ├── permissions (jsonb)
│   │   └── { "can_create_campaigns": true, "can_approve_prospects": false }
│   ├── invited_at (timestamp)
│   ├── accepted_at (timestamp)
│   ├── created_at (timestamp)
│   └── updated_at (timestamp)
│
├── Indexes:
│   ├── workspace_id (composite: workspace_id, user_id)
│   ├── user_id (composite)
│   └── status
│
├── Constraints:
│   └── UNIQUE (workspace_id, user_id)
│
└── RLS:
    └── SELECT: User can see their own membership
        UPDATE: Workspace owner/admin only
```

**Example Row**:
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440000",
  "workspace_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "660e8400-e29b-41d4-a716-446655440000",
  "role": "owner",
  "status": "active",
  "permissions": {"can_create_campaigns": true},
  "created_at": "2025-01-15T10:00:00Z"
}
```

### `users` - User accounts

```sql
Table: users
├── Columns:
│   ├── id (uuid, primary key, from auth.users)
│   ├── email (text, unique)
│   ├── name (text)
│   ├── avatar_url (text)
│   ├── current_workspace_id (uuid, foreign key → workspaces)
│   ├── auth_provider (enum: supabase, oauth, saml)
│   ├── timezone (text, default: 'UTC')
│   ├── preferences (jsonb)
│   │   └── { "notifications_enabled": true, "dark_mode": false }
│   ├── created_at (timestamp)
│   ├── updated_at (timestamp)
│   └── deleted_at (timestamp, soft delete)
│
├── Indexes:
│   ├── email (unique)
│   └── current_workspace_id
│
└── RLS:
    └── SELECT: User can see themselves
        UPDATE: User can update their own profile
```

**Relationship**: Linked to Supabase `auth.users` table

---

## Campaign Tables

### `campaigns` - Campaign definitions

```sql
Table: campaigns
├── Columns:
│   ├── id (uuid, primary key)
│   ├── workspace_id (uuid, foreign key → workspaces)
│   ├── campaign_name (text, required)
│   ├── campaign_type (enum)
│   │   ├── connection_request (LinkedIn CRs)
│   │   ├── direct_message (LinkedIn DMs)
│   │   ├── email (Email campaigns)
│   │   ├── linkedin_comment (Auto-comment campaigns)
│   │   ├── skill_endorsement (LinkedIn endorsements)
│   │   └── inmail (LinkedIn InMail)
│   ├── status (enum)
│   │   ├── draft (not yet launched)
│   │   ├── active (currently sending)
│   │   ├── paused (temporarily stopped)
│   │   ├── completed (finished)
│   │   ├── failed (error state)
│   │   └── archived (historical)
│   ├── linkedin_account_id (uuid, foreign key → workspace_accounts)
│   ├── message_templates (jsonb)
│   │   ├── connection_request (text)
│   │   ├── follow_up_1..5 (array)
│   │   └── goodbye_message (text)
│   ├── variables (jsonb)
│   │   └── ["first_name", "last_name", "company", "title"]
│   ├── scheduled_at (timestamp)
│   ├── starts_at (timestamp)
│   ├── ends_at (timestamp)
│   ├── created_at (timestamp)
│   ├── updated_at (timestamp)
│   └── created_by (uuid, foreign key → users)
│
├── Indexes:
│   ├── workspace_id
│   ├── linkedin_account_id
│   ├── status
│   └── created_at
│
└── RLS:
    └── SELECT/UPDATE/DELETE: Workspace members only
```

**Example Row**:
```json
{
  "id": "880e8400-e29b-41d4-a716-446655440000",
  "workspace_id": "550e8400-e29b-41d4-a716-446655440000",
  "campaign_name": "Q4 VP Sales Outreach",
  "campaign_type": "connection_request",
  "status": "active",
  "linkedin_account_id": "990e8400-e29b-41d4-a716-446655440000",
  "message_templates": {
    "connection_request": "Hi {first_name}, I'd like to connect...",
    "follow_up_1": "Following up on my request...",
    "follow_up_2": null,
    "follow_up_3": null,
    "follow_up_4": null,
    "follow_up_5": null,
    "goodbye_message": "All the best!"
  },
  "scheduled_at": null,
  "starts_at": "2025-11-22T09:00:00Z",
  "ends_at": null,
  "created_at": "2025-11-20T10:00:00Z"
}
```

### `campaign_prospects` - Prospects in campaigns

```sql
Table: campaign_prospects
├── Columns:
│   ├── id (uuid, primary key)
│   ├── campaign_id (uuid, foreign key → campaigns)
│   ├── workspace_id (uuid, foreign key → workspaces)
│   ├── first_name (text)
│   ├── last_name (text)
│   ├── email (text)
│   ├── linkedin_url (text)
│   │   └── CLEANED: No query parameters (miniProfileUrn removed)
│   ├── linkedin_user_id (text)
│   │   └── Provider ID from Unipile (authoritative LinkedIn ID)
│   ├── company_name (text)
│   ├── title (text)
│   ├── location (text)
│   ├── status (enum)
│   │   ├── pending (not yet contacted)
│   │   ├── approved (human approved)
│   │   ├── connection_request_sent (CR sent to LinkedIn)
│   │   ├── connected (accepted connection)
│   │   ├── messaging (in conversation)
│   │   ├── replied (sent reply)
│   │   ├── failed (error - see notes)
│   │   └── opted_out (unsubscribed)
│   ├── contacted_at (timestamp)
│   │   └── When CR was sent (null if not sent)
│   ├── follow_up_due_at (timestamp)
│   │   └── When next follow-up should be sent
│   ├── follow_up_sequence_index (int)
│   │   └── 0: before CR, 1: first follow-up, 5: fifth follow-up
│   ├── notes (text)
│   │   └── Reason for failure, user notes, etc.
│   ├── created_at (timestamp)
│   ├── updated_at (timestamp)
│   └── added_by_unipile_account (uuid)
│       └── Which Unipile account added this prospect
│
├── Indexes:
│   ├── campaign_id
│   ├── workspace_id
│   ├── linkedin_url
│   ├── status
│   ├── contacted_at
│   └── follow_up_due_at
│
├── Constraints:
│   └── UNIQUE (campaign_id, linkedin_url)
│       └── One prospect per campaign
│
└── RLS:
    └── SELECT/UPDATE: Workspace members only
```

**Example Rows**:
```json
{
  "id": "001e8400-e29b-41d4-a716-446655440000",
  "campaign_id": "880e8400-e29b-41d4-a716-446655440000",
  "workspace_id": "550e8400-e29b-41d4-a716-446655440000",
  "first_name": "Jane",
  "last_name": "Smith",
  "email": "jane@techcorp.com",
  "linkedin_url": "https://www.linkedin.com/in/janesmith",
  "linkedin_user_id": "ACoAABiau-UBgtBnKlyXT-XncVdVUp4yevQ8HmM",
  "company_name": "Tech Corp",
  "title": "VP of Sales",
  "location": "San Francisco, CA",
  "status": "connection_request_sent",
  "contacted_at": "2025-11-22T14:30:00Z",
  "follow_up_due_at": "2025-11-25T14:30:00Z",
  "follow_up_sequence_index": 0,
  "notes": null,
  "created_at": "2025-11-20T10:00:00Z"
}
```

### `campaign_executions` - Campaign run history

```sql
Table: campaign_executions
├── Columns:
│   ├── id (uuid, primary key)
│   ├── campaign_id (uuid, foreign key → campaigns)
│   ├── executed_at (timestamp)
│   ├── prospects_processed (int)
│   ├── successful (int)
│   ├── failed (int)
│   ├── rate_limited (int)
│   ├── results (jsonb)
│   │   ├── { "sent": 10, "failed": 2, "details": [...] }
│   ├── error_logs (text)
│   └── created_at (timestamp)
│
├── Indexes:
│   ├── campaign_id
│   └── executed_at
│
└── RLS:
    └── SELECT: Workspace members only
```

---

## Communication Tables

### `conversations` - Conversation threads

```sql
Table: conversations
├── Columns:
│   ├── id (uuid, primary key)
│   ├── workspace_id (uuid, foreign key → workspaces)
│   ├── prospect_id (uuid, foreign key → campaign_prospects)
│   ├── contact_email (text)
│   ├── contact_linkedin_url (text)
│   ├── subject (text)
│   ├── status (enum: active, closed, archived)
│   ├── last_message_at (timestamp)
│   ├── last_message_from (enum: inbound, outbound)
│   ├── message_count (int)
│   ├── reply_count (int)
│   ├── created_at (timestamp)
│   └── updated_at (timestamp)
│
├── Indexes:
│   ├── prospect_id
│   ├── workspace_id
│   ├── status
│   └── last_message_at
│
└── RLS:
    └── SELECT/UPDATE: Workspace members only
```

### `messages` - Message records

```sql
Table: messages
├── Columns:
│   ├── id (uuid, primary key)
│   ├── workspace_id (uuid, foreign key → workspaces)
│   ├── conversation_id (uuid, foreign key → conversations)
│   ├── campaign_id (uuid, foreign key → campaigns, nullable)
│   ├── sender_id (uuid, foreign key → users, nullable)
│   │   └── null for system-sent messages
│   ├── sender_type (enum: user, system, ai)
│   ├── message_type (enum)
│   │   ├── connection_request
│   │   ├── follow_up_1..5
│   │   ├── direct_message
│   │   ├── email
│   │   ├── ai_draft
│   │   └── ai_response
│   ├── content (text)
│   ├── status (enum: draft, sent, delivered, failed, read)
│   ├── metadata (jsonb)
│   │   └── { "unipile_message_id": "...", "sent_via": "linkedin" }
│   ├── created_at (timestamp)
│   ├── sent_at (timestamp)
│   ├── read_at (timestamp)
│   └── updated_at (timestamp)
│
├── Indexes:
│   ├── conversation_id
│   ├── workspace_id
│   ├── campaign_id
│   ├── sender_id
│   └── created_at
│
└── RLS:
    └── SELECT/INSERT: Workspace members only
```

---

## Knowledge Base (RAG)

### `knowledge_base` - KB content with vector embeddings

```sql
Table: knowledge_base
├── Columns:
│   ├── id (uuid, primary key)
│   ├── workspace_id (uuid, foreign key → workspaces)
│   ├── title (text, required)
│   ├── content (text, required)
│   ├── embedding (vector(1536))
│   │   └── pgvector for semantic search (OpenRouter embeddings)
│   ├── source_type (enum)
│   │   ├── uploaded (manually uploaded document)
│   │   ├── crawled (from website)
│   │   ├── synced (from CRM/integrations)
│   │   ├── knowledge_base_sections (internal structure)
│   │   └── generated (AI-generated)
│   ├── source_url (text)
│   ├── category (text)
│   ├── tags (text[])
│   ├── created_at (timestamp)
│   ├── updated_at (timestamp)
│   ├── created_by (uuid, foreign key → users)
│   └── deleted_at (timestamp, soft delete)
│
├── Indexes:
│   ├── workspace_id
│   ├── embedding (vector index for pgvector)
│   ├── category
│   └── created_at
│
└── RLS:
    └── SELECT: Workspace members only
        INSERT/UPDATE: Workspace owner/admin only
```

**Example Row**:
```json
{
  "id": "112e8400-e29b-41d4-a716-446655440000",
  "workspace_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "LinkedIn Connection Request Best Practices",
  "content": "When sending connection requests to cold prospects, follow these best practices:\n1. Personalize the message...",
  "embedding": [0.123, -0.456, 0.789, ...],
  "source_type": "uploaded",
  "category": "sales-techniques",
  "tags": ["linkedin", "prospecting", "outreach"],
  "created_at": "2025-11-15T10:00:00Z"
}
```

### `knowledge_base_sections` - Section hierarchy

```sql
Table: knowledge_base_sections
├── Columns:
│   ├── id (uuid, primary key)
│   ├── workspace_id (uuid, foreign key → workspaces)
│   ├── parent_id (uuid, self-reference, nullable)
│   ├── title (text)
│   ├── description (text)
│   ├── order (int)
│   └── created_at (timestamp)
│
├── Indexes:
│   ├── workspace_id
│   ├── parent_id
│   └── order
│
└── RLS:
    └── SELECT: Workspace members only
```

**Example Hierarchy**:
```
Sales Techniques (parent: null)
├── Connection Requests
│   ├── Cold Outreach
│   └── Warm Introductions
├── Follow-up Strategy
│   └── Multi-touch Campaigns
└── Objection Handling
```

---

## Integration Tables

### `workspace_accounts` - Multi-account management

```sql
Table: workspace_accounts
├── Columns:
│   ├── id (uuid, primary key)
│   ├── workspace_id (uuid, foreign key → workspaces)
│   ├── account_type (enum: linkedin, email, webhook)
│   ├── account_name (text)
│   │   └── Display name (e.g., "John Doe - LinkedIn")
│   ├── unipile_account_id (text)
│   │   └── Unipile provider account ID (authoritative)
│   ├── email (text, nullable)
│   │   └── For email/Postmark accounts
│   ├── status (enum)
│   │   ├── connected (active and healthy)
│   │   ├── disconnected (not currently connected)
│   │   ├── error (connection error)
│   │   └── expired (credentials expired)
│   ├── rate_limit_remaining (int)
│   ├── rate_limit_reset_at (timestamp)
│   ├── rate_limit_daily (int, default: 100)
│   ├── rate_limit_weekly (int, default: 500)
│   ├── metadata (jsonb)
│   │   ├── { "provider": "linkedin", "account_state": "connected" }
│   ├── created_at (timestamp)
│   ├── updated_at (timestamp)
│   └── last_used_at (timestamp)
│
├── Indexes:
│   ├── workspace_id
│   ├── unipile_account_id
│   └── status
│
├── Constraints:
│   └── UNIQUE (workspace_id, unipile_account_id)
│
└── RLS:
    └── SELECT/UPDATE: Workspace owner/admin only
```

**Example Row**:
```json
{
  "id": "223e8400-e29b-41d4-a716-446655440000",
  "workspace_id": "550e8400-e29b-41d4-a716-446655440000",
  "account_type": "linkedin",
  "account_name": "John Doe - LinkedIn",
  "unipile_account_id": "ymtTx4xVQ6OVUFk83ctwtA",
  "status": "connected",
  "rate_limit_remaining": 95,
  "rate_limit_reset_at": "2025-11-23T00:00:00Z",
  "rate_limit_daily": 100,
  "rate_limit_weekly": 500,
  "metadata": {
    "provider": "linkedin",
    "account_state": "connected",
    "last_sync": "2025-11-22T15:30:00Z"
  },
  "created_at": "2025-11-15T10:00:00Z"
}
```

---

## Approval System Tables

### `approval_sessions` - DPA approval sessions

```sql
Table: approval_sessions
├── Columns:
│   ├── id (uuid, primary key)
│   ├── workspace_id (uuid, foreign key → workspaces)
│   ├── user_id (uuid, foreign key → users)
│   ├── campaign_name (text)
│   ├── campaign_tag (text)
│   ├── status (enum: active, completed, abandoned)
│   ├── total_prospects (int)
│   ├── pending_count (int)
│   ├── approved_count (int)
│   ├── rejected_count (int)
│   ├── source (enum)
│   │   ├── linkedin_search
│   │   ├── csv_upload
│   │   ├── manual_input
│   │   └── api_import
│   ├── icp_criteria (jsonb)
│   │   └── { "title": "VP Sales", "company_size": "100-500" }
│   ├── created_at (timestamp)
│   ├── completed_at (timestamp)
│   └── expires_at (timestamp)
│       └── Auto-delete after 30 days
│
├── Indexes:
│   ├── workspace_id
│   ├── user_id
│   ├── status
│   └── created_at
│
└── RLS:
    └── SELECT/UPDATE: Owner/admin or session creator
```

### `approval_decisions` - User decisions on prospects

```sql
Table: approval_decisions
├── Columns:
│   ├── id (uuid, primary key)
│   ├── session_id (uuid, foreign key → approval_sessions)
│   ├── workspace_id (uuid, foreign key → workspaces)
│   ├── prospect_data (jsonb)
│   │   └── Full prospect details
│   ├── decision (enum: approved, rejected, flagged)
│   ├── notes (text)
│   ├── decided_by (uuid, foreign key → users)
│   ├── decided_at (timestamp)
│   └── created_at (timestamp)
│
├── Indexes:
│   ├── session_id
│   ├── workspace_id
│   ├── decision
│   └── decided_at
│
└── RLS:
    └── SELECT: Workspace members only
```

---

## SAM AI Tables

### `sam_conversations` - SAM AI conversations

```sql
Table: sam_conversations
├── Columns:
│   ├── id (uuid, primary key)
│   ├── workspace_id (uuid, foreign key → workspaces)
│   ├── user_id (uuid, foreign key → users)
│   ├── topic (text)
│   ├── status (enum: active, archived, deleted)
│   ├── context (jsonb)
│   │   └── { "campaign_id": "...", "prospect_id": "..." }
│   ├── created_at (timestamp)
│   ├── updated_at (timestamp)
│   └── last_message_at (timestamp)
│
├── Indexes:
│   ├── workspace_id
│   ├── user_id
│   └── created_at
│
└── RLS:
    └── SELECT/UPDATE: Owner or workspace admin only
```

### `sam_messages` - SAM AI message history

```sql
Table: sam_messages
├── Columns:
│   ├── id (uuid, primary key)
│   ├── conversation_id (uuid, foreign key → sam_conversations)
│   ├── workspace_id (uuid, foreign key → workspaces)
│   ├── role (enum: user, assistant)
│   ├── content (text)
│   ├── tokens_used (int)
│   ├── model_used (text)
│   │   └── e.g., "claude-3.5-sonnet"
│   ├── context_used (jsonb)
│   │   ├── { "kb_entries": [...], "campaign_data": {...} }
│   ├── created_at (timestamp)
│   └── updated_at (timestamp)
│
├── Indexes:
│   ├── conversation_id
│   ├── workspace_id
│   └── created_at
│
└── RLS:
    └── SELECT: Conversation owner or admin
```

---

## RLS Policies

### Policy Pattern

All tables follow this multi-tenant isolation pattern:

```sql
-- Users can only access data in their workspace
CREATE POLICY workspace_isolation ON campaigns
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );
```

### RLS on Specific Tables

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `campaigns` | Workspace members | Workspace members | Owner/Admin | Owner/Admin |
| `campaign_prospects` | Workspace members | Workspace members | Workspace members | Owner/Admin |
| `messages` | Workspace members | Workspace members | Creator only | Owner/Admin |
| `knowledge_base` | Workspace members | Owner/Admin | Owner/Admin | Owner/Admin |
| `workspace_accounts` | Owner/Admin | Owner/Admin | Owner/Admin | Owner/Admin |
| `users` | Self only | Auth system | Self only | Never |
| `workspace_members` | Self access | Owner/Admin | Owner/Admin | Owner/Admin |

---

## Migrations

### Migration Files

**Location**: `/migrations/`

| File | Purpose |
|------|---------|
| `001_initial_schema.sql` | Create base tables |
| `002_add_vectors.sql` | Add pgvector for RAG |
| `003_backfill_workspace_ids.sql` | Add workspace isolation |
| `04_seed_kb_sections.sql` | Initialize KB sections |
| `05_import_legacy_data.sql` | Data migration |
| `06_smoke_tests.sql` | Verify migrations |

### Running Migrations

```bash
# Apply migrations via Supabase SQL editor
# Or via Supabase CLI
supabase migration list
supabase migration up
```

---

## Query Examples

### Find All Prospects in a Campaign

```sql
SELECT
  cp.id,
  cp.first_name,
  cp.last_name,
  cp.status,
  cp.contacted_at,
  cp.follow_up_due_at
FROM campaign_prospects cp
WHERE cp.campaign_id = 'campaign-uuid'
  AND cp.workspace_id = 'workspace-uuid'
ORDER BY cp.created_at DESC;
```

### Find Pending Prospects Ready for Follow-up

```sql
SELECT
  cp.id,
  cp.first_name,
  cp.last_name,
  cp.linkedin_url,
  c.message_templates -> ('follow_up_' || (cp.follow_up_sequence_index + 1)::text) as next_message
FROM campaign_prospects cp
JOIN campaigns c ON cp.campaign_id = c.id
WHERE cp.workspace_id = 'workspace-uuid'
  AND cp.status = 'connection_request_sent'
  AND cp.follow_up_due_at <= NOW()
  AND cp.follow_up_sequence_index < 5
ORDER BY cp.follow_up_due_at ASC;
```

### Search Knowledge Base with Semantic Search

```sql
SELECT
  id,
  title,
  content,
  (embedding <-> embedding_query) as distance
FROM knowledge_base
WHERE workspace_id = 'workspace-uuid'
ORDER BY embedding <-> embedding_query
LIMIT 5;
```

### Find Prospects by Status

```sql
SELECT
  status,
  COUNT(*) as count
FROM campaign_prospects
WHERE workspace_id = 'workspace-uuid'
  AND campaign_id = 'campaign-uuid'
GROUP BY status
ORDER BY count DESC;
```

### Get Campaign Metrics

```sql
SELECT
  c.campaign_name,
  COUNT(DISTINCT cp.id) as total_prospects,
  COUNT(CASE WHEN cp.status = 'connection_request_sent' THEN 1 END) as contacted,
  COUNT(CASE WHEN cp.status = 'connected' THEN 1 END) as connected,
  COUNT(CASE WHEN cp.status = 'replied' THEN 1 END) as replied,
  ROUND(
    COUNT(CASE WHEN cp.status = 'connected' THEN 1 END)::numeric /
    COUNT(DISTINCT cp.id) * 100, 2
  ) as success_rate_percent
FROM campaigns c
LEFT JOIN campaign_prospects cp ON c.id = cp.campaign_id
WHERE c.workspace_id = 'workspace-uuid'
GROUP BY c.id, c.campaign_name;
```

---

## Performance Tips

### Indexes to Add

For high-volume queries:
```sql
CREATE INDEX idx_campaign_prospects_workspace_status
ON campaign_prospects(workspace_id, status);

CREATE INDEX idx_messages_conversation_created
ON messages(conversation_id, created_at DESC);

CREATE INDEX idx_knowledge_base_vector
ON knowledge_base USING ivfflat(embedding);
```

### Query Optimization

1. **Always filter by `workspace_id` first** - Enables RLS and uses composite indexes
2. **Use pagination** - Don't fetch all rows, use LIMIT/OFFSET
3. **Vector search** - Use `<->` operator for pgvector similarity
4. **Batch operations** - Use INSERT/UPDATE with multiple rows when possible

---

**For API integration examples, see**: `API_ENDPOINTS_REFERENCE.md`
