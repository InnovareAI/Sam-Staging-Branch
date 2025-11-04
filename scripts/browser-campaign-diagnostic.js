// BROWSER DIAGNOSTIC SCRIPT
// Copy and paste this into your browser console on app.meet-sam.com

(async () => {
  console.log('🔍 CAMPAIGN DIAGNOSTIC STARTING...\n');

  // Check 1: Current workspace
  const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'; // Your InnovareAI workspace
  console.log('✅ Workspace ID:', workspaceId);

  // Check 2: Fetch campaigns via API
  console.log('\n📡 Fetching campaigns from API...');
  try {
    const response = await fetch(`/api/campaigns?workspace_id=${workspaceId}`);
    console.log('Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      return;
    }

    const data = await response.json();
    console.log('\n✅ API Response:', data);
    console.log(`\n📊 Campaigns found: ${data.campaigns?.length || 0}`);

    if (data.campaigns && data.campaigns.length > 0) {
      console.log('\nCampaigns:');
      data.campaigns.forEach((c, i) => {
        console.log(`${i + 1}. ${c.name}`);
        console.log(`   Status: ${c.status}`);
        console.log(`   Type: ${c.type || c.campaign_type}`);
        console.log(`   Prospects: ${c.prospects || 0}`);
        console.log('');
      });
    } else {
      console.warn('⚠️ No campaigns returned by API');
    }
  } catch (error) {
    console.error('❌ Fetch error:', error);
  }

  // Check 3: Check if Campaign Hub is mounted
  console.log('\n🔍 Checking Campaign Hub UI...');
  const campaignElements = document.querySelectorAll('[class*="campaign" i], [id*="campaign" i]');
  console.log(`Found ${campaignElements.length} campaign-related elements in DOM`);

  // Check 4: Look for React Query cache
  console.log('\n🔍 Checking React Query cache...');
  try {
    const queryClient = window.__REACT_QUERY_DEV_TOOLS__?.client || window.queryClient;
    if (queryClient) {
      const cache = queryClient.getQueryCache();
      const queries = cache.getAll();
      const campaignQueries = queries.filter(q => q.queryKey[0] === 'campaigns');
      console.log(`React Query campaign queries: ${campaignQueries.length}`);
      campaignQueries.forEach(q => {
        console.log('- Query:', q.queryKey);
        console.log('  State:', q.state.status);
        console.log('  Data:', q.state.data?.length || 0, 'campaigns');
      });
    } else {
      console.log('React Query client not found in window');
    }
  } catch (e) {
    console.log('Could not access React Query cache:', e.message);
  }

  console.log('\n✅ DIAGNOSTIC COMPLETE');
})();
