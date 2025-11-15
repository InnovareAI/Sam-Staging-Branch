# Email Campaign N8N Integration Instructions

**Date:** November 15, 2025
**Status:** Ready to implement
**Modified Workflow:** SAM-Master-Campaign-Orchestrator-MULTI-CHANNEL.json (on Desktop)

---

## Step 1: Upload N8N Workflow ✅ (You're doing this)

**File Location:** `/Users/tvonlinz/Desktop/SAM-Master-Campaign-Orchestrator-MULTI-CHANNEL.json`

**Upload Method:**
1. Go to https://workflows.innovareai.com
2. Navigate to Workflows → SAM Master Campaign Orchestrator
3. Click "Settings" → "Import from File"
4. Select `SAM-Master-Campaign-Orchestrator-MULTI-CHANNEL.json`
5. Confirm import

**What Changed:**
- Campaign Handler now detects `channel` field
- Added Channel Router switch node
- Added Email Flow branch (9 new nodes)
- LinkedIn flow completely unchanged

---

## Step 2: Modify Email Execute API Route

**File:** `/app/api/campaigns/email/execute/route.ts`

**Current State:** Direct Unipile API calls (lines 191-289)
**New State:** Route to N8N like LinkedIn campaigns do

### Changes Needed:

#### 1. Add N8N Configuration (top of file, after line 11)

```typescript
// N8N Workflow configuration
const N8N_WEBHOOK_URL = process.env.N8N_CAMPAIGN_WEBHOOK_URL || 'https://workflows.innovareai.com/webhook/campaign-execute';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const UNIPILE_DSN = process.env.UNIPILE_DSN || 'https://api6.unipile.com:13670';
```

#### 2. Replace Direct Email Sending Logic (lines 183-290)

**BEFORE (Direct Unipile):**
```typescript
// Process each prospect
for (const campaignProspect of prospectsToProcess) {
  try {
    const prospect = campaignProspect.workspace_prospects;

    // Personalize and send email via Unipile
    const emailResponse = await sendEmailViaUnipile({
      account_id: selectedAccount.sources[0].id,
      to: prospect.email_address,
      subject: subjectToSend,
      body: bodyToSend,
      from_name: selectedAccount.name || 'SAM AI Assistant'
    });

    // Update status...
  } catch (error) { ... }
}
```

**AFTER (Route to N8N):**
```typescript
// Prepare prospects for N8N
const prospectsPayload = prospectsToProcess.map((cp: any) => {
  const prospect = cp.workspace_prospects;
  return {
    id: cp.id, // campaign_prospect ID
    email: prospect.email_address,
    first_name: prospect.first_name,
    last_name: prospect.last_name,
    company_name: prospect.company_name,
    title: prospect.job_title,
    location: prospect.location,
    industry: prospect.industry
  };
});

// Call N8N webhook with channel='email'
const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    // CRITICAL: Set channel to 'email'
    channel: 'email',

    // Campaign identifiers
    workspace_id: campaign.workspace_id,
    campaign_id: campaignId,

    // Email-specific fields
    email_account_id: selectedAccount.sources[0].id,
    from_email: selectedAccount.name || 'SAM AI Assistant',
    subject_template: campaign.message_templates?.email_subject || 'Quick question',

    // Common fields
    unipile_dsn: UNIPILE_DSN,
    unipile_api_key: UNIPILE_API_KEY,
    supabase_url: SUPABASE_URL,
    supabase_service_key: SUPABASE_SERVICE_ROLE_KEY,

    // Prospects
    prospects: prospectsPayload,

    // Messages
    messages: {
      initial_email: campaign.message_templates?.email_body || '',
      follow_up_1: campaign.message_templates?.follow_up_emails?.[0]?.body || '',
      follow_up_2: campaign.message_templates?.follow_up_emails?.[1]?.body || '',
      follow_up_3: campaign.message_templates?.follow_up_emails?.[2]?.body || '',
      follow_up_4: campaign.message_templates?.follow_up_emails?.[3]?.body || '',
      goodbye: campaign.message_templates?.follow_up_emails?.[4]?.body || ''
    },

    // Timing configuration
    timing: {
      fu1_delay_days: campaign.message_templates?.follow_up_emails?.[0]?.delay_days || 2,
      fu2_delay_days: campaign.message_templates?.follow_up_emails?.[1]?.delay_days || 5,
      fu3_delay_days: campaign.message_templates?.follow_up_emails?.[2]?.delay_days || 7,
      fu4_delay_days: campaign.message_templates?.follow_up_emails?.[3]?.delay_days || 5,
      gb_delay_days: campaign.message_templates?.follow_up_emails?.[4]?.delay_days || 7
    }
  })
});

if (!n8nResponse.ok) {
  throw new Error(`N8N workflow failed: ${n8nResponse.statusText}`);
}

const n8nResult = await n8nResponse.json();

console.log('✅ Email campaign sent to N8N orchestrator:', n8nResult);

// Update campaign status
await supabase
  .from('campaigns')
  .update({
    status: 'active',
    last_executed_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })
  .eq('id', campaignId);

return NextResponse.json({
  message: 'Email campaign launched via N8N orchestrator',
  prospects_queued: prospectsPayload.length,
  n8n_execution: n8nResult,
  account_used: selectedAccount.name,
  next_steps: 'N8N will orchestrate email sending, reply detection, and HITL approval'
});
```

---

## Step 3: Test Both Channels

### Test 1: LinkedIn Campaign (Regression)

**Purpose:** Ensure LinkedIn campaigns still work

**Steps:**
1. Create LinkedIn Connector campaign
2. Upload 2-3 test prospects
3. Launch campaign
4. Check N8N execution logs
5. Verify connection requests sent

**Expected Result:**
- Channel Router detects `channel: 'linkedin'`
- Routes to existing LinkedIn flow
- Everything works as before ✅

### Test 2: Email Campaign (New)

**Purpose:** Verify email campaigns work via N8N

**Steps:**
1. Create Email campaign
2. Upload 2-3 test prospects with emails
3. Launch campaign
4. Check N8N execution logs
5. Verify emails sent via Unipile

**Expected Result:**
- Channel Router detects `channel: 'email'`
- Routes to new Email flow
- Initial email sent ✅
- Status updated to 'email_sent' ✅
- Follow-up scheduled ✅

---

## N8N Workflow Structure (After Upload)

```
Campaign Execute Webhook
  ↓
Campaign Handler (MODIFIED - detects channel)
  ↓
Get LinkedIn Profile (skipped for email)
  ↓
Merge Profile Data
  ↓
Wait for Cadence Delay
  ↓
=== CHANNEL ROUTER (NEW) ===
  ↓
  ├─ LinkedIn Branch (channel='linkedin') → Send CR → Follow-ups...
  │
  └─ Email Branch (channel='email') → Send Email Initial
                                     → Update Email State
                                     → Wait Email FU1
                                     → Check Email Reply FU1
                                     → Reply Received?
                                        ├─ Yes → Mark Replied - Exit
                                        └─ No → Send Email FU1 → Complete
```

---

## Verification Checklist

### After N8N Workflow Upload:
- [ ] Workflow shows 56 nodes (was 47, added 9)
- [ ] Channel Router node exists
- [ ] Email flow nodes exist
- [ ] Workflow is active

### After API Route Update:
- [ ] Email execute route calls N8N webhook
- [ ] Payload includes `channel: 'email'`
- [ ] Email-specific fields included

### After Testing:
- [ ] LinkedIn campaign works (regression test)
- [ ] Email campaign works (new functionality)
- [ ] Status updates work for both channels
- [ ] Reply detection works for both channels

---

## Rollback Plan (If Issues)

### If N8N Workflow Breaks:
1. N8N has version history - click "Versions" tab
2. Restore previous version
3. LinkedIn campaigns work again

### If API Route Breaks:
1. Git revert changes to email/execute/route.ts
2. Email campaigns use direct Unipile again
3. (Won't have orchestration, but will send emails)

---

## Benefits After Implementation

**For LinkedIn Campaigns:**
- No changes - continues working exactly as before ✅

**For Email Campaigns:**
- ✅ Orchestrated follow-up sequences (not just one email)
- ✅ Reply detection and HITL approval
- ✅ Centralized status tracking
- ✅ Same infrastructure as LinkedIn
- ✅ Unified monitoring and debugging

**For Future Multi-Channel:**
- ✅ Foundation for LinkedIn → Email → WhatsApp sequences
- ✅ Cross-channel reply detection
- ✅ Smart routing (skip email if LinkedIn replied)

---

## Support

**If Issues:**
1. Check N8N execution logs: https://workflows.innovareai.com/executions
2. Check Netlify function logs: https://app.netlify.com
3. Check Supabase logs for status updates
4. Rollback using plans above

**Success Indicators:**
- Email campaigns show "Launched via N8N" ✅
- N8N shows email executions ✅
- Prospects receive emails ✅
- Follow-ups scheduled correctly ✅

---

**Next:** After this works, we can add WhatsApp support using same pattern.

