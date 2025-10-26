# Sam → LinkedIn Pipeline - Quick Reference Guide

**Version:** 1.0
**Date:** October 26, 2025

> 📖 For full documentation, see [SAM_TO_LINKEDIN_DATA_PIPELINE.md](./SAM_TO_LINKEDIN_DATA_PIPELINE.md)

---

## 🚀 Quick Start: Send LinkedIn Messages

### Prerequisites Checklist

```bash
✅ Prospects extracted by SAM AI
✅ Prospects approved by user
✅ Campaign created
✅ LinkedIn account connected to workspace
✅ Unipile integration active
```

### Execute Campaign (3 Steps)

```bash
# 1. Get campaign ID
curl -X GET \
  "https://app.meet-sam.com/api/campaigns?workspace_id=${WORKSPACE_ID}" \
  -H "Cookie: ${AUTH_COOKIE}"

# 2. Test with dry run
curl -X POST \
  "https://app.meet-sam.com/api/campaigns/linkedin/execute-live" \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "YOUR_CAMPAIGN_ID",
    "maxProspects": 1,
    "dryRun": true
  }'

# 3. Execute live
curl -X POST \
  "https://app.meet-sam.com/api/campaigns/linkedin/execute-live" \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "YOUR_CAMPAIGN_ID",
    "maxProspects": 1,
    "dryRun": false
  }'
```

---

## 📊 Data Flow (5 Stages)

```
Stage 1: Data Extraction
  └─> prospect_approval_data (contact.linkedin_url)

Stage 2: Approval
  └─> Flattens to top-level linkedin_url

Stage 3: Campaign Creation
  └─> campaign_prospects (linkedin_url + status)

Stage 4: LinkedIn ID Sync (OPTIONAL)
  └─> campaign_prospects.linkedin_user_id

Stage 5: Message Execution
  └─> Profile lookup → Send invitation → Update status
```

---

## 🔑 Critical Data Fields

### prospect_approval_data (Stage 1)

```json
{
  "name": "John Doe",
  "contact": {
    "linkedin_url": "https://linkedin.com/in/john-doe",  // ⚠️ REQUIRED
    "email": "john@company.com"
  },
  "company": {
    "name": "Acme Corp"
  }
}
```

### campaign_prospects (Stage 3)

```sql
linkedin_url TEXT NOT NULL    -- ⚠️ REQUIRED for execution
linkedin_user_id TEXT         -- Optional (synced later)
status TEXT                   -- 'new' → 'approved' → 'connection_requested'
```

---

## 🛠️ Common Commands

### Check Prospect Data

```sql
-- Verify LinkedIn URLs present
SELECT
  prospect_id,
  name,
  contact->>'linkedin_url' as linkedin_url,
  approval_status
FROM prospect_approval_data
WHERE approval_status = 'approved'
  AND session_id = 'YOUR_SESSION_ID';
```

### Check Campaign Prospects

```sql
-- Check campaign readiness
SELECT
  first_name,
  last_name,
  linkedin_url,
  status
FROM campaign_prospects
WHERE campaign_id = 'YOUR_CAMPAIGN_ID'
  AND linkedin_url IS NOT NULL;
```

### Check Execution Status

```sql
-- See campaign progress
SELECT
  status,
  COUNT(*) as count
FROM campaign_prospects
WHERE campaign_id = 'YOUR_CAMPAIGN_ID'
GROUP BY status;
```

---

## ❌ Common Errors & Fixes

### "No prospects ready for messaging"

**Cause:** Missing `linkedin_url` in campaign_prospects

```sql
-- Check for NULL linkedin_urls
SELECT COUNT(*)
FROM campaign_prospects
WHERE campaign_id = 'YOUR_CAMPAIGN_ID'
  AND linkedin_url IS NULL;
```

**Fix:** Ensure SAM extraction includes `contact.linkedin_url`

---

### "LinkedIn account missing unipile_account_id"

**Cause:** LinkedIn not properly connected

```sql
-- Check workspace accounts
SELECT
  account_name,
  unipile_account_id,
  connection_status
FROM workspace_accounts
WHERE workspace_id = 'YOUR_WORKSPACE_ID'
  AND account_type = 'linkedin';
```

**Fix:**
1. Go to Workspace Settings → Integrations
2. Disconnect LinkedIn
3. Reconnect using OAuth
4. Verify `unipile_account_id` populated

---

### "LinkedIn account not active"

**Cause:** Unipile session expired

**Check:**
```bash
curl -X GET \
  "https://${UNIPILE_DSN}/api/v1/accounts/${UNIPILE_ACCOUNT_ID}" \
  -H "X-API-KEY: ${UNIPILE_API_KEY}"
```

**Fix:** Reconnect LinkedIn account

---

### "Could not retrieve LinkedIn profile"

**Cause:** Invalid LinkedIn URL format

**Valid formats:**
- ✅ `https://linkedin.com/in/john-doe`
- ✅ `https://www.linkedin.com/in/john-doe/`
- ❌ `linkedin.com/company/acme` (company, not person)

**Fix:** Validate URL format during data extraction

---

## 📈 Performance Limits

| Resource | Limit | Notes |
|----------|-------|-------|
| LinkedIn Connection Requests | ~100/week per account | Official LinkedIn limit |
| Messages per batch | 1 prospect | Avoids timeout |
| Delay between messages | 2-5 seconds | Random for naturalness |
| Daily throughput | ~14 per account | Based on LinkedIn limits |
| LLM cost per message | ~$0.003 | GPT-3.5-turbo |

---

## 🧪 Testing Checklist

### Pre-Execution

```bash
# 1. Check prospects have LinkedIn URLs
✓ Run SQL query above

# 2. Check LinkedIn account connected
✓ Verify workspace_accounts table

# 3. Test with dry run
✓ Set dryRun: true in API call
```

### Post-Execution

```bash
# 1. Verify status updated
SELECT status FROM campaign_prospects WHERE id = 'PROSPECT_ID';
# Expected: 'connection_requested'

# 2. Check message ID saved
SELECT personalization_data->>'unipile_message_id'
FROM campaign_prospects
WHERE id = 'PROSPECT_ID';
# Expected: 'msg_abc123...'

# 3. Verify on LinkedIn
# Go to: LinkedIn → My Network → Manage → Sent
# Should see connection request
```

---

## 🔧 Key API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/prospect-approval/approved` | GET | Get approved prospects |
| `/api/campaigns/add-approved-prospects` | POST | Add prospects to campaign |
| `/api/campaigns/sync-linkedin-ids` | POST | Sync LinkedIn IDs (optional) |
| `/api/campaigns/linkedin/execute-live` | POST | Execute campaign |

---

## 📝 File Locations

### API Routes

```
app/api/
├── prospect-approval/
│   └── approved/route.ts              # Stage 2: Approval
├── campaigns/
│   ├── add-approved-prospects/route.ts # Stage 3: Campaign Creation
│   ├── sync-linkedin-ids/route.ts     # Stage 4: ID Sync (optional)
│   └── linkedin/
│       └── execute-live/route.ts      # Stage 5: Execution
```

### Database Tables

```
prospect_approval_data        # Stage 1: SAM extraction
campaign_prospects            # Stage 3: Campaign prospects
workspace_accounts            # LinkedIn account config
```

---

## 🎯 Critical Code Locations

### LinkedIn URL Extraction (Commit 66b8ce1)

**File:** `app/api/prospect-approval/approved/route.ts`
**Line:** 114

```typescript
const linkedinUrl = prospect.contact?.linkedin_url || prospect.linkedin_url || null;
```

### LinkedIn URL Flattening

**File:** `app/api/campaigns/add-approved-prospects/route.ts`
**Line:** 94

```typescript
linkedin_url: prospect.contact?.linkedin_url || null
```

### Message Execution

**File:** `app/api/campaigns/linkedin/execute-live/route.ts`
**Lines:** 298-463 (Two-step process: Profile lookup → Send invitation)

---

## 🚨 Emergency Troubleshooting

### Reset Stuck Prospects

```sql
-- Reset prospects to 'approved' status
UPDATE campaign_prospects
SET status = 'approved',
    contacted_at = NULL,
    personalization_data = NULL
WHERE campaign_id = 'YOUR_CAMPAIGN_ID'
  AND status IN ('failed', 'error');
```

### Check System Health

```bash
# 1. Check Supabase connection
curl https://YOUR_PROJECT.supabase.co/rest/v1/campaigns \
  -H "apikey: YOUR_ANON_KEY"

# 2. Check Unipile connection
curl https://${UNIPILE_DSN}/api/v1/accounts \
  -H "X-API-KEY: ${UNIPILE_API_KEY}"

# 3. Check OpenRouter (LLM)
curl https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer ${OPENROUTER_API_KEY}"
```

### View Recent Logs

**Netlify Functions:**
- Go to: Netlify Dashboard → Functions → Logs
- Filter: `execute-live`

**Supabase:**
- Go to: Supabase Dashboard → Logs
- Filter: `campaign_prospects`

---

## 📚 Further Reading

- [Complete Technical Documentation](./SAM_TO_LINKEDIN_DATA_PIPELINE.md)
- [Unipile API Documentation](https://docs.unipile.com)
- [LinkedIn Rate Limits](https://www.linkedin.com/help/linkedin/answer/a548452)

---

**Last Updated:** October 26, 2025
**Status:** ✅ Production Ready
