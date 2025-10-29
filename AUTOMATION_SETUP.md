# SAM Campaign Automation Setup Guide

## ✅ FIXES COMPLETED

1. **Name Enrichment**: Prospects with missing names now get enriched from LinkedIn profiles
2. **Message Truncation**: Messages automatically truncated to LinkedIn's 300 char limit (with newline stripping)
3. **API Endpoint**: Ready at `https://app.meet-sam.com/api/cron/process-pending-prospects`

## 🚀 AUTOMATIC EXECUTION SETUP

Your campaigns will run automatically using an external cron service.

### Option 1: cron-job.org (RECOMMENDED - 100% FREE)

**Setup Time: 2 minutes**

1. Go to: https://cron-job.org/en/members/
2. Sign up for free account (no credit card needed)
3. Click "Create Cron Job"
4. Configure:
   ```
   Title: SAM Campaign Execution
   URL: https://app.meet-sam.com/api/cron/process-pending-prospects
   Request method: POST
   Schedule: Every 2 minutes
     - Minutes: */2
     - Hours: *
     - Days: *
     - Months: *
   ```
5. Click "Create"
6. Status should show: "Active"

### Option 2: EasyCron (FREE - 80 calls/day)

1. Go to: https://www.easycron.com/user/register
2. Sign up for free (80 executions/day = good for ~120 prospects/day)
3. Add Cron Job:
   ```
   URL: https://app.meet-sam.com/api/cron/process-pending-prospects
   Cron Expression: */2 * * * *
   HTTP Method: POST
   ```

### Option 3: UptimeRobot (FREE but 5-min intervals only)

1. Go to: https://uptimerobot.com/signUp
2. Add New Monitor:
   ```
   Monitor Type: HTTP(s)
   Friendly Name: SAM Campaigns
   URL: https://app.meet-sam.com/api/cron/process-pending-prospects
   Monitoring Interval: 5 minutes
   ```

## 📊 HOW IT WORKS

```
Every 2 minutes:
┌─────────────────────────────────────┐
│ 1. Cron service calls your API     │
│ 2. Finds 3 pending prospects       │
│ 3. Fetches LinkedIn profiles       │
│ 4. Enriches missing names           │
│ 5. Truncates long messages         │
│ 6. Sends connection requests        │
│ 7. Updates status → 'requested'    │
│ 8. Waits 2 minutes                 │
│ 9. Repeats...                      │
└─────────────────────────────────────┘
```

**Processing Speed:**
- 3 prospects per run
- Every 2 minutes
- = ~90 prospects/hour
- = ~2,160 prospects/day (24/7)

## ⚠️ LINKEDIN RATE LIMITS

LinkedIn limits connection requests per account:
- **~100 requests/week** per account
- Rate limit errors are NORMAL
- System will skip rate-limited accounts
- Continues with next prospect automatically

**Solution for hundreds of campaigns:**
- Each user connects THEIR OWN LinkedIn account
- Each account = 100 requests/week
- 10 accounts = 1,000 requests/week
- System automatically rotates between accounts

## ✅ VERIFY IT'S WORKING

### Check Cron Service Dashboard
After 5 minutes, check your cron dashboard:
- Last execution: Should show recent timestamp
- Response: Should be 200 (success)
- Response body: `{"success":true,"prospects_processed":3}`

### Check Campaign Status
```bash
cd Sam-New-Sep-7
node scripts/js/check-campaign-status.mjs
```

You should see:
- `pending` count decreasing
- `connection_requested` count increasing
- `contacted_at` timestamps updating

### Check Logs (if needed)
Go to: https://app.netlify.com → Functions → Logs

Look for:
- `✅ Processed 3 prospects`
- `✅ CR sent successfully to [Name]`
- `⚠️ Rate limit` (normal after ~20 requests)

## 🔧 TROUBLESHOOTING

### "No pending prospects"
- Check campaign status is 'active' (not 'draft' or 'paused')
- Check prospects have LinkedIn URLs
- Check prospects status is 'pending' (not already 'connection_requested')

### "Rate limit" errors
- Normal after sending ~20 requests
- LinkedIn limits: 100/week per account
- Wait 1 hour, system will continue automatically
- Add more LinkedIn accounts to rotate

### "Message too long" (should not happen anymore)
- ✅ Fixed: Messages auto-truncated to 300 chars
- If still seeing: Contact support with campaign ID

### Cron service not calling
- Check URL is exact: `https://app.meet-sam.com/api/cron/process-pending-prospects`
- Check method is POST
- Check cron is enabled/active
- Check account has credits (for paid tiers)

## 📈 SCALING TO HUNDREDS OF CAMPAIGNS

When you're ready to deploy hundreds of campaigns:

1. **Each user connects their LinkedIn**:
   - Go to Workspace Settings → Integrations
   - Click "Connect LinkedIn"
   - Each account = 100 requests/week capacity

2. **Campaigns auto-execute**:
   - System processes ALL active campaigns
   - Rotates between available accounts
   - Respects rate limits automatically

3. **Monitor dashboard**:
   - Check cron execution logs
   - Monitor prospect status changes
   - Watch for errors

## 🎉 SUCCESS METRICS

You'll know it's working when:
- ✅ Prospects moving from 'pending' → 'connection_requested'
- ✅ Cron service showing 200 responses
- ✅ LinkedIn showing sent connection requests
- ✅ No manual triggering needed

## 🆘 NEED HELP?

If automation isn't working after setup:
1. Check cron service dashboard (is it calling?)
2. Check API endpoint manually (does it respond?)
3. Check campaign status (is it 'active'?)
4. Check LinkedIn accounts (are they connected?)
5. Check Netlify logs (any errors?)

---

**Current Status:**
- ✅ API endpoint working
- ✅ Message truncation fixed
- ✅ Name enrichment fixed
- ⏳ Waiting for cron setup (2 minutes)

**Next Steps:**
1. Set up cron service (Option 1 recommended)
2. Wait 5 minutes
3. Verify prospects sending
4. Deploy your hundreds of campaigns!
