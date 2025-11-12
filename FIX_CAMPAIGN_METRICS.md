# FIX CAMPAIGN METRICS - N8N CONNECTION

## Problem
- N8N updates `campaign_prospects` table
- Dashboard reads from `campaign_performance_summary` view
- View was querying `campaign_messages` (not populated by N8N)
- **Result:** Metrics show 0 despite N8N working

## Solution
✅ Updated view to read from `campaign_prospects` instead

## Steps to Apply

### 1. Go to Supabase Dashboard
https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog

### 2. Open SQL Editor
Click: SQL Editor (left sidebar)

### 3. Run This Migration
Copy/paste from: `supabase/migrations/20251112_fix_campaign_metrics_n8n.sql`

### 4. Test Immediately
Refresh BLL-CISO campaign page - metrics should now show:
- Messages sent: Count of prospects with status 'connection_requested'+
- Replies: Count of prospects with status 'replied_*'
- Reply rate: (replies / messages sent) * 100

## What Changed
**Before:**
- messages_sent = COUNT from campaign_messages table
- replies_received = COUNT from campaign_replies table

**After:**
- messages_sent = COUNT prospects WHERE status IN ('connection_requested', 'connected', 'replied_*', 'completed')
- replies_received = COUNT prospects WHERE status LIKE 'replied_%'

## N8N Status Mapping
| N8N Updates This | Shows in Metrics As |
|------------------|---------------------|
| connection_requested | Message sent |
| replied_fu1 | Reply received |
| replied_fu2 | Reply received |
| replied_fu3 | Reply received |
| replied_fu4 | Reply received |
| replied_gb | Reply received |
| completed | Message sent |
| not_connected | Not counted |

## Verification
After migration runs:
```sql
-- Check BLL-CISO campaign metrics
SELECT * FROM campaign_performance_summary
WHERE campaign_name LIKE '%BLL-CISO%';

-- Should show actual numbers from campaign_prospects
```
