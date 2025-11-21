#!/usr/bin/env node
/**
 * Cancel ALL running Inngest campaigns using REST API
 * Based on: https://www.inngest.com/docs/guides/cancel-running-functions
 */

const INNGEST_SIGNING_KEY = process.env.INNGEST_SIGNING_KEY;

if (!INNGEST_SIGNING_KEY) {
  console.error('❌ INNGEST_SIGNING_KEY not set');
  process.exit(1);
}

console.log('🛑 CANCELING ALL RUNNING INNGEST CAMPAIGNS...\n');

// Cancel all connector campaigns started in last 24 hours
const response = await fetch('https://api.inngest.com/v1/cancellations', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${INNGEST_SIGNING_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    app_id: 'sam-ai',
    function_id: 'connector-campaign',
    started_after: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    started_before: new Date().toISOString()
  })
});

if (!response.ok) {
  const error = await response.text();
  console.error('❌ Cancellation failed:', error);
  process.exit(1);
}

const result = await response.json();
console.log('✅ Cancellation initiated:', result);
console.log('\n📊 Check status at: https://app.inngest.com/env/production/runs');
