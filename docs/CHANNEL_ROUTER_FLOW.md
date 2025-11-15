# Channel Router Flow Diagram

**Date:** November 15, 2025
**Status:** Updated with Messenger support

---

## Complete Channel Router Logic

```
                    Campaign Execute Webhook
                              ↓
                      Campaign Handler
                    (Extracts channel + campaign_type)
                              ↓
                    Get LinkedIn Profile
                              ↓
                    Merge Profile Data
                              ↓
                    Wait for Cadence Delay
                              ↓
                    ╔═══════════════════════════╗
                    ║   CHANNEL ROUTER (SWITCH) ║
                    ╚═══════════════════════════╝
                              ↓
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ↓                     ↓                     ↓
   OUTPUT 0              OUTPUT 1              OUTPUT 2

   channel='linkedin'    channel='linkedin'    channel='email'
   campaign_type=        campaign_type=
   'connector'           'messenger'
        ↓                     ↓                     ↓
┌───────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ LINKEDIN          │  │ LINKEDIN         │  │ EMAIL            │
│ CONNECTOR         │  │ MESSENGER        │  │ CAMPAIGN         │
│ (Send CR First)   │  │ (Skip CR)        │  │                  │
└───────────────────┘  └──────────────────┘  └──────────────────┘
        ↓                     ↓                     ↓
   Send CR                Skip to:             Send Email - Initial
        ↓                  "Wait 4 Hours            ↓
   Update Status -         After Acceptance"   Update Email State
   CR Sent                     ↓                     ↓
        ↓                  Send Acceptance      Wait Email FU1
   Init Connection         Message                  ↓
   Check                       ↓                Check Email Reply FU1
        ↓                  Wait FU1 Delay           ↓
   Wait 1 Hour                 ↓                Reply Received?
        ↓                  Check Reply FU1          ↓
   Check Connection            ↓                ┌───┴───┐
   Accepted?              Reply Received?       │       │
        ↓                      ↓                Yes     No
   Connection            ┌─────┴─────┐          ↓       ↓
   Accepted?             │           │      Mark     Send Email FU1
        ↓                Yes         No     Replied      ↓
   ┌────┴────┐           ↓           ↓    Exit    Mark Complete
   │         │       Mark        Send FU1
  Yes        No      Replied         ↓
   ↓         ↓      Exit FU1     Wait FU2
Wait 4 Hours Loop Back            ↓
After        or Exit          (Continues
Acceptance   (21 days)         FU2, FU3,
   ↓                           FU4, GB...)
Send
Acceptance
Message
   ↓
Wait FU1 Delay
   ↓
Check Reply FU1
   ↓
(Same follow-up
 pattern as
 Connector)
```

---

## Routing Decision Table

| Channel    | Campaign Type | Routes To            | First Action              |
|------------|---------------|----------------------|---------------------------|
| linkedin   | connector     | Output 0 (Connector) | Send CR                   |
| linkedin   | messenger     | Output 1 (Messenger) | Wait 4 Hours After Accept |
| email      | (any)         | Output 2 (Email)     | Send Email - Initial      |
| (missing)  | connector     | Output 0 (Connector) | Send CR (backward compat) |
| (missing)  | (missing)     | Output 0 (Connector) | Send CR (backward compat) |

---

## Key Differences

### Connector vs Messenger

**LinkedIn Connector:**
- For prospects you're NOT connected to yet
- Sends connection request FIRST
- Waits for acceptance (up to 21 days)
- Then sends acceptance message + follow-ups
- If not connected after 21 days → Exit with "not_connected" status

**LinkedIn Messenger:**
- For prospects you're ALREADY connected to
- Skips connection request entirely
- Starts at "Wait 4 Hours After Acceptance" node
- Immediately sends first message (acceptance message)
- Then continues with same follow-up pattern

**Email:**
- For email-based outreach
- Sends initial email via Unipile
- Waits for reply check intervals
- Sends follow-ups if no reply
- Complete email orchestration

---

## Why Messenger Skips CR

**Problem:**
- Messenger campaigns were routing to "Send CR" node
- This tried to send connection requests to already-connected prospects
- LinkedIn would reject these (already connected)
- Campaigns would fail

**Solution:**
- Channel Router Output 1 routes to "Wait 4 Hours After Acceptance"
- This is the node AFTER connection acceptance
- Skips the entire CR → Check Connection → Loop process
- Directly sends first message to connected prospects

---

## Backward Compatibility

### Old Campaigns (No channel/campaign_type fields)
```
Webhook payload: { prospects: [...], messages: {...} }
  ↓
Campaign Handler: channel = 'linkedin', campaign_type = 'connector'
  ↓
Channel Router: Output 0 (Connector)
  ↓
Existing LinkedIn CR flow (unchanged)
```

### New Connector Campaigns
```
Webhook payload: { channel: 'linkedin', campaign_type: 'connector', ... }
  ↓
Campaign Handler: Detects connector
  ↓
Channel Router: Output 0 (Connector)
  ↓
Existing LinkedIn CR flow
```

### New Messenger Campaigns
```
Webhook payload: { channel: 'linkedin', campaign_type: 'messenger', ... }
  ↓
Campaign Handler: Detects messenger
  ↓
Channel Router: Output 1 (Messenger)
  ↓
Skips to "Wait 4 Hours After Acceptance"
```

### New Email Campaigns
```
Webhook payload: { channel: 'email', ... }
  ↓
Campaign Handler: Detects email
  ↓
Channel Router: Output 2 (Email)
  ↓
New Email flow
```

---

## Testing

### Test 1: LinkedIn Connector (Regression)
```
POST /webhook/campaign-execute
{
  "channel": "linkedin",
  "campaign_type": "connector",
  "prospects": [{ "linkedin_url": "...", ... }],
  "messages": { "cr": "...", ... }
}

Expected: Routes to Output 0 → Send CR → Existing flow ✅
```

### Test 2: LinkedIn Messenger (Fixed)
```
POST /webhook/campaign-execute
{
  "channel": "linkedin",
  "campaign_type": "messenger",
  "prospects": [{ "linkedin_url": "...", ... }],
  "messages": { "acceptance_message": "...", ... }
}

Expected: Routes to Output 1 → Skips CR → "Wait 4 Hours After Acceptance" ✅
```

### Test 3: Email (New)
```
POST /webhook/campaign-execute
{
  "channel": "email",
  "prospects": [{ "email": "...", ... }],
  "messages": { "initial_email": "...", ... },
  "email_account_id": "...",
  "subject_template": "..."
}

Expected: Routes to Output 2 → Send Email - Initial → New Email flow ✅
```

---

## Implementation Checklist

### Workflow Changes
- [x] Campaign Handler extracts `campaign_type`
- [x] Channel Router has 3 outputs (Connector, Messenger, Email)
- [x] Output 0: LinkedIn Connector → Send CR
- [x] Output 1: LinkedIn Messenger → Wait 4 Hours After Acceptance
- [x] Output 2: Email → Send Email - Initial

### API Changes Needed
- [ ] LinkedIn Connector API: Send `campaign_type: 'connector'` to N8N
- [ ] LinkedIn Messenger API: Send `campaign_type: 'messenger'` to N8N
- [ ] Email API: Send `channel: 'email'` to N8N

### Testing
- [ ] LinkedIn Connector campaign works (regression)
- [ ] LinkedIn Messenger campaign works (fixed - no CR sent)
- [ ] Email campaign works (new functionality)

---

**Last Updated:** November 15, 2025
**Status:** Complete - Ready for upload

