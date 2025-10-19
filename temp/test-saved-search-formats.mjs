const UNIPILE_API_KEY = 'aQzsD1+H.EJ60hU0LkPAxRaCU6nlvk3ypn9Rn9BUwqo9LGY24zZU=';
const UNIPILE_DSN = 'api6.unipile.com:13670';
const ACCOUNT_ID = 'mERQmojtSZq5GeomZZazlw';
const SAVED_SEARCH_ID = '22040586';

async function testSearchFormats() {
  const searchUrl = `https://${UNIPILE_DSN}/api/v1/linkedin/search`;

  // Test different payload formats
  const testCases = [
    {
      name: 'Full URL in url field',
      payload: {
        url: `https://www.linkedin.com/sales/search/people?savedSearchId=${SAVED_SEARCH_ID}`
      }
    },
    {
      name: 'savedSearchId as parameter',
      payload: {
        savedSearchId: SAVED_SEARCH_ID
      }
    },
    {
      name: 'saved_search_id as parameter',
      payload: {
        saved_search_id: SAVED_SEARCH_ID
      }
    },
    {
      name: 'URL without https',
      payload: {
        url: `/sales/search/people?savedSearchId=${SAVED_SEARCH_ID}`
      }
    },
    {
      name: 'Search URL as query parameter',
      useQueryParam: true,
      payload: {}
    }
  ];

  for (const test of testCases) {
    console.log(`\n🧪 Testing: ${test.name}`);
    console.log(`───────────────────────────────────────────────────────────`);

    const params = new URLSearchParams({
      account_id: ACCOUNT_ID,
      limit: '10'
    });

    if (test.useQueryParam) {
      params.append('url', `https://www.linkedin.com/sales/search/people?savedSearchId=${SAVED_SEARCH_ID}`);
    }

    console.log(`URL: ${searchUrl}?${params}`);
    console.log(`Payload: ${JSON.stringify(test.payload, null, 2)}`);

    try {
      const response = await fetch(`${searchUrl}?${params}`, {
        method: 'POST',
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(test.payload)
      });

      console.log(`Status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`❌ Error: ${errorText.substring(0, 200)}...`);
      } else {
        const result = await response.json();
        const count = result.items?.length || 0;
        console.log(`✅ SUCCESS! Retrieved ${count} prospects`);
        console.log(`Has cursor: ${result.cursor ? 'Yes' : 'No'}`);
        if (count > 0) {
          console.log(`\nFirst prospect: ${result.items[0].name || result.items[0].first_name + ' ' + result.items[0].last_name}`);
        }
        return; // Stop on first success
      }
    } catch (error) {
      console.log(`❌ Exception: ${error.message}`);
    }
  }

  console.log(`\n❌ All test cases failed.`);
}

testSearchFormats();
