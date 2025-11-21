/**
 * Trigger Campaign via API
 *
 * This calls the execute-inngest API endpoint which properly prepares
 * all campaign data before triggering Inngest.
 */

const CAMPAIGN_ID = '5bb3ac9c-eac3-475b-b2a5-5f939edace34'; // Charissa's campaign
const WORKSPACE_ID = '7f0341da-88db-476b-ae0a-fc0da5b70861'; // IA4

console.log('📤 Triggering campaign via API for Charissa (IA4)...');
console.log('   Campaign ID:', CAMPAIGN_ID);

const response = await fetch('https://app.meet-sam.com/api/campaigns/linkedin/execute-inngest', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    campaignId: CAMPAIGN_ID,
    workspaceId: WORKSPACE_ID
  })
});

const result = await response.json();

if (response.ok) {
  console.log('✅ Campaign triggered successfully:');
  console.log('   Message:', result.message);
  console.log('   Prospects queued:', result.prospects_queued);
  console.log('   Campaign type:', result.campaign_type);
  console.log('   Execution engine:', result.execution_engine);
  console.log('\n📊 Check Inngest dashboard for execution:');
  console.log('   https://app.inngest.com/env/production/runs');
} else {
  console.error('❌ Failed to trigger campaign:');
  console.error('   Error:', result.error);
  console.error('   Details:', result.details || result.message);
}
