#!/usr/bin/env node

const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const ACCOUNT_ID = '4Vv6oZ73RvarImDN6iYbbg'; // Stan's account

async function testLinkedInSearch() {
  try {
    const searchUrl = `https://${UNIPILE_DSN}/api/v1/linkedin/search`;
    const params = new URLSearchParams({
      account_id: ACCOUNT_ID,
      limit: '3'
    });

    const searchPayload = {
      url: 'https://www.linkedin.com/search/results/people/?keywords=Candy%20Alexander'
    };

    console.log('Testing LinkedIn search endpoint...');
    console.log(`URL: ${searchUrl}?${params}\n`);

    const response = await fetch(`${searchUrl}?${params}`, {
      method: 'POST',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(searchPayload)
    });

    console.log(`Response: ${response.status} ${response.statusText}\n`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error:', errorText);
      return;
    }

    const data = await response.json();
    const items = data.items || [];

    console.log(`Found ${items.length} results\n`);

    items.forEach((item, i) => {
      console.log(`Result ${i + 1}:`);
      console.log('  Name:', item.first_name, item.last_name || item.name);
      console.log('  Headline:', item.headline);
      console.log('  Current positions:', item.current_positions);
      if (item.current_positions && item.current_positions[0]) {
        console.log('    Role:', item.current_positions[0].role);
        console.log('    Company:', item.current_positions[0].company);
      }
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testLinkedInSearch();
