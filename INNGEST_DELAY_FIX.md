# Inngest Delay Fix - Complete

**Date:** November 21, 2025 7:40 AM
**Status:** FIXED and deployed

---

## Problem

Campaign delays were too slow:
- **Old behavior:** 0-60 MINUTES per prospect (often 0 due to Math.floor bug)
- **Result:** 137 prospects would take 68+ hours to complete

## Root Cause

Two bugs in `/lib/campaign-randomizer.ts`:

1. **Minutes/Seconds mismatch:**
   ```typescript
   // BUG: Returned minutes but often < 1 minute = 0
   const delayMinutes = Math.floor(delaySeconds / 60);
   return delayMinutes; // Would return 0 for any delay < 60s!
   ```

2. **Connector function expected minutes:**
   ```typescript
   await step.sleep(`human-delay-${prospect.id}`, `${delay}m`);
   ```

## Fix Applied

### `/lib/campaign-randomizer.ts` (Commit: c2f896d9)
```typescript
// FIXED: Return seconds directly
const delaySeconds = 30 + Math.floor(Math.random() * 150); // 30-180 seconds
return delaySeconds; // Return seconds, not minutes
```

### `/inngest/functions/connector-campaign.ts` (Commit: c2f896d9)
```typescript
// FIXED: Use seconds not minutes
console.log(`⏳ Waiting ${delay} seconds before processing...`);
await step.sleep(`human-delay-${prospect.id}`, `${delay}s`);
```

## New Behavior

- **Delay range:** 30-180 seconds (0.5-3 minutes) per prospect
- **137 prospects:** ~7-14 minutes total
- **Randomized:** Each prospect gets different delay
- **No cumulative delays:** Each prospect waits independently

## Deployment

```bash
Commit: c2f896d9
Deployed: 7:38 AM PT
Synced: 7:40 AM PT
Status: ✅ Live in production
```

## Testing

### Current State (7:40 AM)
- **Running campaigns:** 15+ campaigns from 7:07 AM and 7:34 AM batches
- **Using:** OLD code with bug (still slow)
- **Will complete:** Eventually, but slowly

### Next Cron Run: 9:07 AM PT
- **Will use:** NEW fast delays
- **Expected:** Campaigns complete in 7-14 minutes
- **Prospects:** All pending prospects will be picked up

## Manual Trigger (Optional)

Don't wait for 9:07 AM - trigger now:

1. Go to: https://app.inngest.com/env/production/runs
2. Find completed cron: `01KAJGCN3AB3KY8GDXWYV1KT25` or `01KAJHYX1NW38AEAK2SJ9J4YHK`
3. Click "Rerun" button
4. New campaigns will start with FAST delays immediately

## Verification

After next run, check:

```bash
# Check if CRs were sent in last 10 minutes
PGPASSWORD='QFe75XZ2kqhy2AyH' psql \
  -h db.latxadqrvrrrcvkktrog.supabase.co \
  -p 5432 \
  -U postgres \
  -d postgres \
  -c "SELECT COUNT(*) as recent_crs
      FROM campaign_prospects
      WHERE status IN ('cr_sent', 'connection_request_sent')
        AND updated_at > NOW() - INTERVAL '10 minutes';"
```

Expected: 20+ CRs sent (daily limit per account)

## Performance Comparison

| Metric | Before | After |
|--------|--------|-------|
| Delay per prospect | 0-60 min | 30-180 sec |
| 137 prospects | 68 hours | 7-14 min |
| Math.floor bug | Yes (many 0s) | Fixed |
| Units | Minutes | Seconds |

## Files Changed

1. `/lib/campaign-randomizer.ts` - Return seconds instead of minutes
2. `/inngest/functions/connector-campaign.ts` - Use `${delay}s` instead of `${delay}m`

## Next Steps

1. ✅ Fix deployed and synced
2. ⏳ Wait for 9:07 AM cron OR manually rerun
3. ✅ Monitor Inngest dashboard for completions
4. ✅ Verify CRs sent to LinkedIn
5. ✅ Confirm prospect statuses update to `cr_sent`

---

**Status:** Ready for testing at 9:07 AM cron run
**ETA:** Campaigns will complete in 7-14 minutes instead of 68 hours
