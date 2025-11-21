/**
 * Check Inngest Run Status
 *
 * Query the Inngest API to get the status of a specific run.
 */

const RUN_ID = '01KAKKVZC92WKMKKT05YWBD35N';

// Try to fetch run details from Inngest
// Note: Inngest may not have a public API for this, so we'll try different approaches

console.log(`🔍 Checking Inngest run: ${RUN_ID}\n`);

// Approach 1: Try to fetch from Inngest dashboard API (may require authentication)
try {
  const response = await fetch(`https://api.inngest.com/v1/runs/${RUN_ID}`, {
    headers: {
      'Authorization': `Bearer ${process.env.INNGEST_EVENT_KEY}`
    }
  });

  if (response.ok) {
    const data = await response.json();
    console.log('✅ Run details:', JSON.stringify(data, null, 2));
  } else {
    console.log(`❌ API Error: ${response.status} ${response.statusText}`);
    console.log('Response:', await response.text());
  }
} catch (error) {
  console.error('❌ Failed to fetch run details:', error.message);
}

console.log('\n📊 Alternative: Check the dashboard manually at:');
console.log(`https://app.inngest.com/env/production/runs/${RUN_ID}`);
