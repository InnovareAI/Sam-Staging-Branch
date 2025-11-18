# Prevent N8N Field Mapping Bugs - MANDATORY GUIDE

## 🚨 CRITICAL: READ THIS BEFORE CREATING ANY CAMPAIGN SCRIPT 🚨

This guide exists because we sent ~10 connection requests with:
- ❌ Blank messages (no text at all)
- ❌ "undefined" showing instead of names
- ❌ Literal `\n\n` instead of line breaks
- ❌ Missing all 5 follow-up messages

**DO NOT repeat these mistakes.**

---

## The Problem

**N8N workflows expect snake_case field names:**
```javascript
$json.prospect.first_name
$json.prospect.company_name
$json.messages.connection_request
```

**JavaScript/API conventions use camelCase:**
```javascript
prospect.firstName
prospect.companyName
messages.connectionRequest
```

**If you send only camelCase, N8N gets `undefined` for all fields.**

---

## The Solution: Use the Helper Library

### ✅ CORRECT: Use `n8n-field-mapper.mjs`

```javascript
import { buildN8NPayload } from './lib/n8n-field-mapper.mjs';

// Fetch campaign and prospects
const { data: campaign } = await supabase
  .from('campaigns')
  .select('id, workspace_id, unipile_account_id, message_templates')
  .eq('id', CAMPAIGN_ID)
  .single();

const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('campaign_id', CAMPAIGN_ID)
  .eq('status', 'pending');

// Build payload (automatically handles all field mapping)
const payload = buildN8NPayload(
  campaign,
  prospects,
  campaign.message_templates,
  {
    calculateDelay: (index, total) => {
      // Your delay calculation logic
      return index * 5; // 5 minutes between each
    }
  }
);

// Send to N8N
const response = await fetch('https://workflows.innovareai.com/webhook/connector-campaign', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});
```

**Benefits:**
- ✅ Automatically sends BOTH camelCase AND snake_case
- ✅ Validates required fields before sending
- ✅ Includes all 6 messages (CR + 5 follow-ups)
- ✅ Handles LinkedIn username extraction
- ✅ Warns about missing optional fields
- ✅ Prevents blank messages and "undefined" placeholders

---

## ❌ WRONG: Manual Field Mapping

**NEVER do this:**

```javascript
// BAD - Missing snake_case fields
const payload = {
  prospects: prospects.map(p => ({
    id: p.id,
    firstName: p.first_name,      // ❌ N8N won't find this
    lastName: p.last_name,         // ❌ N8N won't find this
    companyName: p.company_name    // ❌ N8N won't find this
  })),
  messages: {
    connectionRequest: "Hi..."     // ❌ N8N won't find this
  }
};
// Result: Blank messages with "undefined" everywhere
```

**NEVER hardcode messages:**

```javascript
// BAD - Should fetch from database
const payload = {
  messages: {
    connectionRequest: "Hi {first_name}..."  // ❌ Ignores database templates
  }
  // ❌ Missing all follow-up messages
};
// Result: Follow-ups won't be sent
```

---

## Manual Mapping (Only if You Can't Use the Library)

If you absolutely cannot use the helper library, you MUST:

### 1. Send BOTH naming conventions for prospects:

```javascript
{
  id: p.id,
  prospectId: p.id,
  campaignId: CAMPAIGN_ID,

  // Name fields - BOTH camelCase AND snake_case
  firstName: p.first_name,
  first_name: p.first_name,        // N8N expects this
  lastName: p.last_name,
  last_name: p.last_name,          // N8N expects this

  // Company fields - BOTH camelCase AND snake_case
  companyName: p.company_name,
  company_name: p.company_name,    // N8N expects this
  title: p.title,

  // LinkedIn fields - BOTH camelCase AND snake_case
  linkedinUrl: p.linkedin_url,
  linkedin_url: p.linkedin_url,    // N8N expects this
  linkedinUsername: username,
  linkedin_username: username,     // N8N expects this
  linkedinUserId: p.linkedin_user_id,
  linkedin_user_id: p.linkedin_user_id,  // N8N expects this

  // Delay - BOTH camelCase AND snake_case
  sendDelayMinutes: delay,
  send_delay_minutes: delay        // N8N expects this
}
```

### 2. Fetch templates from database:

```javascript
const { data: campaignData } = await supabase
  .from('campaigns')
  .select('message_templates')
  .eq('id', CAMPAIGN_ID)
  .single();

const templates = campaignData.message_templates;
```

### 3. Send ALL 6 messages with BOTH naming conventions:

```javascript
messages: {
  // Connection request - 3 variants for compatibility
  connectionRequest: templates.connection_request,
  connection_request: templates.connection_request,  // N8N expects this
  cr: templates.connection_request,                  // N8N also checks this

  // Follow-up messages - snake_case only
  follow_up_1: templates.follow_up_messages?.[0] || '',
  follow_up_2: templates.follow_up_messages?.[1] || '',
  follow_up_3: templates.follow_up_messages?.[2] || '',
  follow_up_4: templates.follow_up_messages?.[3] || '',
  goodbye_message: templates.follow_up_messages?.[4] || '',

  // Alternative/acceptance message
  alternative_message: templates.alternative_message || templates.follow_up_messages?.[0] || ''
}
```

---

## Testing Checklist

Before running ANY campaign:

### 1. Test with 1 Prospect First

```bash
# Limit to 1 prospect for testing
.limit(1)
```

### 2. Verify the LinkedIn Message

After sending, check LinkedIn to ensure:
- ✅ Message has actual text (not blank)
- ✅ First name is correct (not "undefined")
- ✅ Company name is correct (not blank or "undefined")
- ✅ Line breaks work (not literal `\n\n` text)

### 3. Monitor N8N Workflow

Check https://workflows.innovareai.com for:
- ✅ No field access errors in logs
- ✅ All 6 messages are accessible
- ✅ Prospect data is complete

### 4. Verify Database State

```sql
-- Check message templates exist
SELECT message_templates FROM campaigns WHERE id = 'campaign-id';

-- Verify it has:
-- - connection_request (string)
-- - follow_up_messages (array of 5 strings)
-- - alternative_message (string)
```

---

## Common Mistakes to Avoid

### 1. ❌ Using Only camelCase

```javascript
// WRONG
firstName: p.first_name  // N8N won't find this

// CORRECT
firstName: p.first_name,
first_name: p.first_name  // N8N finds this
```

### 2. ❌ Hardcoding Messages

```javascript
// WRONG
messages: {
  connectionRequest: "Hi {first_name}..."
}

// CORRECT
const { data: campaign } = await supabase
  .from('campaigns')
  .select('message_templates')
  .eq('id', CAMPAIGN_ID)
  .single();

messages: buildN8NMessages(campaign.message_templates)
```

### 3. ❌ Forgetting Follow-ups

```javascript
// WRONG - Only sends connection request
messages: {
  connection_request: templates.connection_request
}

// CORRECT - Sends all 6 messages
messages: {
  connection_request: templates.connection_request,
  cr: templates.connection_request,
  follow_up_1: templates.follow_up_messages?.[0] || '',
  follow_up_2: templates.follow_up_messages?.[1] || '',
  follow_up_3: templates.follow_up_messages?.[2] || '',
  follow_up_4: templates.follow_up_messages?.[3] || '',
  goodbye_message: templates.follow_up_messages?.[4] || '',
  alternative_message: templates.alternative_message || ''
}
```

### 4. ❌ Missing LinkedIn Username Extraction

```javascript
// WRONG - Unipile API needs username, not full URL
linkedinUrl: p.linkedin_url

// CORRECT - Extract username from URL
const linkedinUsername = p.linkedin_url
  ? p.linkedin_url.split('/in/')[1]?.replace(/\/$/, '')
  : null;

// Then send BOTH
linkedinUrl: p.linkedin_url,
linkedin_url: p.linkedin_url,
linkedinUsername: linkedinUsername,
linkedin_username: linkedinUsername
```

### 5. ❌ Double Backslash in Newlines

```javascript
// WRONG - Shows literal \n\n in LinkedIn
message: "Hi {first_name}, \\n\\nI work with..."

// CORRECT - Actual line breaks
message: "Hi {first_name},\n\nI work with..."
```

---

## File Structure

All campaign execution files should follow this structure:

```
scripts/
├── lib/
│   └── n8n-field-mapper.mjs      # Helper library (USE THIS!)
├── execute-campaigns-batched.mjs  # Main batch executor
├── execute-charissa-campaign.mjs  # Per-campaign scripts
└── execute-michelle-campaign.mjs  # Per-campaign scripts
```

---

## Migration Path for Existing Scripts

If you have an existing campaign script without the helper library:

### Option 1: Refactor to Use Helper (RECOMMENDED)

1. Import the library:
   ```javascript
   import { buildN8NPayload } from './lib/n8n-field-mapper.mjs';
   ```

2. Replace manual mapping with `buildN8NPayload()`

3. Test with 1 prospect before running full campaign

### Option 2: Add Manual Field Mapping

1. Follow the "Manual Mapping" section above
2. Add BOTH camelCase AND snake_case for ALL fields
3. Fetch templates from database
4. Include ALL 6 messages
5. Test with 1 prospect before running full campaign

---

## Production API Integration

The production API route should also use this pattern.

**File:** `/app/api/campaigns/linkedin/execute-via-n8n/route.ts`

**Current Status:** ✅ FIXED (manually updated, not using helper library yet)

**Future Migration:** Consider creating a TypeScript version of the helper library for API routes.

---

## Summary: The Golden Rules

1. ✅ **USE** `n8n-field-mapper.mjs` helper library
2. ✅ **ALWAYS** send BOTH camelCase AND snake_case
3. ✅ **ALWAYS** fetch templates from database
4. ✅ **ALWAYS** include all 6 messages (CR + 5 FU)
5. ✅ **ALWAYS** test with 1 prospect first
6. ✅ **ALWAYS** verify LinkedIn message looks correct
7. ❌ **NEVER** hardcode messages
8. ❌ **NEVER** send only camelCase fields
9. ❌ **NEVER** skip follow-up messages
10. ❌ **NEVER** run bulk campaigns without testing first

---

## References

- **Bug History:** `/Users/tvonlinz/Desktop/N8N_MESSAGE_BUGS_COMPLETE_FIX.md`
- **Audit Report:** `/Users/tvonlinz/Desktop/N8N_AUDIT_FIXES_APPLIED.md`
- **Helper Library:** `/scripts/lib/n8n-field-mapper.mjs`
- **N8N Workflow:** https://workflows.innovareai.com

---

**Last Updated:** 2025-11-18
**Status:** MANDATORY - All future campaign scripts MUST follow this guide
