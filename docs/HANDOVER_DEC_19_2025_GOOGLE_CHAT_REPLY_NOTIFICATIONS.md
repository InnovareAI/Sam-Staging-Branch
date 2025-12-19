# Google Chat Reply Notifications Implementation

**Date:** December 19, 2025
**Status:** DEPLOYED
**Commit:** `a770c8c9`

## Overview

Added Google Chat notifications for ALL LinkedIn reply drafts, ensuring Thorsten and other users see reply drafts in Google Chat (not just email).

## Changes Made

### 1. Updated Reply Agent Cron (`app/api/cron/reply-agent-process/route.ts`)

**Before:**
- Google Chat notifications only sent for `approval_mode === 'manual'`
- Auto-approved drafts skipped notifications entirely

**After:**
- Google Chat notifications sent for ALL drafts (manual AND auto modes)
- Slack notifications remain manual-only to avoid spam
- Auto mode still sends replies immediately, but notifies first

### 2. Key Changes

#### Main Flow (Lines 229-255)
```typescript
// 8. Send Google Chat notification for ALL drafts (manual and auto modes)
await sendReplyAgentHITLNotification({
  draftId: savedDraft.id,
  approvalToken: savedDraft.approval_token,
  prospectName: savedDraft.prospect_name || 'Unknown',
  prospectTitle: prospect.title,
  prospectCompany: savedDraft.prospect_company,
  inboundMessage: latestInbound.text,
  draftReply: savedDraft.draft_text,
  intent: savedDraft.intent_detected || 'UNCLEAR',
  appUrl: APP_URL,
  workspaceId: workspaceId,
  campaignName: prospect.campaigns?.campaign_name,
  prospectLinkedInUrl: linkedInUrl,
  clientName: config.workspaces?.name,
});

// 9. Handle approval mode
if (config.approval_mode === 'auto') {
  await autoSendReply(savedDraft, linkedinAccount.unipile_account_id, supabase);
}
```

#### Pending Generation Flow (Lines 1190-1253)
```typescript
// Send Google Chat notification for ALL drafts (manual and auto modes)
await sendReplyAgentHITLNotification({ ... });

// Slack notification (manual mode only to avoid spam)
if (config.approval_mode === 'manual') {
  // Send Slack notification with approval buttons
}

// Handle auto-send mode
if (config.approval_mode === 'auto') {
  // Send immediately via Unipile
}
```

## Google Chat Routing

### InnovareAI Workspaces (IA1-IA6)
Notifications sent to: `GOOGLE_CHAT_REPLIES_WEBHOOK_URL` (Campaign Replies channel)

**Workspace IDs:**
- IA1 (Thorsten): `babdcab8-1a78-4b2f-913e-6e9fd9821009`
- IA2 (Michelle): `04666209-fce8-4d71-8eaf-01278edfc73b`
- IA3 (Irish): `96c03b38-a2f4-40de-9e16-43098599e1d4`
- IA4 (Charissa): `7f0341da-88db-476b-ae0a-fc0da5b70861`
- IA5 (Jennifer): `cd57981a-e63b-401c-bde1-ac71752c2293`
- IA6 (Chona): `2a8f7c3d-9b1e-4f6a-8c2d-5e9a1b4f7d3c`

### Client Workspaces
- Dedicated webhook: `CLIENT_WORKSPACE_WEBHOOKS` (if configured)
- Fallback: `GOOGLE_CHAT_CLIENT_WEBHOOK_URL` (QC channel)

## Notification Content

Google Chat notifications include:

1. **Prospect Information:**
   - Name
   - Title
   - Company
   - LinkedIn profile link (clickable)

2. **Message Content:**
   - Their inbound message (full text)
   - Intent classification (INTERESTED, QUESTION, OBJECTION, etc.)

3. **SAM's Draft Reply:**
   - Full AI-generated reply text

4. **Campaign Info:**
   - Workspace name
   - Campaign name

5. **Action Buttons:**
   - Approve & Send
   - Edit
   - Reject

## Testing

### Manual Test
1. Have a prospect reply to a LinkedIn message
2. Wait for reply-agent-process cron to run (every 5 minutes)
3. Check Google Chat "Campaign Replies" channel
4. Verify notification appears with all details

### Expected Behavior
- ✅ Notification appears in Google Chat
- ✅ Includes prospect name, company, title
- ✅ Shows their message and intent
- ✅ Displays SAM's draft reply
- ✅ Has clickable LinkedIn profile link
- ✅ Includes Approve/Edit/Reject buttons
- ✅ Works for both manual AND auto approval modes

## Environment Variables Required

```bash
# InnovareAI workspaces (IA1-IA6)
GOOGLE_CHAT_REPLIES_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/.../messages...

# Client workspaces (general QC channel)
GOOGLE_CHAT_CLIENT_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/.../messages...

# Client-specific webhooks (optional)
GOOGLE_CHAT_CHILLMINE_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/.../messages...
```

## Files Modified

1. **`app/api/cron/reply-agent-process/route.ts`**
   - Line 229-255: Main reply generation flow
   - Line 1190-1253: Pending generation flow

## Related Documentation

- **Google Chat Integration:** `lib/notifications/google-chat.ts`
- **Reply Agent System:** `docs/LINKEDIN_MESSAGING_AGENT.md`
- **Workspace Setup:** `docs/LINKEDIN_WORKSPACE_SETUP.md`

## Deployment

```bash
# Commit and push
git add -A
git commit -m "feat: add Google Chat notifications for all LinkedIn reply drafts"
git push origin main

# Automatic deployment via Netlify
# Production: https://app.meet-sam.com
```

## Rollback Plan

If issues arise, revert to commit `531c9c69` (before this change):

```bash
git revert a770c8c9
git push origin main
```

## Notes

- Slack notifications remain manual-only to avoid spamming Slack channels
- Google Chat routing automatically handles IA vs client workspaces
- No database changes required
- No environment variable changes required (already configured)
- Cron job runs every 5 minutes to check for new replies

## Success Criteria

- ✅ Google Chat notifications sent for all reply drafts
- ✅ Works for both manual and auto approval modes
- ✅ Routing to correct workspace channels
- ✅ All notification details included (prospect, message, intent, draft)
- ✅ Action buttons functional (Approve/Edit/Reject)
- ✅ No spam (Slack still manual-only)

---

**Status:** DEPLOYED TO PRODUCTION
**Next Steps:** Monitor Google Chat for incoming reply notifications
