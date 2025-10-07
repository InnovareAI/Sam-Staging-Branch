# Email System Migration Deployment Instructions

## Status Check

✅ **email_responses table** - Already deployed (8 records)
⚠️  **message_outbox table** - Needs deployment
⚠️  **campaign_replies HITL columns** - Needs deployment

## Deployment Steps

### 1. Open Supabase SQL Editor

1. Go to https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog
2. Click "SQL Editor" in the left sidebar
3. Click "New query"

### 2. Run Migration SQL

Copy and paste the entire contents of this file:

```
supabase/migrations/20251007000002_create_message_outbox_and_update_replies.sql
```

### 3. Click "Run" to execute the migration

### 4. Verify Deployment

Run this command to verify:

```bash
node temp/verify-email-schema.cjs
```

Expected output:
```
✅ email_responses table exists
✅ message_outbox table exists
✅ campaign_replies HITL columns exist
✅ ALL TABLES AND COLUMNS EXIST
✅ Email system schema is ready!
```

## What This Migration Does

### Creates `message_outbox` table
- Stores queued messages awaiting delivery
- Supports email and LinkedIn channels
- Tracks sending status (queued → sending → sent/failed)
- Links to campaign_replies for reply workflows

### Updates `campaign_replies` table
Adds HITL workflow columns:
- `status` - pending/approved/edited/refused
- `reviewed_by` - User who reviewed
- `reviewed_at` - Timestamp of review
- `final_message` - Final approved/edited message
- `ai_suggested_response` - SAM's draft
- `draft_generated_at` - When draft was created
- `priority` - normal/urgent
- `email_response_id` - Links to email_responses

### Creates Indexes
- Performance indexes for workspace, campaign, prospect lookups
- Priority indexes for urgent replies
- Status indexes for queued messages

### Sets up RLS Policies
- Users can only view/edit messages in their workspaces
- Enforces multi-tenant isolation

## After Deployment

Once migration is complete, you can test the email-only workflow:

1. Send a test prospect reply to SAM
2. SAM generates draft and emails HITL
3. HITL replies with APPROVE/EDIT/REFUSE
4. SAM processes action and queues message

---

**Created**: October 7, 2025
**Migration File**: 20251007000002_create_message_outbox_and_update_replies.sql
