import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testDirectSearch() {
  const userId = 'f6885ff3-deef-4781-8721-93011c990b1b';
  const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

  console.log('\n🔍 Testing Direct LinkedIn Search Flow\n');

  // Get LinkedIn account
  const { data: linkedinAccount, error: accountError } = await supabase
    .from('user_unipile_accounts')
    .select('unipile_account_id, platform')
    .eq('user_id', userId)
    .eq('platform', 'LINKEDIN')
    .single();

  if (accountError || !linkedinAccount) {
    console.error('❌ No LinkedIn account found');
    return;
  }

  console.log('✅ LinkedIn Account:', linkedinAccount.unipile_account_id);

  // Auto-detect capabilities
  const unipileDSN = process.env.UNIPILE_DSN!;
  const accountUrl = unipileDSN.includes('.')
    ? `https://${unipileDSN}/api/v1/accounts/${linkedinAccount.unipile_account_id}`
    : `https://${unipileDSN}.unipile.com:13443/api/v1/accounts/${linkedinAccount.unipile_account_id}`;

  console.log('\n🔍 Checking capabilities...');
  const accountInfoResponse = await fetch(accountUrl, {
    headers: {
      'X-API-KEY': process.env.UNIPILE_API_KEY!,
      'Accept': 'application/json'
    }
  });

  let api = 'classic';
  if (accountInfoResponse.ok) {
    const accountInfo = await accountInfoResponse.json();
    const premiumFeatures = accountInfo.connection_params?.im?.premiumFeatures || [];
    console.log('Premium Features:', premiumFeatures);

    if (premiumFeatures.includes('recruiter')) {
      api = 'recruiter';
    } else if (premiumFeatures.includes('sales_navigator')) {
      api = 'sales_navigator';
    }
  }

  console.log(`✅ Using API: ${api}\n`);

  // Prepare search payload
  const unipileUrl = unipileDSN.includes('.')
    ? `https://${unipileDSN}/api/v1/linkedin/search`
    : `https://${unipileDSN}.unipile.com:13443/api/v1/linkedin/search`;

  const maxLimit = (api === 'sales_navigator' || api === 'recruiter') ? 100 : 50;

  const params = new URLSearchParams({
    account_id: linkedinAccount.unipile_account_id,
    limit: String(Math.min(20, maxLimit))
  });

  const unipilePayload = {
    api: api,
    category: 'people',
    keywords: 'CEO tech startups'
  };

  console.log('🌐 Calling Unipile API...');
  console.log('URL:', `${unipileUrl}?${params}`);
  console.log('Payload:', JSON.stringify(unipilePayload, null, 2));

  const response = await fetch(`${unipileUrl}?${params}`, {
    method: 'POST',
    headers: {
      'X-API-KEY': process.env.UNIPILE_API_KEY!,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(unipilePayload)
  });

  if (!response.ok) {
    console.error('❌ Unipile API error:', response.status, response.statusText);
    const errorText = await response.text();
    console.error('Error body:', errorText);
    return;
  }

  const data = await response.json();
  console.log(`\n✅ Unipile Response: ${data.items?.length || 0} items\n`);

  if (data.items && data.items.length > 0) {
    console.log('First item raw:', JSON.stringify(data.items[0], null, 2));
  }

  // Map prospects
  const prospects = (data.items || []).map((item: any, index: number) => {
    let firstName = item.first_name || 'Unknown';
    let lastName = item.last_name || 'Unknown';

    if (!item.first_name && item.name) {
      const nameParts = item.name.trim().split(' ');
      firstName = nameParts[0] || 'Unknown';
      lastName = nameParts.slice(1).join(' ') || 'Unknown';
    }

    let title = item.headline || '';
    if (item.current_positions && item.current_positions.length > 0) {
      title = item.current_positions[0].role || item.headline || '';
    }

    let company = '';
    if (item.current_positions && item.current_positions.length > 0) {
      company = item.current_positions[0].company || '';
    }

    const linkedinUrl = item.profile_url || item.public_profile_url || '';

    const prospect = {
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      title,
      company,
      linkedinUrl
    };

    if (index === 0) {
      console.log('\n📦 First mapped prospect:', JSON.stringify(prospect, null, 2));
    }

    return prospect;
  });

  console.log(`\n✅ Mapped ${prospects.length} prospects`);

  // Filter valid prospects
  const validProspects = prospects.filter((p: any) => p.linkedinUrl);
  console.log(`✅ Valid prospects with LinkedIn URLs: ${validProspects.length}/${prospects.length}\n`);

  if (validProspects.length > 0) {
    const toInsert = validProspects.map((p: any) => ({
      workspace_id: workspaceId,
      first_name: p.firstName,
      last_name: p.lastName,
      job_title: p.title || null,
      company_name: p.company || null,
      linkedin_profile_url: p.linkedinUrl
    }));

    console.log('💾 Inserting to database...');
    console.log('First row to insert:', JSON.stringify(toInsert[0], null, 2));

    const { data: inserted, error: insertError } = await supabase
      .from('workspace_prospects')
      .insert(toInsert)
      .select();

    if (insertError) {
      console.error('\n❌ INSERT FAILED:', insertError);
      console.error('Error details:', JSON.stringify(insertError, null, 2));
    } else {
      console.log(`\n✅ INSERT SUCCESSFUL! Inserted ${inserted?.length || 0} prospects\n`);
      if (inserted && inserted.length > 0) {
        console.log('First inserted row:', JSON.stringify(inserted[0], null, 2));
      }
    }
  }

  // Check database
  const { data: checkProspects, error: checkError } = await supabase
    .from('workspace_prospects')
    .select('id, first_name, last_name, job_title, company_name')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (checkError) {
    console.error('\n❌ Check failed:', checkError);
  } else {
    console.log(`\n📊 Latest prospects in database (workspace ${workspaceId}):`);
    console.log(JSON.stringify(checkProspects, null, 2));
  }
}

testDirectSearch();
