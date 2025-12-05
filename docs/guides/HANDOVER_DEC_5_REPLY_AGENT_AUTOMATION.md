# HANDOVER: Reply Agent Full Automation
**Date:** December 5, 2025
**Status:** DEPLOYED TO PRODUCTION

---

## Summary

Reply Agent is now fully automated with HITL notifications going to Google Chat instead of email.

---

## Changes Made

### 1. HITL Notifications: Email → Google Chat

**Problem:** HITL approval requests were going to Postmark email by default, not Google Chat.

**Fix:** Changed both notification locations in `reply-agent-process/route.ts`:

| Location | Line | Before | After |
|----------|------|--------|-------|
| Main loop | 218-230 | `sendHITLEmail()` | `sendReplyAgentHITLNotification()` |
| `processPendingGenerationDrafts` | 1090-1102 | `sendHITLEmail()` | `sendReplyAgentHITLNotification()` |

**Files Changed:**
- `app/api/cron/reply-agent-process/route.ts`

**Commit:** `d36a0f80` - "HITL: Default to Google Chat instead of email"

---

### 2. Reply Agent Scheduled Function

**Problem:** Reply Agent wasn't running automatically on a schedule.

**Fix:** Added to `netlify.toml`:

```toml
[functions."reply-agent-process"]
  schedule = "*/5 * * * *"
```

**How It Works:**
1. `poll-message-replies` (every 15 min) detects new replies → creates draft with `status: pending_generation`
2. `reply-agent-process` (every 5 min) picks up `pending_generation` drafts:
   - Fetches LinkedIn profile + company research
   - Generates AI reply using Claude Opus 4.5
   - Sends HITL notification to Google Chat
   - Updates status to `pending_approval`
3. User clicks Approve/Reject in Google Chat
4. `approve/route.ts` sends via Unipile or marks rejected

---

### 3. Error Analysis & Fixes

**Comprehensive error search performed.** Results:

| Issue | File | Status |
|-------|------|--------|
| Array bounds check | `postmark-inbound/route.ts:72` | **FIXED** |
| Missing `.single()` null checks | `campaigns/route.ts` (6 places) | Already had proper checks |
| Missing `.single()` null checks | `reply-agent/approve/route.ts` (2 places) | Already had proper checks |
| RLS policy bypasses | Multiple files | Workaround in place (service role) |
| LinkedIn Commenting Agent creation | `monitors/route.ts` | Still open (needs logs) |

**Fix Applied:**
```typescript
// postmark-inbound/route.ts - Added bounds check
if (!email.ToFull || email.ToFull.length === 0) {
  console.error('❌ No recipients in ToFull array');
  return NextResponse.json({ error: 'No recipient found' }, { status: 400 });
}
const recipient = email.ToFull[0]
const mailboxHash = recipient?.MailboxHash || ''
```

**Commit:** `7a0e9768` - "Fix: Array bounds check + null safety in postmark-inbound webhook"

---

## Architecture: Reply Agent Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     REPLY AGENT FLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. PROSPECT REPLIES ON LINKEDIN                                │
│     └─> Unipile webhook OR poll-message-replies (15 min)        │
│                                                                 │
│  2. DRAFT CREATED                                               │
│     └─> reply_agent_drafts: status = 'pending_generation'       │
│                                                                 │
│  3. REPLY-AGENT-PROCESS (every 5 min)                           │
│     ├─> Fetch LinkedIn profile                                  │
│     ├─> Fetch company data (LinkedIn + website)                 │
│     ├─> Generate AI reply (Claude Opus 4.5)                     │
│     ├─> Update draft: status = 'pending_approval'               │
│     └─> Send Google Chat notification                           │
│                                                                 │
│  4. GOOGLE CHAT HITL                                            │
│     ├─> [Approve & Send] → /api/reply-agent/approve             │
│     ├─> [Reject] → /api/reply-agent/approve                     │
│     ├─> [Edit Reply] → /reply-agent/edit page                   │
│     └─> [Add Instructions] → /reply-agent/instructions page     │
│                                                                 │
│  5. MESSAGE SENT                                                │
│     └─> Unipile /api/v1/chats/{chat_id}/messages                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `app/api/cron/reply-agent-process/route.ts` | Main Reply Agent cron job |
| `app/api/reply-agent/approve/route.ts` | Approve/reject endpoint |
| `lib/notifications/google-chat.ts` | Google Chat webhook helpers |
| `netlify/functions/reply-agent-process.ts` | Netlify scheduled function wrapper |
| `netlify.toml` | Cron schedule configuration |

---

## Environment Variables Required

```bash
GOOGLE_CHAT_REPLIES_WEBHOOK_URL  # Campaign Replies channel webhook
UNIPILE_DSN                      # api6.unipile.com:13670
UNIPILE_API_KEY                  # Unipile API key
CRON_SECRET                      # For internal cron auth
```

---

## Testing

**Trigger manually:**
```bash
CRON_SECRET="792e0c09eeee1a229b78a6341739613177fad24f401b1c82f2673bbb9ee806a0" \
curl -s -X POST "https://app.meet-sam.com/api/cron/reply-agent-process" \
  -H "x-cron-secret: $CRON_SECRET" \
  -H "Content-Type: application/json"
```

**Check drafts:**
```bash
SERVICE_KEY="..." curl -s \
  "https://latxadqrvrrrcvkktrog.supabase.co/rest/v1/reply_agent_drafts?select=id,prospect_name,status,created_at&order=created_at.desc&limit=5" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY"
```

---

## Open Issues

1. **LinkedIn Commenting Agent** - Campaign creation still failing with "Internal server error"
   - Need browser console logs to diagnose
   - Likely RLS policy or workspace membership issue

2. **RLS Policy Workarounds** - Several endpoints use service role to bypass RLS
   - Should be fixed properly with updated policies

---

## Deployments

| Time | Commit | Description |
|------|--------|-------------|
| Dec 5, 2025 | `d36a0f80` | HITL: Google Chat is now default |
| Dec 5, 2025 | `7a0e9768` | Array bounds check in postmark-inbound |

---

## Next Steps

1. Monitor Google Chat for HITL notifications
2. Verify approve/reject buttons work correctly
3. Test Edit Reply and Add Instructions pages
4. Fix LinkedIn Commenting Agent (needs logs)
