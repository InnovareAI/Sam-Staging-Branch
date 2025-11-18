#!/usr/bin/env node

/**
 * Test N8N webhook payload - minimal test to see what N8N receives
 */

const payload = {
  workspaceId: "7f0341da-88db-476b-ae0a-fc0da5b70861",
  campaignId: "683f9214-8a3f-4015-98fe-aa3ae76a9ebe",
  unipileAccountId: "4nt1J-blSnGUPBjH2Nfjpg",
  unipile_account_id: "4nt1J-blSnGUPBjH2Nfjpg",
  channel: "linkedin",
  campaignType: "connector",

  prospects: [
    {
      id: "test-123",
      first_name: "Test",
      last_name: "User",
      linkedin_url: "https://linkedin.com/in/testuser",
      send_delay_minutes: 5
    }
  ],

  messages: {
    connection_request: "Hi {first_name}, test message"
  }
};

console.log('Sending minimal test payload to N8N...\n');
console.log('Payload:', JSON.stringify(payload, null, 2));
console.log('\n---\n');

const response = await fetch('https://workflows.innovareai.com/webhook/connector-campaign', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});

const responseText = await response.text();
console.log('Response status:', response.status);
console.log('Response body:', responseText);
