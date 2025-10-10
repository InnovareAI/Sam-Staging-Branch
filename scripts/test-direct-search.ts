/**
 * Test Direct Search Endpoint
 */

const testSearch = async () => {
  console.log('🧪 Testing direct search endpoint...\n');

  const payload = {
    search_criteria: {
      title: 'CEO',
      keywords: 'tech startups',
      location: 'United States'
    },
    target_count: 20,
    save_to_approval: true
  };

  console.log('📤 Request payload:', JSON.stringify(payload, null, 2));

  try {
    const response = await fetch('https://app.meet-sam.com/api/linkedin/search/direct', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Cookie will be missing - will get 401, but we can see if URL construction works
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    console.log('\n📥 Response status:', response.status);
    console.log('📥 Response data:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error('\n❌ Error occurred');
      if (data.debug) {
        console.log('🔍 Debug info:', JSON.stringify(data.debug, null, 2));
      }
    }
  } catch (error) {
    console.error('\n❌ Fetch error:', error);
  }
};

testSearch();
