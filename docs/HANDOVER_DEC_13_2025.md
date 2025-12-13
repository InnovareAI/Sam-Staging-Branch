# Handover Document - December 13, 2025

## Executive Summary

This document covers all work completed on December 13, 2025. Major accomplishments:

1. **Reply Agent Google Chat Notification Routing** - Implemented dual-channel routing based on workspace type
2. **Notification Format Differentiation** - IA workspaces get full HITL approval, clients get notification-only
3. **LinkedIn Profile Link Always Visible** - All notifications now include LinkedIn "View Profile" button

---

## Completed Tasks (Dec 13)

### 1. Reply Agent Notification Routing

Implemented intelligent routing of Reply Agent notifications to different Google Chat channels based on workspace ownership.

**Routing Logic:**
- **IA Workspaces (IA1-IA6)** → `GOOGLE_CHAT_REPLIES_WEBHOOK_URL` (Campaign Replies channel)
- **Client Workspaces** → `GOOGLE_CHAT_CLIENT_WEBHOOK_URL` (QC channel)

**IA Workspace IDs:**
```typescript
const INNOVAREAI_WORKSPACE_IDS = [
  'babdcab8-1a78-4b2f-913e-6e9fd9821009', // IA1 - Thorsten
  '04666209-fce8-4d71-8eaf-01278edfc73b', // IA2 - Michelle
  '96c03b38-a2f4-40de-9e16-43098599e1d4', // IA3 - Irish
  '7f0341da-88db-476b-ae0a-fc0da5b70861', // IA4 - Charissa
  'cd57981a-e63b-401c-bde1-ac71752c2293', // IA5 - Jennifer
  '2a8f7c3d-9b1e-4f6a-8c2d-5e9a1b4f7d3c', // IA6 - Chona
];
```

---

### 2. Notification Format Differentiation

**IA Workspace Notifications (Full HITL Approval):**
- Campaign Info section (Workspace, Campaign, LinkedIn)
- Intent classification with prospect's message
- SAM's Draft Reply section
- 4 action buttons: Approve & Send, Reject, Edit Reply, Add Instructions

**Client Workspace Notifications (Notification Only):**
- Campaign Info section (Workspace, Campaign, LinkedIn)
- Intent classification with prospect's message
- NO SAM draft reply
- NO action buttons

This is because clients need to enable Reply Agent in their settings before SAM can auto-reply. Until then, they just receive notifications about incoming replies.

---

### 3. LinkedIn Profile Link Always Visible

All notifications now include a LinkedIn section with:
- LinkedIn URL displayed
- "View Profile" button that opens the prospect's LinkedIn profile

**Implementation:**
```typescript
// LinkedIn link - ALWAYS shown
if (notification.prospectLinkedInUrl) {
  infoWidgets.push({
    decoratedText: {
      topLabel: 'LinkedIn',
      text: notification.prospectLinkedInUrl,
      startIcon: { knownIcon: 'MEMBERSHIP' },
      button: {
        text: 'View Profile',
        onClick: {
          openLink: { url: notification.prospectLinkedInUrl },
        },
      },
    },
  });
}
```

---

## Files Modified

### Notifications
- `lib/notifications/google-chat.ts` - Core notification routing and formatting logic
  - Added `INNOVAREAI_WORKSPACE_IDS` array
  - Updated `sendReplyAgentHITLNotification()` to route based on workspace
  - Conditional inclusion of SAM draft + buttons for IA workspaces only
  - LinkedIn link always included in Campaign Info section

---

## Environment Variables

**Added to both `.env.local` and Netlify production:**

```bash
# Google Chat Webhooks for Reply Agent notifications
GOOGLE_CHAT_REPLIES_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/AAQAyTeGzr8/messages?key=...&token=...
GOOGLE_CHAT_CLIENT_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/AAQAhGEMBCU/messages?key=...&token=...
```

**Channel Purposes:**
- `GOOGLE_CHAT_REPLIES_WEBHOOK_URL` - Campaign Replies channel (IA team HITL approval)
- `GOOGLE_CHAT_CLIENT_WEBHOOK_URL` - QC channel (InnovareAI internal monitoring of client replies)

---

## Architecture Notes

### Notification Flow

```
1. Reply Agent detects new reply from prospect
2. System generates draft response using SAM AI
3. sendReplyAgentHITLNotification() called with:
   - workspaceId: Used to determine routing
   - prospectLinkedInUrl: Always displayed
   - clientName: Workspace name
   - campaignName: Campaign name
   - draftReply: SAM's generated response
   - approvalToken: For HITL approval flow
4. Routing decision:
   - Is workspaceId in INNOVAREAI_WORKSPACE_IDS?
     - YES: Send to Campaign Replies with full HITL card
     - NO: Send to QC with notification-only card
```

### Google Chat Card Format (Cards V2)

```typescript
{
  cardsV2: [{
    cardId: "reply-agent-{draftId}",
    card: {
      header: {
        title: "📬 New Reply from {prospectName}",
        subtitle: "{title} at {company}",
        imageType: "CIRCLE"
      },
      sections: [
        // Campaign Info (always)
        { header: "📋 Campaign Info", widgets: [...] },
        // Intent + Message (always)
        { header: "Intent: 🔥 INTERESTED", widgets: [...] },
        // SAM's Draft Reply (IA only)
        { header: "💡 SAM's Draft Reply", widgets: [...] },
        // Action Buttons (IA only)
        { widgets: [{ buttonList: { buttons: [...] } }] }
      ]
    }
  }]
}
```

---

## Testing

### Test Commands Used

**IA Channel (Full Notification):**
```bash
curl -X POST "https://chat.googleapis.com/v1/spaces/AAQAyTeGzr8/messages?key=...&token=..." \
  -H "Content-Type: application/json" \
  -d '{ full card JSON with SAM reply and buttons }'
```

**Client QC Channel (Notification Only):**
```bash
curl -X POST "https://chat.googleapis.com/v1/spaces/AAQAhGEMBCU/messages?key=...&token=..." \
  -H "Content-Type: application/json" \
  -d '{ card JSON without SAM reply or buttons }'
```

Both tests successful - notifications appear in correct channels with correct formats.

---

## Commits

- `6a078de9` - fix: client notifications are notification-only (no SAM reply/buttons)

---

## Production URLs

- **App**: https://app.meet-sam.com
- **Supabase**: https://latxadqrvrrrcvkktrog.supabase.co
- **Campaign Replies Channel**: Google Chat space AAQAyTeGzr8
- **Client QC Channel**: Google Chat space AAQAhGEMBCU

---

## Next Steps

### Future Enhancements
- [ ] Add client-specific notification preferences in Settings
- [ ] Allow clients to enable/disable Reply Agent
- [ ] Add notification history/audit log
- [ ] Consider Slack notifications as alternative to Google Chat

---

*Last Updated: December 13, 2025*
