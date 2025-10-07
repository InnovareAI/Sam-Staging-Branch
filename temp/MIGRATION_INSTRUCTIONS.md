# Message Outbox Table Migration - Manual Deployment

## Issue

The automated migration failed because `workspace_prospects` and `campaign_replies` tables don't exist in the database yet.

## Solution

Use the simplified migration that creates only the `message_outbox` table without foreign key constraints to the missing tables.

## Deployment Steps

### 1. Open Supabase SQL Editor

1. Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog
2. Click **"SQL Editor"** in the left sidebar
3. Click **"New query"**

### 2. Copy and Paste This SQL

Copy the **entire contents** of this file:

```
supabase/migrations/20251007000003_create_message_outbox_simplified.sql
```

**OR** copy this SQL directly:

```sql
-- Simplified migration: Create message_outbox table only
-- This migration works even if workspace_prospects and campaign_replies don't exist yet
-- Foreign key constraints will be added later when those tables are created

CREATE TABLE IF NOT EXISTS message_outbox (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,

  -- Store prospect_id and reply_id as UUID without foreign keys for now
  prospect_id UUID, -- Will link to workspace_prospects when it exists
  reply_id UUID,    -- Will link to campaign_replies when it exists

  -- Channel and content
  channel TEXT NOT NULL, -- 'email', 'linkedin', 'both'
  message_content TEXT NOT NULL,
  subject TEXT, -- For email messages

  -- Sending status
  status TEXT DEFAULT 'queued', -- 'queued', 'sending', 'sent', 'failed', 'cancelled'
  scheduled_send_time TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,

  -- External IDs
  external_message_id TEXT, -- Unipile or email provider message ID
  n8n_execution_id TEXT, -- N8N workflow execution ID

  -- Metadata
  metadata JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for outbox table
CREATE INDEX IF NOT EXISTS idx_message_outbox_workspace ON message_outbox(workspace_id);
CREATE INDEX IF NOT EXISTS idx_message_outbox_campaign ON message_outbox(campaign_id);
CREATE INDEX IF NOT EXISTS idx_message_outbox_prospect ON message_outbox(prospect_id);
CREATE INDEX IF NOT EXISTS idx_message_outbox_reply ON message_outbox(reply_id);
CREATE INDEX IF NOT EXISTS idx_message_outbox_status ON message_outbox(status) WHERE status IN ('queued', 'sending');
CREATE INDEX IF NOT EXISTS idx_message_outbox_scheduled ON message_outbox(scheduled_send_time) WHERE status = 'queued';

-- RLS policies for message_outbox
ALTER TABLE message_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view outbox for their workspaces" ON message_outbox;
CREATE POLICY "Users can view outbox for their workspaces"
  ON message_outbox
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert to outbox" ON message_outbox;
CREATE POLICY "Users can insert to outbox"
  ON message_outbox
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update outbox in their workspaces" ON message_outbox;
CREATE POLICY "Users can update outbox in their workspaces"
  ON message_outbox
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Auto-update updated_at timestamp for message_outbox
DROP FUNCTION IF EXISTS update_message_outbox_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION update_message_outbox_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS message_outbox_updated_at ON message_outbox;

CREATE TRIGGER message_outbox_updated_at
  BEFORE UPDATE ON message_outbox
  FOR EACH ROW
  EXECUTE FUNCTION update_message_outbox_updated_at();

-- Comments
COMMENT ON TABLE message_outbox IS 'Queue for outbound messages (email, LinkedIn) awaiting delivery';
COMMENT ON COLUMN message_outbox.status IS 'Message delivery status: queued, sending, sent, failed, cancelled';
COMMENT ON COLUMN message_outbox.channel IS 'Delivery channel: email, linkedin, both';
COMMENT ON COLUMN message_outbox.prospect_id IS 'Links to workspace_prospects (no FK constraint - table may not exist)';
COMMENT ON COLUMN message_outbox.reply_id IS 'Links to campaign_replies (no FK constraint - table may not exist)';
```

### 3. Click "Run" to Execute

Click the **"Run"** button in the SQL Editor.

### 4. Verify Success

After running, you should see:

```
Success. No rows returned.
```

### 5. Verify Table Created

Run this command to verify:

```bash
node temp/check-tables.cjs
```

Expected output:
```
✅ message_outbox - EXISTS (0 records)
```

## What This Does

Creates the `message_outbox` table for queuing outbound messages:

- ✅ **Workspace isolation** via RLS policies
- ✅ **Channel support** for email and LinkedIn
- ✅ **Status tracking** (queued → sending → sent/failed)
- ✅ **Metadata** for external IDs (Unipile, N8N)
- ✅ **Automatic timestamps** (created_at, updated_at)

## Important Notes

⚠️ **Missing Tables**: This migration works without `workspace_prospects` or `campaign_replies` tables.

- `prospect_id` and `reply_id` are stored as UUIDs without foreign key constraints
- Foreign keys can be added later when those tables are created
- The email system will still work for storing emails in `email_responses`

🔄 **Future Migration**: When `workspace_prospects` and `campaign_replies` tables are created, run the full migration:
```
supabase/migrations/20251007000002_create_message_outbox_and_update_replies.sql
```

This will add:
- Foreign key constraints
- campaign_replies HITL workflow columns

## Next Steps

Once migration succeeds:

1. ✅ Verify with: `node temp/check-tables.cjs`
2. Test email workflow (limited - without campaign reply tracking)
3. Deploy missing table migrations:
   - `supabase/migrations/20250923200000_create_workspace_prospects.sql`
   - `supabase/migrations/20251002000000_create_prospect_approval_system.sql` (creates campaign_replies)

---

**Created**: October 7, 2025
**Migration File**: `20251007000003_create_message_outbox_simplified.sql`
**Status**: Ready for manual deployment
