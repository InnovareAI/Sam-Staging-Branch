#!/usr/bin/env node

/**
 * Test script to execute campaign for Ibrahim Otun
 * Campaign: 20251116-IA1-LA Marketing CR Test 3
 */

const campaignId = '7f06d1fa-b9e8-4e3f-9161-196544ffba79';
const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
const prospectId = 'a86304d4-43ba-4978-94f0-5f36eefc071e';
const linkedinAccountId = 'ed8bebf6-5b59-47d6-803e-eb015cfb138b';
const unipileAccountId = 'mERQmojtSZq5GeomZZazlw';

// N8N webhook URL
const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || 'https://workflows.innovareai.com/webhook/campaign-execute';

// Prospect data
const prospectData = {
  id: prospectId,
  prospect_id: prospectId,
  campaign_id: campaignId,
  first_name: 'Ibrahim',
  last_name: 'Otun',
  company_name: 'McKinsey & Company',
  title: 'Director, Office Technology Experience',
  linkedin_url: 'https://www.linkedin.com/in/ibrahimotun',
  linkedin_user_id: 'ibrahimotun',
  send_delay_minutes: 0
};

// Campaign message
const connectionMessage = "Hi {first_name}, I noticed your role leading office technology at McKinsey. As someone working with enterprise tech leaders on digital workspace optimization, I'd love to connect and share insights about emerging tech solutions. Would you be open to connecting?";

// Build N8N payload
const n8nPayload = {
  workspace_id: workspaceId,
  campaign_id: campaignId,
  channel: 'linkedin',
  campaign_type: 'connector',
  unipile_dsn: 'https://api6.unipile.com:13670',
  unipile_api_key: process.env.UNIPILE_API_KEY,
  unipile_account_id: unipileAccountId,
  supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  prospects: [prospectData],
  messages: {
    connection_request: connectionMessage,
    cr: connectionMessage
  },
  timing: {
    fu1_delay_days: 2,
    fu2_delay_days: 5,
    fu3_delay_days: 7,
    fu4_delay_days: 5,
    gb_delay_days: 7
  }
};

console.log('=== EXECUTING CAMPAIGN FOR IBRAHIM OTUN ===');
console.log('Campaign ID:', campaignId);
console.log('Prospect ID:', prospectId);
console.log('LinkedIn Account:', unipileAccountId);
console.log('Campaign Type: connector (CR first)');
console.log('\nConnection Request Message:');
console.log(connectionMessage);
console.log('\n=== SENDING TO N8N ===');

fetch(n8nWebhookUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(n8nPayload)
})
  .then(async (response) => {
    const text = await response.text();
    console.log('\nN8N Response Status:', response.status);
    console.log('N8N Response:', text);

    if (response.ok) {
      console.log('\n✅ Campaign execution started successfully!');
      console.log('\nNext steps:');
      console.log('1. Check N8N workflow: https://workflows.innovareai.com');
      console.log('2. Monitor prospect status in database');
      console.log('3. Verify CR sent on LinkedIn');
    } else {
      console.error('\n❌ Campaign execution failed');
    }
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
  });
