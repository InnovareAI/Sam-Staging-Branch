// Check ReachInbox campaigns

const API_KEY = '21839670-cb8a-478c-8c07-a502c52c0405';

async function check() {
  console.log('Fetching ReachInbox campaigns...\n');

  try {
    const response = await fetch('https://api.reachinbox.ai/api/v1/campaigns', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log('Error:', response.status, response.statusText);
      const text = await response.text();
      console.log('Response:', text);
      return;
    }

    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2).substring(0, 3000));

    if (data.data && Array.isArray(data.data)) {
      console.log('\n=== CAMPAIGNS ===');
      for (const campaign of data.data) {
        console.log(`\n${campaign.name || campaign.id}`);
        console.log(`  ID: ${campaign.id}`);
        console.log(`  Status: ${campaign.status}`);
        console.log(`  Leads: ${campaign.leadsCount || campaign.leads_count || 'N/A'}`);
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

check();
