# N8N Workflow Modification Plan for Multi-Channel Support

**Date:** November 15, 2025
**Status:** Ready to implement
**Workflow ID:** aVG6LC4ZFRMN7Bw6

---

## Current Workflow Structure Analysis

### Entry Point
1. **Campaign Execute Webhook** - Receives campaign execution requests
2. **Campaign Handler** - Processes prospects and extracts data
3. **Get LinkedIn Profile** - Fetches LinkedIn profile from Unipile
4. **Merge Profile Data** - Combines profile with prospect data

### LinkedIn Flow (Current - Working)
```
Send CR → Check Connection → Wait Loop → Send Messages → Follow-ups
```

**Key Nodes:**
- Send CR (Connection Request)
- Check Connection Accepted (hourly checks for 3 weeks)
- Send Acceptance Message
- Send FU1/FU2/FU3/FU4 (Follow-ups)
- Send GB (Goodbye/Breakup)
- Reply checking between each step
- Status updates to SAM API

---

## Modification Strategy

### Phase 2A: Add Channel Detection (This PR)

**Step 1: Modify Campaign Handler**

Currently the Campaign Handler processes ALL prospects as LinkedIn. We need to add channel detection:

```javascript
// CURRENT CODE (line ~45):
const item = {
  workspace_id: webhookData.workspace_id || webhookData.workspaceId,
  campaign_id: webhookData.campaign_id || webhookData.campaignId,
  unipile_account_id: unipileAccountId,
  // ... LinkedIn-specific fields
};

// NEW CODE:
const item = {
  workspace_id: webhookData.workspace_id || webhookData.workspaceId,
  campaign_id: webhookData.campaign_id || webhookData.campaignId,

  // CHANNEL DETECTION
  channel: webhookData.channel || 'linkedin', // linkedin, email, whatsapp

  // LinkedIn fields (only if channel = linkedin)
  ...(webhookData.channel === 'linkedin' || !webhookData.channel ? {
    unipile_account_id: unipileAccountId,
    linkedin_url: prospect.linkedin_url,
    linkedin_username: prospect.linkedin_url ? prospect.linkedin_url.split('/in/')[1]?.replace(/\/$/, '') : null,
  } : {}),

  // Email fields (only if channel = email)
  ...(webhookData.channel === 'email' ? {
    unipile_account_id: unipileAccountId,
    email_account_id: webhookData.email_account_id,
    to_email: prospect.email,
    from_email: webhookData.from_email,
    subject_template: webhookData.subject_template,
  } : {}),

  // Common fields
  unipile_dsn: unipileDsn,
  unipile_api_key: webhookData.unipile_api_key,
  prospect: prospect,
  messages: webhookData.messages || {},
  timing: webhookData.timing || { ... },
};
```

**Step 2: Add Channel Router Node**

Add new "Channel Router" switch node after "Merge Profile Data":

```
Position: [80, -592] (after "Wait for Cadence Delay")

Type: n8n-nodes-base.switch
Conditions:
  - channel === 'linkedin' → LinkedIn Flow (existing)
  - channel === 'email' → Email Flow (NEW)
  - channel === 'whatsapp' → WhatsApp Flow (future)
```

**Step 3: Keep LinkedIn Flow Unchanged**

The entire LinkedIn flow (Send CR → FU4 → GB) remains exactly as is. The Channel Router just adds a branch BEFORE it.

---

### Phase 2B: Add Email Flow (New Branch)

**New Nodes to Create:**

#### 1. Send Email (First Message)
```
Node Name: "Send Email - Initial"
Type: n8n-nodes-base.httpRequest
Position: [240, -400] (parallel to "Send CR")

Method: POST
URL: ={{ $json.unipile_dsn }}/api/v1/messages/send
Headers:
  - X-API-KEY: ={{ $json.unipile_api_key }}
  - Content-Type: application/json
Body:
  - account_id: ={{ $json.email_account_id }}
  - to: ={{ $json.to_email }}
  - subject: ={{ $json.subject_template.replace('{first_name}', $json.prospect.first_name) }}
  - body: ={{ $json.messages.initial_email.replace('{first_name}', $json.prospect.first_name) }}
  - from_name: ={{ $json.from_email }}
```

#### 2. Update Email State - Initial Sent
```
Node Name: "Update Email State - Initial Sent"
Type: n8n-nodes-base.code
Position: [544, -400]

Code:
try {
  const prospect_id = $input.item.json.prospect?.id;
  const campaign_id = $input.item.json.campaign_id;

  const data = {
    prospect_id: prospect_id,
    campaign_id: campaign_id,
    status: 'email_sent',
    channel: 'email',
    step: 1
  };

  const response = await fetch('https://app.meet-sam.com/api/webhooks/n8n/prospect-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  const result = await response.json();
  return { json: { ...$input.item.json, sam_api_response: result } };

} catch (error) {
  console.error('ERROR:', error.message);
  throw error;
}
```

#### 3. Wait for Email FU1
```
Node Name: "Wait Email FU1"
Type: n8n-nodes-base.wait
Position: [832, -400]

Amount: ={{ $json.timing.fu1_delay_days }}
Unit: days
Webhook ID: wait-email-fu1
```

#### 4. Check Email Reply FU1
```
Node Name: "Check Email Reply FU1"
Type: n8n-nodes-base.httpRequest
Position: [1088, -400]

Method: GET
URL: ={{ $json.unipile_dsn }}/api/v1/messages?account_id={{ $json.email_account_id }}&attendee_email={{ $json.to_email }}
Headers:
  - X-API-KEY: ={{ $json.unipile_api_key }}
```

#### 5. Email Reply Received FU1?
```
Node Name: "Email Reply Received FU1?"
Type: n8n-nodes-base.if
Position: [1296, -400]

Condition:
  ={{ $json.items?.filter(m => m.from_email === $json.to_email && new Date(m.date) > new Date($json.last_message_sent)).length || 0 }} > 0
```

#### 6. Mark Email Replied - Exit FU1
```
Node Name: "Mark Email Replied - Exit FU1"
Type: n8n-nodes-base.code
Position: [1568, -272]

Code: (same as LinkedIn replied logic but with email_replied status)
```

#### 7. Send Email FU1
```
Node Name: "Send Email FU1"
Type: n8n-nodes-base.httpRequest
Position: [1568, -400]

Same as "Send Email - Initial" but:
  - body: ={{ $json.messages.follow_up_1.replace(...) }}
```

**Repeat pattern for FU2, FU3, FU4, GB (same as LinkedIn structure)**

---

## Visual Layout Plan

```
                    Campaign Execute Webhook
                              ↓
                      Campaign Handler (MODIFIED - adds channel detection)
                              ↓
                    Get LinkedIn Profile (unchanged)
                              ↓
                    Merge Profile Data (unchanged)
                              ↓
                    Wait for Cadence Delay (unchanged)
                              ↓
                    === CHANNEL ROUTER (NEW) ===
                              ↓
                ┌─────────────┴─────────────┐
                ↓                           ↓
        LinkedIn Flow                 Email Flow (NEW)
        (UNCHANGED)
                ↓                           ↓
         Send CR                   Send Email - Initial
         Check Connection          Update Email State
         Wait/Loop                 Wait Email FU1
         Send Messages             Check Email Reply FU1
         Follow-ups                Reply Received?
         Goodbye                   Send Email FU1
         Status Updates            ... (repeat pattern)
```

---

## Backward Compatibility Guarantees

### 1. Existing LinkedIn Campaigns
- Campaign Handler defaults `channel` to 'linkedin' if not provided
- Channel Router routes to existing LinkedIn flow
- **Zero changes** to LinkedIn node logic
- All existing webhooks continue working

### 2. Field Compatibility
- Support both snake_case (new) and camelCase (old) for backward compatibility
- Existing `unipile_account_id` extraction logic preserved
- LinkedIn-specific fields only added when `channel === 'linkedin'`

### 3. Testing Strategy
- Test with OLD payload (no channel field) → Should route to LinkedIn ✅
- Test with NEW payload (`channel: 'linkedin'`) → Should route to LinkedIn ✅
- Test with NEW payload (`channel: 'email'`) → Should route to Email ✅

---

## Implementation Checklist

### Phase 2A: Channel Detection (1-2 hours)
- [ ] Modify Campaign Handler function code
- [ ] Add channel detection logic
- [ ] Add conditional field extraction (LinkedIn vs Email)
- [ ] Test Campaign Handler outputs both channels

### Phase 2B: Channel Router (30 min)
- [ ] Add Switch node after "Wait for Cadence Delay"
- [ ] Configure channel routing conditions
- [ ] Connect LinkedIn branch to "Send CR"
- [ ] Connect Email branch to new Email nodes

### Phase 2C: Email Nodes (3-4 hours)
- [ ] Create "Send Email - Initial" node
- [ ] Create "Update Email State - Initial Sent" node
- [ ] Create "Wait Email FU1" node
- [ ] Create "Check Email Reply FU1" node
- [ ] Create "Email Reply Received FU1?" node
- [ ] Create "Mark Email Replied - Exit FU1" node
- [ ] Create "Send Email FU1" node
- [ ] Repeat pattern for FU2, FU3, FU4, GB

### Phase 2D: Testing (2-3 hours)
- [ ] Test LinkedIn campaign (regression test)
- [ ] Test Email campaign (new functionality)
- [ ] Verify status updates work for both channels
- [ ] Check error handling for both flows

---

## API Route Changes Needed

**File:** `/app/api/campaigns/email/execute/route.ts`

**Change routing from direct Unipile to N8N:**

```typescript
// BEFORE:
// Direct Unipile API call

// AFTER:
// Route to N8N with channel='email'
const response = await fetch(`${N8N_WEBHOOK_URL}/webhook/campaign-execute`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    workspace_id: workspaceId,
    campaign_id: campaignId,
    channel: 'email', // ← KEY DIFFERENCE
    email_account_id: emailAccountId,
    from_email: fromEmail,
    subject_template: subjectTemplate,
    prospects: prospects,
    messages: messages,
    timing: timing,
    unipile_dsn: UNIPILE_DSN,
    unipile_api_key: UNIPILE_API_KEY,
    supabase_url: SUPABASE_URL,
    supabase_service_key: SUPABASE_SERVICE_ROLE_KEY
  })
});
```

---

## Risk Assessment

**Low Risk Areas (Green):**
- Campaign Handler modification (adds detection, doesn't change existing logic)
- Channel Router (new node, doesn't affect existing flow)
- Email nodes (completely new branch, isolated from LinkedIn)

**Medium Risk Areas (Yellow):**
- API route changes (need to test both old and new campaigns)
- Status update endpoint (must handle both LinkedIn and Email statuses)

**Zero Risk Areas:**
- LinkedIn flow nodes (completely unchanged)
- Existing LinkedIn campaigns (backward compatible)

---

## Success Criteria

✅ **Regression Test:** Existing LinkedIn campaigns work exactly as before
✅ **Email Campaign:** Email campaigns successfully execute through N8N
✅ **Reply Detection:** Email replies trigger HITL approval
✅ **Status Updates:** Campaign prospect status updates work for email
✅ **Error Handling:** Errors reported correctly for both channels
✅ **Follow-ups:** Email follow-up sequences work with delays

---

## Next Steps After Phase 2

**Phase 3:** Add WhatsApp support (same pattern as Email)
**Phase 4:** Multi-channel campaigns (LinkedIn → Email → WhatsApp in single campaign)
**Phase 5:** Database-driven step execution (read from execution_state table)

---

**Ready to implement:** Yes ✅
**Estimated time:** 6-8 hours
**Risk level:** Low (backward compatible)
**Testing required:** LinkedIn regression + Email end-to-end

