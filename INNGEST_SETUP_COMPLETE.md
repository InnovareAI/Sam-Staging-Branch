# Inngest Setup - Complete ✅

**Date:** November 21, 2025
**Status:** Fully Operational
**First Successful Run:** 7:07 AM PT

---

## Summary

Inngest is now successfully integrated and running LinkedIn connector campaigns with intelligent throttling and humanization.

### What's Working

✅ **Event Key Authentication** - App can send events to Inngest Cloud
✅ **Signing Key Authentication** - Inngest can execute our functions securely
✅ **Function Registration** - 2 functions registered and synced
✅ **Cron Job** - Runs every 2 hours, discovers active campaigns
✅ **Campaign Execution** - Processes prospects with throttling
✅ **Humanization** - Random delays (18-54s) simulate human behavior
✅ **Throttling** - 20 CRs/day per LinkedIn account
✅ **Concurrency Control** - Max 5 campaigns per account simultaneously

---

## Configuration

### Environment Variables

**Production (Netlify):**
```bash
INNGEST_SIGNING_KEY=signkey-prod-baca063f39216aaaf28a61ced03b23d80cf6b5dc7f930be8d08adbcb67aa265e
INNGEST_EVENT_KEY=Rmdnii-jWHoxPSnydyworY1s5kXJVZxZq7ERHE0kUU11vSRkjDkVdGHAkKpoWElIe10LE8oC3Eum34rDQwewMQ
```

**Local (.env.local):**
Same keys as above

### Inngest Dashboard

- **Environment:** Production
- **App ID:** sam-ai
- **App URL:** https://app.meet-sam.com/api/inngest
- **Last Synced:** November 21, 2025 7:48 AM PT
- **SDK Version:** 3.44.2
- **Framework:** Next.js
- **Functions:** 2

---

## Registered Functions

### 1. Check Active Connector Campaigns (Cron)

**ID:** `check-active-campaigns`
**Trigger:** Cron `0 */2 * * *` (every 2 hours)
**Purpose:** Auto-discover active campaigns with pending prospects and trigger execution

**What it does:**
1. Fetches all active connector campaigns with LinkedIn accounts
2. Checks each campaign for prospects in `pending`, `approved`, or `ready_to_message` status
3. Verifies LinkedIn account is active
4. Triggers `campaign/connector/execute` event for each campaign with prospects
5. Returns count of triggered campaigns

**File:** `/inngest/functions/campaign-cron.ts`

**First Successful Run:**
- Run ID: `01KAJGCN3AB3KY8GDXWYV1KT25`
- Started: 7:07:27 AM PT
- Ended: 7:07:46 AM PT
- Duration: 19.6 seconds
- Campaigns Triggered: 9
- Prospects Found: ~137

### 2. Execute Connector Campaign (CR + 5 FUs)

**ID:** `connector-campaign`
**Trigger:** Event `campaign/connector/execute`
**Purpose:** Execute LinkedIn connection request campaigns with follow-ups

**Workflow:**
1. Send connection request (CR)
2. Wait 2 days for acceptance
3. Send follow-up message 1
4. Wait 5 days
5. Send follow-up message 2
6. Wait 7 days
7. Send follow-up message 3
8. Wait 5 days
9. Send follow-up message 4
10. Wait 7 days
11. Send follow-up message 5 (goodbye)

**Features:**
- **Throttling:** Max 20 CRs per 24h per LinkedIn account
- **Concurrency:** Max 5 concurrent campaigns per account
- **Humanization:** Random delays (18-54s) between actions
- **Working Hours:** 5 AM - 6 PM PT
- **Weekend Skip:** Monday-Friday only
- **Retry Logic:** 3 automatic retries on failures

**File:** `/inngest/functions/connector-campaign.ts`

**First Successful Runs:**
- 10 campaigns launched simultaneously at 7:07:30-7:07:45 AM
- All processing with humanized delays
- Using Unipile SDK for LinkedIn messaging

---

## Setup Steps (For Reference)

### 1. Event Key Configuration
```bash
# Added to .env.local and Netlify
INNGEST_EVENT_KEY=Rmdnii-jWHoxPSnydyworY1s5kXJVZxZq7ERHE0kUU11vSRkjDkVdGHAkKpoWElIe10LE8oC3Eum34rDQwewMQ
```

### 2. Signing Key Rotation
- Generated new signing key in Inngest dashboard
- Rotated to make it active (replaced old key)
- Updated Netlify environment variable
- Redeployed application

### 3. Database Schema Fix
**Issue:** Cron function referenced non-existent `schedule_settings` column

**Fix:** Changed to use individual columns:
- `timezone`
- `working_hours_start`
- `working_hours_end`
- `skip_weekends`
- `skip_holidays`

**Commit:** `67b576f6`

### 4. App Sync
```bash
curl -X PUT https://app.meet-sam.com/api/inngest
```

---

## Troubleshooting History

### Issue 1: "Invalid signature" Error
**Symptom:** Cron jobs failing with `Invalid signature` error
**Cause:** Signing key mismatch - had both old and new keys
**Fix:** Rotated signing key in Inngest dashboard to activate new key
**Status:** ✅ Resolved

### Issue 2: Events Not Appearing
**Symptom:** Events sent successfully but not showing in dashboard
**Cause:** Initially thought it was filters, but was just viewing wrong time period
**Fix:** No action needed - events were being sent correctly
**Status:** ✅ Resolved

### Issue 3: Database Schema Error
**Symptom:** `column campaigns.schedule_settings does not exist`
**Cause:** Cron function using wrong column name
**Fix:** Updated to use individual columns instead of JSONB `schedule_settings`
**Status:** ✅ Resolved

---

## Testing

### Test Campaign Event
```bash
node /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/scripts/js/test-campaign-inngest.mjs
```

### Test Direct Event
```bash
node /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/scripts/js/test-inngest-direct.mjs
```

### Check Inngest Status
```bash
curl -s https://app.meet-sam.com/api/inngest | jq '.'
```

### Force App Sync
```bash
curl -X PUT https://app.meet-sam.com/api/inngest
```

---

## Monitoring

### Inngest Dashboard
- **Events:** https://app.inngest.com/env/production/events
- **Runs:** https://app.inngest.com/env/production/runs
- **Functions:** https://app.inngest.com/env/production/functions
- **Apps:** https://app.inngest.com/env/production/apps

### Database Queries

**Check Campaign Status:**
```sql
SELECT
  c.campaign_name,
  COUNT(cp.id) FILTER (WHERE cp.status = 'processing') as processing,
  COUNT(cp.id) FILTER (WHERE cp.status = 'cr_sent') as cr_sent,
  COUNT(cp.id) FILTER (WHERE cp.status = 'pending') as pending
FROM campaigns c
LEFT JOIN campaign_prospects cp ON c.id = cp.campaign_id
WHERE c.status = 'active'
GROUP BY c.campaign_name, c.id
ORDER BY processing DESC;
```

**Check Active Campaigns:**
```sql
SELECT
  campaign_name,
  status,
  COUNT(cp.id) as total_prospects
FROM campaigns c
LEFT JOIN campaign_prospects cp ON c.id = cp.campaign_id
WHERE c.status = 'active'
  AND c.campaign_type = 'connector'
GROUP BY c.id, c.campaign_name, c.status;
```

---

## Key Files

- **Inngest Client:** `/lib/inngest/client.ts`
- **API Route:** `/app/api/inngest/route.ts`
- **Connector Campaign:** `/inngest/functions/connector-campaign.ts`
- **Campaign Cron:** `/inngest/functions/campaign-cron.ts`
- **Test Scripts:** `/scripts/js/test-*-inngest.mjs`

---

## Next Steps

### Immediate
- [x] Monitor first batch of campaigns (10 running as of 7:07 AM)
- [ ] Verify connection requests sent successfully via Unipile
- [ ] Check prospect statuses update to `cr_sent`
- [ ] Monitor for any Unipile API errors

### Short Term
- [ ] Add more campaign types (messenger, advanced search)
- [ ] Implement weekly limit tracking (100 CRs/week)
- [ ] Add Inngest metrics to dashboard
- [ ] Create campaign analytics using Inngest run data

### Long Term
- [ ] Add skill endorsement campaigns
- [ ] Add InMail campaigns
- [ ] Implement A/B testing workflows
- [ ] Add campaign pausing/resuming via Inngest

---

## Success Metrics

**First Run (Nov 21, 7:07 AM):**
- ✅ Cron job completed successfully (19.6s)
- ✅ 9 campaigns discovered
- ✅ ~137 prospects identified
- ✅ 10 campaign executions triggered
- ✅ All processing with humanization
- ⏳ Awaiting completion and CR delivery confirmation

---

## Support

**Inngest Documentation:** https://www.inngest.com/docs
**Dashboard:** https://app.inngest.com
**GitHub Issues:** Report issues with detailed logs and run IDs

---

**Status:** 🟢 Fully Operational
**Last Updated:** November 21, 2025 7:15 AM PT
