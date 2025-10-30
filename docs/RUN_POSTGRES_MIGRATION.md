# Running PostgreSQL Migration for Flow Settings

**Date:** October 30, 2025
**Migration:** Add flow_settings and metadata to campaigns table

---

## Quick Start: Run the Migration

### Option 1: Via Supabase SQL Editor (Recommended)

1. **Go to Supabase Dashboard:**
   ```
   https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/editor
   ```

2. **Open SQL Editor** (left sidebar → SQL Editor)

3. **Paste the migration SQL:**
   ```bash
   # Copy the file contents
   cat sql/migrations/add-campaign-flow-settings.sql
   ```

4. **Click "Run"** (or Cmd+Enter)

5. **Verify success:**
   - Check for green "Success" message
   - Go to Table Editor → campaigns
   - Verify `flow_settings` and `metadata` columns exist

---

### Option 2: Via Node.js Script

```bash
# Make script executable
chmod +x scripts/js/migrate-add-flow-settings.mjs

# Run migration
node scripts/js/migrate-add-flow-settings.mjs
```

**Expected Output:**
```
🔧 PostgreSQL Migration: Adding flow_settings to campaigns table

📝 Add flow_settings column...
   ✅ Success
📝 Add metadata column...
   ✅ Success
📝 Create GIN index for A/B test queries...
   ✅ Success
📝 Add column comments...
   ✅ Success

🔍 Verifying migration...
✅ Verification successful!
   Columns exist: { flow_settings: true, metadata: true }

🎉 Migration complete!
```

---

### Option 3: Manual PostgreSQL Commands

If you have direct PostgreSQL access:

```bash
# Connect to database
psql postgresql://postgres:[password]@db.latxadqrvrrrcvkktrog.supabase.co:5432/postgres

# Run migration
\i sql/migrations/add-campaign-flow-settings.sql

# Verify
\d campaigns
```

---

## What the Migration Does

### 1. Creates Campaign Type Enum

```sql
CREATE TYPE campaign_type AS ENUM (
  'linkedin_connection',  -- Connection requests (2nd/3rd degree)
  'linkedin_dm',          -- Direct messages (1st degree connections)
  'email'                 -- Email campaigns
);
```

### 2. Adds flow_settings Column (JSONB)

**Structure:**
```json
{
  "campaign_type": "linkedin_connection",
  "connection_wait_hours": 36,        // Wait after CR (12-96)
  "followup_wait_days": 5,            // Wait between FUs (1-30)
  "message_wait_days": 5,             // Wait for DM campaigns (1-30)
  "messages": {
    // LinkedIn Connection Campaign
    "connection_request": "Hi {first_name}...",
    "follow_up_1": "Following up...",
    "follow_up_2": "...",
    "follow_up_3": "...",
    "follow_up_4": "...",
    "follow_up_5": "...",
    "follow_up_6": "...",
    "goodbye": "...",

    // LinkedIn DM / Email Campaigns
    "message_1": "First touchpoint...",
    "message_2": "Second touchpoint...",
    "message_3": "...",
    "message_4": "...",
    "message_5": "...",
    "message_6": "...",
    "message_7": "...",
    "message_8": "...",
    "message_9": "...",
    "message_10": "..."
  }
}
```

### 3. Adds metadata Column (JSONB)

**For A/B Testing:**
```json
{
  "ab_test_group": "CTO Outreach Test",
  "variant": "A",
  "variant_label": "Aggressive"
}
```

### 4. Creates GIN Index

```sql
CREATE INDEX idx_campaigns_metadata_ab_test
ON campaigns USING GIN ((metadata->'ab_test_group'));
```

Enables fast queries like:
```sql
-- Find all campaigns in an A/B test
SELECT * FROM campaigns
WHERE metadata->>'ab_test_group' = 'CTO Outreach Test';
```

---

## Verification Steps

### 1. Check Column Existence

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'campaigns'
  AND column_name IN ('flow_settings', 'metadata');
```

**Expected:**
```
 column_name   | data_type
---------------+-----------
 flow_settings | jsonb
 metadata      | jsonb
```

### 2. Check Index

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'campaigns'
  AND indexname = 'idx_campaigns_metadata_ab_test';
```

**Expected:**
```
         indexname          |                    indexdef
----------------------------+------------------------------------------------
idx_campaigns_metadata_ab_test | CREATE INDEX ... USING gin ((metadata -> 'ab_test_group'::text))
```

### 3. Test Insert

```sql
-- Insert test campaign
INSERT INTO campaigns (
  workspace_id,
  name,
  channel,
  status,
  flow_settings
) VALUES (
  'test-workspace-id',
  'Test Campaign',
  'linkedin',
  'draft',
  '{
    "campaign_type": "linkedin_dm",
    "message_wait_days": 5,
    "messages": {
      "message_1": "Hi {first_name}, test message"
    }
  }'::jsonb
) RETURNING id, flow_settings;
```

**Expected:** Returns campaign ID and flow_settings

### 4. Test Query

```sql
-- Query campaigns with flow_settings
SELECT
  id,
  name,
  flow_settings->>'campaign_type' as campaign_type,
  flow_settings->'messages'->>'message_1' as first_message
FROM campaigns
WHERE flow_settings IS NOT NULL
LIMIT 5;
```

---

## Rollback (If Needed)

```sql
-- Remove columns (WARNING: Deletes data!)
ALTER TABLE campaigns DROP COLUMN IF EXISTS flow_settings;
ALTER TABLE campaigns DROP COLUMN IF EXISTS metadata;

-- Remove index
DROP INDEX IF EXISTS idx_campaigns_metadata_ab_test;

-- Remove enum
DROP TYPE IF EXISTS campaign_type;
```

---

## Troubleshooting

### Error: "exec_sql function does not exist"

**Solution:** Use Supabase SQL Editor instead of the Node script.

### Error: "permission denied"

**Solution:** Ensure you're using the service role key, not anon key.

### Error: "column already exists"

**Solution:** Migration uses `IF NOT EXISTS`, so this is safe. The column already exists.

### Migration appears to hang

**Solution:**
1. Check if there are locks on the campaigns table
2. Try running in Supabase SQL Editor during low-traffic period
3. Contact Supabase support if persistent

---

## After Migration

### 1. Update Existing Campaigns (Optional)

Migrate legacy campaigns to use flow_settings:

```sql
UPDATE campaigns
SET flow_settings = jsonb_build_object(
  'campaign_type', 'linkedin_connection',
  'connection_wait_hours', 36,
  'followup_wait_days', 5,
  'messages', COALESCE(message_templates, '{}'::jsonb)
)
WHERE flow_settings IS NULL
  AND channel = 'linkedin';
```

### 2. Test Campaign Creation via SAM

```
User → SAM: "Create a LinkedIn DM campaign for existing connections"

SAM: "I'll create a DM campaign for your 1st degree connections.

      Campaign: Connection Follow-Up Sequence

      Timing: 5 days between messages

      Messages:
      Day 0:  Thanks for connecting
      Day 5:  Share valuable insight
      Day 10: Ask engagement question

      Ready to create?"
```

### 3. Deploy Code Changes

```bash
# Build production
npm run build

# Deploy to Netlify
netlify deploy --prod
```

---

## Campaign Type Decision Tree

```
Is prospect already a 1st degree connection?
├─ YES → Use 'linkedin_dm' campaign
│         - No connection request
│         - Send DMs directly
│         - Use message_1, message_2, etc.
│
└─ NO → Use 'linkedin_connection' campaign
          - Send connection request first
          - Wait for acceptance
          - Use connection_request, follow_up_1, etc.
```

---

## Summary

**What Changed:**
- ✅ campaigns.flow_settings (JSONB) - Campaign timing & messages
- ✅ campaigns.metadata (JSONB) - A/B testing support
- ✅ campaign_type enum - linkedin_connection | linkedin_dm | email
- ✅ GIN index - Fast A/B test queries

**Impact:**
- ✅ Flexible campaign timing (user configurable)
- ✅ Support for 1st degree LinkedIn connections
- ✅ Simple A/B testing (multiple campaigns)
- ✅ One N8N workflow for all campaign types

**Next:**
1. Run migration (Supabase SQL Editor recommended)
2. Verify columns exist
3. Test SAM campaign creation
4. Deploy code to production

---

**Status:** Ready to Run
**Estimated Time:** 2-5 minutes
**Risk Level:** Low (uses IF NOT EXISTS, backward compatible)
