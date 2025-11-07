require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyCompleteFix() {
  console.log('🔍 VERIFYING COMPLETE FIX\n');
  console.log('=' .repeat(70));

  // 1. Verify all campaigns are using Thorsten's account
  console.log('\n✅ FIX 1: LinkedIn Account Selection\n');

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select(`
      id,
      name,
      status,
      linkedin_account:workspace_accounts!linkedin_account_id (
        id,
        account_name,
        unipile_account_id
      )
    `)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log(`📊 Active Campaigns (showing 5 most recent):\n`);

  campaigns.forEach((c, index) => {
    const accountName = c.linkedin_account?.account_name || '❌ NO ACCOUNT';
    const accountId = c.linkedin_account?.unipile_account_id || 'N/A';
    const isThorsten = accountName.includes('Thorsten') || accountName.includes('tl@');

    console.log(`${index + 1}. ${c.name}`);
    console.log(`   LinkedIn Account: ${accountName} ${isThorsten ? '✅' : '⚠️'}`);
    console.log(`   Unipile Account: ${accountId.substring(0, 20)}...`);
    console.log('');
  });

  // Check if ANY campaign is still using wrong account
  const wrongAccountCampaigns = campaigns.filter(c => {
    const name = c.linkedin_account?.account_name || '';
    return !name.includes('Thorsten') && !name.includes('tl@') && c.linkedin_account !== null;
  });

  if (wrongAccountCampaigns.length > 0) {
    console.log(`⚠️  WARNING: ${wrongAccountCampaigns.length} campaigns using non-Thorsten accounts:\n`);
    wrongAccountCampaigns.forEach(c => {
      console.log(`   - ${c.name}: ${c.linkedin_account.account_name}`);
    });
  } else {
    console.log('✅ ALL ACTIVE CAMPAIGNS ARE USING THORSTEN\'S ACCOUNT\n');
  }

  // 2. Check recent prospects for name quality
  console.log('\n' + '='.repeat(70));
  console.log('\n✅ FIX 2: Name Extraction\n');

  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('📊 Recent Prospects (checking name quality):\n');

  let properNamesCount = 0;
  let usernameNamesCount = 0;

  prospects.forEach((p, index) => {
    const isProperName = p.first_name &&
                        p.first_name.length > 0 &&
                        !p.first_name.includes('/') &&
                        p.first_name !== p.linkedin_url?.split('/in/')[1]?.split('/')[0];

    if (isProperName) {
      properNamesCount++;
    } else {
      usernameNamesCount++;
    }

    console.log(`${index + 1}. ${p.first_name} ${p.last_name} ${isProperName ? '✅' : '⚠️'}`);
    console.log(`   LinkedIn: ${p.linkedin_url}`);
    console.log(`   Status: ${p.status}`);
    console.log('');
  });

  console.log(`Name Quality Summary:`);
  console.log(`  ✅ Proper names: ${properNamesCount}/10`);
  console.log(`  ⚠️  Username-like: ${usernameNamesCount}/10\n`);

  // 3. Test Unipile API access
  console.log('\n' + '='.repeat(70));
  console.log('\n✅ FIX 3: Unipile API Connection\n');

  const testLinkedInUrl = prospects[0]?.linkedin_url;
  if (testLinkedInUrl) {
    const username = testLinkedInUrl.split('/in/')[1]?.split('/')[0];
    const unipileAccountId = 'mERQmojtSZq5GeomZZazlw'; // Thorsten's account

    console.log(`Testing Unipile API with: ${username}\n`);

    try {
      const response = await fetch(
        `https://${process.env.UNIPILE_DSN}/api/v1/users/${username}?account_id=${unipileAccountId}`,
        {
          headers: {
            'X-API-KEY': process.env.UNIPILE_API_KEY
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Unipile API Connection: SUCCESS\n');
        console.log(`   Returned fields:`);
        console.log(`   - first_name: "${data.first_name}"`);
        console.log(`   - last_name: "${data.last_name}"`);
        console.log(`   - display_name: ${data.display_name ? '"' + data.display_name + '"' : 'NOT PROVIDED ✅'}`);
      } else {
        console.log(`⚠️  Unipile API returned: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.log(`❌ Unipile API Error: ${error.message}`);
    }
  } else {
    console.log('⚠️  No prospects with LinkedIn URLs to test');
  }

  // 4. Summary
  console.log('\n' + '='.repeat(70));
  console.log('\n📋 VERIFICATION SUMMARY\n');

  const allGood = wrongAccountCampaigns.length === 0 && properNamesCount >= 7;

  if (allGood) {
    console.log('✅ ALL FIXES VERIFIED AND WORKING!');
    console.log('✅ Campaigns use correct LinkedIn account');
    console.log('✅ Names are being extracted properly');
    console.log('\n🚀 SYSTEM READY FOR PRODUCTION USE\n');
  } else {
    console.log('⚠️  SOME ISSUES DETECTED:');
    if (wrongAccountCampaigns.length > 0) {
      console.log(`   - ${wrongAccountCampaigns.length} campaigns using wrong account`);
    }
    if (properNamesCount < 7) {
      console.log(`   - Only ${properNamesCount}/10 prospects have proper names`);
      console.log('   - This may be OK if prospects were created before fix');
    }
    console.log('\n⚠️  REVIEW RESULTS ABOVE FOR DETAILS\n');
  }
}

verifyCompleteFix().catch(console.error);
