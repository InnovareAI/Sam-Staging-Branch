# Handover Document - November 26, 2025

## Session Summary

This session focused on fixing email campaign execution and adding critical safeguards to the LinkedIn campaign system.

---

## Completed Work

### 1. Email Campaign Execution Fix

**Problem:** Email campaigns failing with "Campaign activated but execution failed"

**Root Cause:** Wrong Unipile API endpoint and payload format
- Was using: `POST /api/v1/messages`
- Should be: `POST /api/v1/emails`
- Payload format: `to` needs `[{display_name, identifier}]` not `{email, name}`

**Files Changed:**
- `/app/api/campaigns/email/execute/route.ts` - Fixed Unipile API call

**Status:** Fixed and tested - emails now send correctly

---

### 2. Queue-Based Email Sending

**Change:** Email campaigns now use queue-based sending instead of immediate execution

**How it works:**
- Campaign activation adds emails to `email_send_queue` table
- `process-email-queue` cron runs every 13 minutes
- Sends 1 email per run (~40 emails/day max)
- Business hours only: 8 AM - 5 PM ET
- No weekends or US holidays

**Files Changed:**
- `/app/components/CampaignHub.tsx` (line 8612) - Routes to queue endpoint
- `/app/api/cron/process-email-queue/route.ts` - Added daily quota (40/day) and reply detection

---

### 3. Reply Detection (Stop Messaging When Prospect Replies)

**Problem:** Prospects were receiving follow-ups even after they replied

**Solution:** Added reply detection at multiple points:

1. **Webhook handler** (`/app/api/webhooks/unipile/route.ts`)
   - Already had `new_message` handling
   - Sets `status='replied'`, `responded_at`, clears `follow_up_due_at`

2. **Polling backup** (NEW: `/app/api/cron/poll-message-replies/route.ts`)
   - Runs every 2 hours (schedule: `30 */2 * * *`)
   - Checks Unipile chats for messages FROM prospects
   - Backup for webhook delays (can be up to 8 hours)

3. **Email queue processor** (`/app/api/cron/process-email-queue/route.ts`)
   - Checks `responded_at` before sending
   - Cancels pending emails if prospect replied

4. **Follow-up sender** (`/app/api/cron/send-follow-ups/route.ts`)
   - Checks `responded_at` and `status='replied'` before sending
   - Stops sequence immediately if reply detected

**New Files:**
- `/app/api/cron/poll-message-replies/route.ts`
- `/netlify/functions/poll-message-replies.ts`

**Updated netlify.toml:**
```toml
[functions."poll-message-replies"]
  schedule = "30 */2 * * *"
```

---

### 4. Declined Connection Handling

**Problem:** No handling for declined/withdrawn LinkedIn connections

**Solution:** Updated `poll-accepted-connections` cron to detect and handle declines

**Logic:**
- If prospect is NOT in pending invitations AND NOT in relations list AND CR was sent >24 hours ago
- Mark status as `declined`
- Clear `follow_up_due_at` (stop follow-ups)
- Cancel any pending emails

**File Changed:**
- `/app/api/cron/poll-accepted-connections/route.ts` (lines 359-401)

**24-hour buffer:** Prevents false positives from API delays

---

## Scheduled Cron Jobs (netlify.toml)

| Function | Schedule | Purpose |
|----------|----------|---------|
| `scheduled-campaign-execution` | `*/2 * * * *` | Execute campaigns every 2 min |
| `process-pending-prospects` | `*/5 * * * *` | Process pending prospects every 5 min |
| `process-send-queue` | `* * * * *` | Process LinkedIn CR queue every 1 min |
| `process-email-queue` | `*/13 * * * *` | Send queued emails every 13 min |
| `send-follow-ups` | `*/30 * * * *` | Send follow-up messages every 30 min |
| `poll-accepted-connections` | `0 */2 * * *` | Check accepted connections every 2 hrs |
| `poll-message-replies` | `30 */2 * * *` | Check for replies every 2 hrs (NEW) |

---

## Critical Test Tomorrow (Nov 26, 2025)

**9 follow-ups scheduled to send starting at 9 AM ET:**

| Prospect | Due (ET) | LinkedIn Account | Workspace |
|----------|----------|------------------|-----------|
| Martin Redmond | Overdue | Thorsten Linz | IA1 |
| Alp Deniz Senyurt | Overdue | Irish Maguad | IA3 |
| Michael Pearce | 4:00 AM | Michelle Gestuveo | IA2 |
| Amarjit Mudhar | 4:00 AM | Michelle Gestuveo | IA2 |
| Marlies F. | 4:00 AM | Irish Maguad | IA3 |
| Erin C. | 4:00 AM | Irish Maguad | IA3 |
| Jazib Ahmad | 4:00 AM | Irish Maguad | IA3 |
| Shubh S. | 4:00 AM | Irish Maguad | IA3 |
| Chetas Patel | 9:00 AM | Charissa Saniel | IA4 |

**Business hours:** 9 AM - 5 PM ET (all with due times before 9 AM will send at 9 AM)

**To verify success:**
```sql
-- Check if follow-ups were sent
SELECT
  first_name, last_name, status,
  follow_up_due_at, updated_at
FROM campaign_prospects
WHERE status IN ('connected', 'messaging')
ORDER BY updated_at DESC;
```

---

## Database Schema Notes

**Key tables for campaign flow:**
- `campaigns` - Campaign definitions
- `campaign_prospects` - Prospects with status tracking
- `send_queue` - LinkedIn CR queue
- `email_send_queue` - Email queue
- `workspace_accounts` - LinkedIn accounts per workspace

**Prospect status flow:**
```
pending → connection_request_sent → connected → messaging → replied
                                  ↘ declined (if CR rejected)
```

---

## What Was NOT Changed

- Daily LinkedIn CR limit remains at **20** (user explicitly declined reducing to 14)
- No changes to campaign creation flow
- No changes to prospect approval flow

---

## Commits

1. `b4ae7c71` - Add reply polling backup and fix email campaign execution
2. `cd7c6439` - Add declined connection detection to polling cron

---

## Next Steps / Remaining Items

1. **Monitor tomorrow's follow-ups** - Verify 9 messages send successfully at 9 AM ET
2. **Check Netlify function logs** if any issues:
   ```bash
   netlify logs:function send-follow-ups
   ```

---

## Production URLs

- **App:** https://app.meet-sam.com
- **Netlify Dashboard:** https://app.netlify.com/projects/devin-next-gen-prod
- **Function Logs:** https://app.netlify.com/projects/devin-next-gen-prod/logs/functions

---

*Document created: November 26, 2025*
