#!/usr/bin/env node

/**
 * Test BrightData Enrichment - Debug Script
 *
 * Calls the enrichment API directly and shows detailed error logs
 */

const WORKSPACE_ID = 'b9ad0c85-c30b-4c29-a58c-2ca7e3aeb41c'; // InnovareAI workspace
const API_URL = 'https://app.meet-sam.com';

// Sample LinkedIn URL from your campaign
const SAMPLE_LINKEDIN_URL = 'https://www.linkedin.com/in/sample-profile';

async function testEnrichment() {
  console.log('🧪 Testing BrightData Enrichment API...\n');

  try {
    // Call the enrichment API
    const response = await fetch(`${API_URL}/api/prospects/enrich`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        linkedInUrls: [SAMPLE_LINKEDIN_URL],
        workspaceId: WORKSPACE_ID,
        autoEnrich: true
      })
    });

    console.log(`📥 Response Status: ${response.status} ${response.statusText}\n`);

    const data = await response.json();

    console.log('📦 Response Data:');
    console.log(JSON.stringify(data, null, 2));
    console.log('\n');

    if (!data.success) {
      console.error('❌ Enrichment Failed!');
      console.error('Error:', data.error);
      console.error('Details:', data.details);
    } else {
      console.log('✅ Enrichment Successful!');
      console.log(`Enriched: ${data.enriched_count}`);
      console.log(`Failed: ${data.failed_count}`);
      console.log(`Skipped: ${data.skipped_count}`);
    }

  } catch (error) {
    console.error('❌ Test Error:', error.message);
    console.error(error.stack);
  }
}

testEnrichment();
