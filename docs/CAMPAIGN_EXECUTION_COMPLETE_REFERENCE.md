# Campaign Execution - Complete Reference Guide

**Date Created:** November 19, 2025
**Purpose:** Prevent message errors, ensure correct account usage, and provide complete code for campaign execution

---

## Table of Contents
1. [Critical Rules](#critical-rules)
2. [Database Schema](#database-schema)
3. [Complete Working Scripts](#complete-working-scripts)
4. [Troubleshooting](#troubleshooting)
5. [N8N Workflow Reference](#n8n-workflow-reference)

---

## Critical Rules

### 🚨 NEVER SEND FAKE/PLACEHOLDER MESSAGES

**WRONG:**
```javascript
const message = "Hi Kalan, I'd love to connect!";  // NEVER DO THIS
```

**CORRECT:**
```javascript
// ALWAYS fetch from database
const campaignData = await fetchCampaignMessages(campaignId);
const message = campaignData.message_templates.connection_request;
```

### 🚨 ALWAYS USE CORRECT WORKSPACE ACCOUNT

**Workspaces:**
- IA1: `babdcab8-1a78-4b2f-913e-6e9fd9821009` (Thorsten Linz)
- IA4: `7f0341da-88db-476b-ae0a-fc0da5b70861` (Charissa Saniel - `4nt1J-blSnGUPBjH2Nfjpg`)

**Rule:** ALWAYS query the campaign's workspace_id and use the LinkedIn account from THAT workspace.

---

## Database Schema

### Campaigns Table
```sql
-- Key columns for campaign execution
campaigns:
  - id (uuid)
  - workspace_id (uuid) -- CRITICAL: determines which LinkedIn account to use
  - name (text)
  - connection_message (text) -- DEPRECATED, use message_templates instead
  - message_templates (jsonb) -- PRIMARY MESSAGE SOURCE
  - follow_up_messages (jsonb) -- DEPRECATED
  - flow_settings (jsonb)
```

### Message Templates Structure
```json
{
  "connection_request": "Hi {first_name}, \n\nI work with early-stage founders...",
  "alternative_message": "Hi {first_name}, great to connect...",
  "follow_up_messages": [
    "Follow-up 1 text",
    "Follow-up 2 text",
    "Follow-up 3 text",
    "Follow-up 4 text",
    "Goodbye message"
  ]
}
```

### Workspace Accounts Table
```sql
workspace_accounts:
  - id (uuid)
  - workspace_id (uuid)
  - account_type (text) -- 'linkedin', 'email', etc.
  - account_name (text)
  - account_identifier (text)
  - unipile_account_id (text) -- CRITICAL: used for sending messages
  - connection_status (text) -- must be 'connected'
```

### Campaign Prospects Table
```sql
campaign_prospects:
  - id (uuid) -- prospect_id
  - campaign_id (uuid)
  - first_name (text)
  - last_name (text)
  - linkedin_url (text)
  - company_name (text)
  - title (text)
  - status (text) -- 'pending', 'contacted', 'accepted', etc.
  - contacted_at (timestamp)
```

---

## Complete Working Scripts

### 1. Python Script: Get Campaign Data and Send CR

```python
#!/usr/bin/env python3
"""
Complete script to send connection request via N8N workflow
ALWAYS uses real campaign messages from database
"""
import requests
import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor

# Database connection
DB_CONFIG = {
    'host': 'db.latxadqrvrrrcvkktrog.supabase.co',
    'port': 5432,
    'user': 'postgres',
    'password': 'QFe75XZ2kqhy2AyH',
    'database': 'postgres'
}

# N8N Webhook URL
N8N_WEBHOOK_URL = 'https://workflows.innovareai.com/webhook/connector-campaign'

def get_campaign_prospect_data(campaign_id, prospect_first_name):
    """
    Fetch ALL required data for sending a connection request
    CRITICAL: Fetches real messages from message_templates
    """
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    query = """
    SELECT
        cp.id as prospect_id,
        cp.first_name,
        cp.last_name,
        cp.linkedin_url,
        cp.company_name,
        cp.title,
        c.id as campaign_id,
        c.workspace_id,
        c.name as campaign_name,
        c.message_templates,
        wa.unipile_account_id,
        wa.account_name as linkedin_account_name
    FROM campaign_prospects cp
    JOIN campaigns c ON cp.campaign_id = c.id
    JOIN workspace_accounts wa ON wa.workspace_id = c.workspace_id
        AND wa.account_type = 'linkedin'
        AND wa.connection_status = 'connected'
    WHERE cp.campaign_id = %s
        AND cp.first_name = %s
    LIMIT 1;
    """

    cur.execute(query, (campaign_id, prospect_first_name))
    result = cur.fetchone()

    cur.close()
    conn.close()

    if not result:
        raise ValueError(f"No prospect found: {prospect_first_name} in campaign {campaign_id}")

    # Validate message_templates exists
    if not result['message_templates']:
        raise ValueError(f"Campaign {campaign_id} has no message_templates!")

    message_templates = result['message_templates']

    if 'connection_request' not in message_templates:
        raise ValueError(f"Campaign {campaign_id} missing connection_request in message_templates!")

    return dict(result)

def send_connection_request(prospect_data):
    """
    Send connection request via N8N webhook
    Uses REAL message from database
    """
    # Get the connection request message
    cr_message = prospect_data['message_templates']['connection_request']

    # Replace placeholders
    cr_message = cr_message.replace('{first_name}', prospect_data['first_name'])
    cr_message = cr_message.replace('{company_name}', prospect_data['company_name'] or 'your company')

    # Build webhook payload
    payload = {
        'workspace_id': prospect_data['workspace_id'],
        'campaign_id': prospect_data['campaign_id'],
        'channel': 'linkedin',
        'campaign_type': 'connector',
        'unipile_account_id': prospect_data['unipile_account_id'],
        'prospects': [{
            'id': prospect_data['prospect_id'],
            'first_name': prospect_data['first_name'],
            'last_name': prospect_data['last_name'],
            'linkedin_url': prospect_data['linkedin_url'],
            'company_name': prospect_data['company_name'],
            'title': prospect_data['title'],
            'send_delay_minutes': 0
        }],
        'messages': {
            'connection_request': cr_message,
            'cr': cr_message  # N8N expects both keys
        },
        'supabase_url': os.environ.get('NEXT_PUBLIC_SUPABASE_URL'),
        'supabase_service_key': os.environ.get('SUPABASE_SERVICE_ROLE_KEY'),
        'unipile_dsn': os.environ.get('UNIPILE_DSN'),
        'unipile_api_key': os.environ.get('UNIPILE_API_KEY')
    }

    print(f"\n=== Sending CR for {prospect_data['first_name']} {prospect_data['last_name']} ===")
    print(f"Campaign: {prospect_data['campaign_name']}")
    print(f"LinkedIn Account: {prospect_data['linkedin_account_name']}")
    print(f"Unipile Account ID: {prospect_data['unipile_account_id']}")
    print(f"\nMessage Preview:")
    print(cr_message[:200] + "..." if len(cr_message) > 200 else cr_message)
    print("\nSending to N8N webhook...")

    response = requests.post(N8N_WEBHOOK_URL, json=payload)

    print(f"Response Status: {response.status_code}")
    print(f"Response: {response.text}")

    return response

# Example usage
if __name__ == '__main__':
    # Campaign: SAM Startup Canada (IA4 workspace - Charissa's account)
    campaign_id = '3326aa89-9220-4bef-a1db-9c54f14fc536'
    prospect_name = 'Kalan'

    try:
        # Fetch all data with REAL messages
        prospect_data = get_campaign_prospect_data(campaign_id, prospect_name)

        # Send CR via N8N
        response = send_connection_request(prospect_data)

        print("\n✅ Connection request sent successfully!")

    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        raise
```

### 2. Bash Script: Simple CR Sender

```bash
#!/bin/bash
# Simple bash script to send CR via N8N
# ALWAYS fetches real messages from database

CAMPAIGN_ID="3326aa89-9220-4bef-a1db-9c54f14fc536"
PROSPECT_NAME="Kalan"

# Fetch complete campaign data with REAL messages
DATA=$(PGPASSWORD='QFe75XZ2kqhy2AyH' psql \
  -h db.latxadqrvrrrcvkktrog.supabase.co \
  -p 5432 \
  -U postgres \
  -d postgres \
  -t \
  -c "
SELECT json_build_object(
  'prospect_id', cp.id,
  'first_name', cp.first_name,
  'last_name', cp.last_name,
  'linkedin_url', cp.linkedin_url,
  'company_name', cp.company_name,
  'title', cp.title,
  'campaign_id', c.id,
  'workspace_id', c.workspace_id,
  'unipile_account_id', wa.unipile_account_id,
  'connection_message', c.message_templates->>'connection_request'
)::text
FROM campaign_prospects cp
JOIN campaigns c ON cp.campaign_id = c.id
JOIN workspace_accounts wa ON wa.workspace_id = c.workspace_id
  AND wa.account_type = 'linkedin'
  AND wa.connection_status = 'connected'
WHERE cp.campaign_id = '$CAMPAIGN_ID'
  AND cp.first_name = '$PROSPECT_NAME'
LIMIT 1;
")

# Extract values
PROSPECT_ID=$(echo $DATA | jq -r '.prospect_id')
FIRST_NAME=$(echo $DATA | jq -r '.first_name')
LAST_NAME=$(echo $DATA | jq -r '.last_name')
LINKEDIN_URL=$(echo $DATA | jq -r '.linkedin_url')
COMPANY=$(echo $DATA | jq -r '.company_name')
TITLE=$(echo $DATA | jq -r '.title')
WORKSPACE_ID=$(echo $DATA | jq -r '.workspace_id')
UNIPILE_ACCOUNT=$(echo $DATA | jq -r '.unipile_account_id')
MESSAGE=$(echo $DATA | jq -r '.connection_message')

# Replace placeholders in message
MESSAGE=$(echo $MESSAGE | sed "s/{first_name}/$FIRST_NAME/g")
MESSAGE=$(echo $MESSAGE | sed "s/{company_name}/${COMPANY:-your company}/g")

echo "Sending CR for: $FIRST_NAME $LAST_NAME"
echo "LinkedIn: $LINKEDIN_URL"
echo "Account: $UNIPILE_ACCOUNT"
echo ""
echo "Message:"
echo "$MESSAGE"
echo ""

# Send to N8N
curl -X POST https://workflows.innovareai.com/webhook/connector-campaign \
  -H "Content-Type: application/json" \
  -d "{
    \"workspace_id\": \"$WORKSPACE_ID\",
    \"campaign_id\": \"$CAMPAIGN_ID\",
    \"channel\": \"linkedin\",
    \"campaign_type\": \"connector\",
    \"unipile_account_id\": \"$UNIPILE_ACCOUNT\",
    \"prospects\": [{
      \"id\": \"$PROSPECT_ID\",
      \"first_name\": \"$FIRST_NAME\",
      \"last_name\": \"$LAST_NAME\",
      \"linkedin_url\": \"$LINKEDIN_URL\",
      \"company_name\": \"$COMPANY\",
      \"title\": \"$TITLE\",
      \"send_delay_minutes\": 0
    }],
    \"messages\": {
      \"connection_request\": \"$MESSAGE\",
      \"cr\": \"$MESSAGE\"
    },
    \"supabase_url\": \"$NEXT_PUBLIC_SUPABASE_URL\",
    \"supabase_service_key\": \"$SUPABASE_SERVICE_ROLE_KEY\",
    \"unipile_dsn\": \"$UNIPILE_DSN\",
    \"unipile_api_key\": \"$UNIPILE_API_KEY\"
  }"
```

### 3. Node.js/TypeScript Script: Production-Ready

```typescript
#!/usr/bin/env node
/**
 * Production-ready script to send connection requests
 * Features:
 * - ALWAYS fetches real messages from database
 * - Validates all required fields
 * - Proper error handling
 * - Logs all actions
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ProspectData {
  prospect_id: string;
  first_name: string;
  last_name: string;
  linkedin_url: string;
  company_name: string | null;
  title: string | null;
  campaign_id: string;
  workspace_id: string;
  campaign_name: string;
  message_templates: {
    connection_request: string;
    alternative_message?: string;
    follow_up_messages?: string[];
  };
  unipile_account_id: string;
  linkedin_account_name: string;
}

async function getCampaignProspectData(
  campaignId: string,
  prospectFirstName: string
): Promise<ProspectData> {
  const { data, error } = await supabase
    .from('campaign_prospects')
    .select(`
      id,
      first_name,
      last_name,
      linkedin_url,
      company_name,
      title,
      campaigns!inner (
        id,
        workspace_id,
        name,
        message_templates
      )
    `)
    .eq('campaign_id', campaignId)
    .eq('first_name', prospectFirstName)
    .single();

  if (error || !data) {
    throw new Error(`Prospect not found: ${prospectFirstName} in campaign ${campaignId}`);
  }

  // Get LinkedIn account for this workspace
  const { data: account, error: accountError } = await supabase
    .from('workspace_accounts')
    .select('unipile_account_id, account_name')
    .eq('workspace_id', data.campaigns.workspace_id)
    .eq('account_type', 'linkedin')
    .eq('connection_status', 'connected')
    .single();

  if (accountError || !account) {
    throw new Error(`No connected LinkedIn account for workspace ${data.campaigns.workspace_id}`);
  }

  // Validate message_templates
  if (!data.campaigns.message_templates) {
    throw new Error(`Campaign ${campaignId} has no message_templates!`);
  }

  const templates = data.campaigns.message_templates as any;

  if (!templates.connection_request) {
    throw new Error(`Campaign ${campaignId} missing connection_request in message_templates!`);
  }

  return {
    prospect_id: data.id,
    first_name: data.first_name,
    last_name: data.last_name,
    linkedin_url: data.linkedin_url,
    company_name: data.company_name,
    title: data.title,
    campaign_id: data.campaigns.id,
    workspace_id: data.campaigns.workspace_id,
    campaign_name: data.campaigns.name,
    message_templates: templates,
    unipile_account_id: account.unipile_account_id,
    linkedin_account_name: account.account_name
  };
}

function replacePlaceholders(message: string, data: ProspectData): string {
  return message
    .replace(/{first_name}/g, data.first_name)
    .replace(/{last_name}/g, data.last_name)
    .replace(/{company_name}/g, data.company_name || 'your company')
    .replace(/{title}/g, data.title || 'your role');
}

async function sendConnectionRequest(prospectData: ProspectData) {
  // Get connection request message
  let crMessage = prospectData.message_templates.connection_request;

  // Replace placeholders
  crMessage = replacePlaceholders(crMessage, prospectData);

  // Build webhook payload
  const payload = {
    workspace_id: prospectData.workspace_id,
    campaign_id: prospectData.campaign_id,
    channel: 'linkedin',
    campaign_type: 'connector',
    unipile_account_id: prospectData.unipile_account_id,
    prospects: [{
      id: prospectData.prospect_id,
      first_name: prospectData.first_name,
      last_name: prospectData.last_name,
      linkedin_url: prospectData.linkedin_url,
      company_name: prospectData.company_name,
      title: prospectData.title,
      send_delay_minutes: 0
    }],
    messages: {
      connection_request: crMessage,
      cr: crMessage
    },
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    unipile_dsn: process.env.UNIPILE_DSN,
    unipile_api_key: process.env.UNIPILE_API_KEY
  };

  console.log(`\n=== Sending CR for ${prospectData.first_name} ${prospectData.last_name} ===`);
  console.log(`Campaign: ${prospectData.campaign_name}`);
  console.log(`LinkedIn Account: ${prospectData.linkedin_account_name}`);
  console.log(`Unipile Account ID: ${prospectData.unipile_account_id}`);
  console.log(`\nMessage Preview:`);
  console.log(crMessage.substring(0, 200) + (crMessage.length > 200 ? '...' : ''));
  console.log('\nSending to N8N webhook...');

  const response = await fetch('https://workflows.innovareai.com/webhook/connector-campaign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  console.log(`Response Status: ${response.status}`);
  const result = await response.text();
  console.log(`Response: ${result}`);

  return response;
}

// Main execution
async function main() {
  const campaignId = '3326aa89-9220-4bef-a1db-9c54f14fc536'; // SAM Startup Canada
  const prospectName = 'Kalan';

  try {
    // Fetch all data with REAL messages
    const prospectData = await getCampaignProspectData(campaignId, prospectName);

    // Send CR via N8N
    await sendConnectionRequest(prospectData);

    console.log('\n✅ Connection request sent successfully!');
  } catch (error) {
    console.error('\n❌ ERROR:', error);
    process.exit(1);
  }
}

main();
```

---

## Troubleshooting

### Issue: Wrong Message Sent

**Symptom:** Message doesn't match campaign template
**Cause:** Used hardcoded/placeholder message instead of database value
**Fix:** ALWAYS fetch from `campaigns.message_templates->>'connection_request'`

```sql
-- Verify campaign messages
SELECT
  c.name,
  c.message_templates->>'connection_request' as cr_message,
  jsonb_array_length(c.message_templates->'follow_up_messages') as fu_count
FROM campaigns c
WHERE c.id = '3326aa89-9220-4bef-a1db-9c54f14fc536';
```

### Issue: Wrong LinkedIn Account Used

**Symptom:** Message sent from wrong LinkedIn account
**Cause:** Used wrong workspace's LinkedIn account
**Fix:** ALWAYS join via campaign.workspace_id

```sql
-- Get correct account for campaign
SELECT
  c.name as campaign_name,
  w.name as workspace_name,
  wa.account_name,
  wa.unipile_account_id
FROM campaigns c
JOIN workspaces w ON c.workspace_id = w.id
JOIN workspace_accounts wa ON wa.workspace_id = c.workspace_id
WHERE c.id = '3326aa89-9220-4bef-a1db-9c54f14fc536'
  AND wa.account_type = 'linkedin'
  AND wa.connection_status = 'connected';
```

### Issue: Prospect Not Found

**Symptom:** Query returns no rows
**Cause:** Prospect not in campaign, or wrong campaign ID
**Fix:** List all prospects in campaign

```sql
-- List all prospects in campaign
SELECT
  first_name,
  last_name,
  status,
  contacted_at
FROM campaign_prospects
WHERE campaign_id = '3326aa89-9220-4bef-a1db-9c54f14fc536'
ORDER BY first_name;
```

---

## N8N Workflow Reference

### Workflow ID
`aVG6LC4ZFRMN7Bw6` (SAM Master Campaign Orchestrator)

### Webhook URLs
- **Connector Campaigns:** `https://workflows.innovareai.com/webhook/connector-campaign`
- **Messenger Campaigns:** `https://workflows.innovareai.com/webhook/messenger-campaign`

### Workflow Features

1. **24-Hour Acceptance Check Loop**
   - Node: "Wait 1 Hour" (NOW: 1 day / 24 hours)
   - Node: "Check Connection Accepted" (Unipile API call)
   - Node: "Should Retry Check?" (decision)
   - Node: "Loop Back to Wait" (restart cycle)
   - **Update:** Changed from 1 hour to 1 day on November 19, 2025

2. **Follow-Up Sequence**
   - Wait 4 hours after acceptance
   - Send Follow-up 1 (FU1)
   - Check for reply before each FU
   - Send FU2, FU3, FU4 with configurable delays
   - Send goodbye message if no engagement

3. **Reply Detection**
   - Before each follow-up, checks for replies
   - If reply received, marks prospect and exits flow
   - Prevents spam if prospect already engaged

### Timing Configuration

Default timings (configured per campaign):
- **Connection check interval:** 24 hours (1 day) - Updated Nov 19, 2025
- **Wait after acceptance:** 4 hours (240 minutes)
- **FU1 delay:** Configurable (fu1_delay_days)
- **FU2 delay:** Configurable (fu2_delay_days)
- **FU3 delay:** Configurable (fu3_delay_days)
- **FU4 delay:** Configurable (fu4_delay_days)
- **Goodbye delay:** Configurable (gb_delay_days)

---

## Quick Reference SQL Queries

### Get Campaign Full Data
```sql
SELECT
  c.id,
  c.name,
  c.workspace_id,
  w.name as workspace_name,
  c.message_templates,
  wa.account_name as linkedin_account,
  wa.unipile_account_id,
  COUNT(cp.id) as total_prospects,
  COUNT(cp.id) FILTER (WHERE cp.status = 'pending') as pending_prospects
FROM campaigns c
JOIN workspaces w ON c.workspace_id = w.id
LEFT JOIN workspace_accounts wa ON wa.workspace_id = c.workspace_id
  AND wa.account_type = 'linkedin'
  AND wa.connection_status = 'connected'
LEFT JOIN campaign_prospects cp ON cp.campaign_id = c.id
WHERE c.id = 'YOUR_CAMPAIGN_ID'
GROUP BY c.id, w.name, wa.account_name, wa.unipile_account_id;
```

### List All Workspaces and Accounts
```sql
SELECT
  w.id,
  w.name as workspace_name,
  wa.account_name,
  wa.account_type,
  wa.unipile_account_id,
  wa.connection_status
FROM workspaces w
LEFT JOIN workspace_accounts wa ON wa.workspace_id = w.id
ORDER BY w.name, wa.account_type;
```

### Check Recent N8N Executions (Python)
```python
import requests, os

headers = {'X-N8N-API-KEY': os.environ['N8N_API_KEY']}
r = requests.get('https://workflows.innovareai.com/api/v1/executions?limit=5&includeData=true', headers=headers)
executions = r.json()

for ex in executions['data']:
    print(f"Execution {ex['id']}: {ex['status']} at {ex.get('startedAt')}")
```

---

## Final Checklist Before Sending

Before executing ANY campaign action:

- [ ] Verified campaign exists in database
- [ ] Confirmed workspace_id is correct
- [ ] Retrieved LinkedIn account from campaign's workspace
- [ ] Fetched `message_templates->>'connection_request'` from database
- [ ] Replaced placeholders: `{first_name}`, `{company_name}`
- [ ] Validated Unipile account ID is correct
- [ ] Confirmed prospect exists and status is 'pending'
- [ ] Tested webhook payload structure

**NEVER:**
- [ ] Use hardcoded messages
- [ ] Use placeholder text like "Hi {{name}}, test!"
- [ ] Copy/paste Unipile IDs from other workspaces
- [ ] Skip message template validation

---

**Document Version:** 1.0
**Last Updated:** November 19, 2025
**Maintainer:** Development Team
