# Complete Email System Migration Plan

## Current Status

✅ **Already Deployed**:
- `workspaces` (9 records)
- `workspace_members` (22 records)
- `campaigns` (1 record)
- `users` (15 records)
- `email_responses` (8 records) ← Email system base
- `message_outbox` (0 records) ← Just created!

❌ **Missing Tables** (Required for full HITL workflow):
- `workspace_prospects` ← Stores prospect data
- `campaign_replies` ← Stores replies and HITL workflow data

## Deployment Plan

### Phase 1: Deploy workspace_prospects ✅ Ready

**Migration File**: `supabase/migrations/20250923200000_create_workspace_prospects.sql`

**What it creates**:
- `workspace_prospects` table for storing prospect information
- Indexes for performance
- RLS policies for workspace isolation

**How to deploy**:
1. Open Supabase SQL Editor
2. Copy contents of: `supabase/migrations/20250923200000_create_workspace_prospects.sql`
3. Paste and click "Run"

### Phase 2: Deploy campaign_replies ✅ Ready

**Migration File**: `supabase/migrations/20250916073100_campaign_tracking.sql`

**What it creates**:
- `campaign_replies` table for tracking prospect replies
- Related tables: `campaign_messages`, `campaign_interactions`
- Indexes and RLS policies

**How to deploy**:
1. Open Supabase SQL Editor
2. Copy contents of: `supabase/migrations/20250916073100_campaign_tracking.sql`
3. Paste and click "Run"

⚠️ **Note**: This migration references `campaign_messages` table which might not exist. If it fails, we'll need to create a simplified version.

### Phase 3: Add HITL Workflow Columns to campaign_replies ✅ Ready

**Migration File**: `supabase/migrations/20251007000002_create_message_outbox_and_update_replies.sql`

**What it does**:
- Adds HITL workflow columns to existing `campaign_replies` table:
  - `status` (pending/approved/edited/refused)
  - `reviewed_by`, `reviewed_at`
  - `final_message` (approved/edited message)
  - `ai_suggested_response` (SAM's draft)
  - `draft_generated_at`, `priority`
  - `email_response_id` (links to email_responses)

**How to deploy**:
1. Open Supabase SQL Editor
2. Copy contents of: `supabase/migrations/20251007000002_create_message_outbox_and_update_replies.sql`
3. Paste and click "Run"

⚠️ **Note**: This migration will now work because message_outbox is already created, and it will add foreign keys to the newly created tables.

## Testing After Migration

Once all migrations are deployed, run:

```bash
node temp/check-tables.cjs
```

Expected output:
```
✅ workspaces - EXISTS (9 records)
✅ workspace_members - EXISTS (22 records)
✅ workspace_prospects - EXISTS (0 records) ← New!
✅ campaigns - EXISTS (1 records)
✅ campaign_replies - EXISTS (0 records) ← New!
✅ users - EXISTS (15 records)
✅ email_responses - EXISTS (8 records)
✅ message_outbox - EXISTS (0 records)
```

## Email Workflow Features After Full Migration

### ✅ Current (Limited) Features:
- Email receiving and storage (`email_responses`)
- Message queuing (`message_outbox`)
- Basic webhook processing

### ✅ After Full Migration:
- **Complete HITL Workflow**:
  - Prospect replies → SAM draft generation
  - HITL notification emails
  - APPROVE/EDIT/REFUSE detection
  - Message queuing for approved messages
  - Confirmation emails

- **Prospect Management**:
  - Store and track prospects
  - Link emails to prospects
  - Campaign reply tracking

- **Campaign Reply Tracking**:
  - All replies linked to campaigns
  - Status tracking (pending/approved/etc.)
  - AI draft vs final message comparison
  - HITL review timestamps

## Priority Order

**Recommended deployment order**:

1. ✅ **Done**: `message_outbox` (just deployed)
2. **Next**: `workspace_prospects` (20250923200000)
3. **Then**: `campaign_replies` (20250916073100)
4. **Finally**: Add HITL columns (20251007000002)

## Alternative: Simplified Approach

If the full `campaign_replies` migration fails due to missing dependencies, we can create a simplified version:

**Create minimal campaign_replies table**:
```sql
CREATE TABLE IF NOT EXISTS campaign_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Reply content
  reply_text TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  requires_review BOOLEAN DEFAULT true,

  -- HITL workflow
  status TEXT DEFAULT 'pending',
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  final_message TEXT,
  ai_suggested_response TEXT,
  draft_generated_at TIMESTAMPTZ,
  priority TEXT DEFAULT 'normal',
  email_response_id UUID REFERENCES email_responses(id),

  -- Metadata
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

This would give us the minimum needed for the HITL email workflow without all the campaign tracking dependencies.

---

**Created**: October 7, 2025
**Status**: message_outbox deployed, 2 more tables needed
**Next Step**: Deploy workspace_prospects migration
