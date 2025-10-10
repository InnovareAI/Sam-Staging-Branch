import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const userId = 'f6885ff3-deef-4781-8721-93011c990b1b';

  // Get LinkedIn account
  const { data: linkedinAccount } = await supabase
    .from('user_unipile_accounts')
    .select('unipile_account_id, platform, connection_status')
    .eq('user_id', userId)
    .eq('platform', 'LINKEDIN')
    .single();

  console.log('LinkedIn Account:', linkedinAccount);

  if (linkedinAccount) {
    // Check account capabilities via Unipile
    const unipileDSN = process.env.UNIPILE_DSN!;
    const accountUrl = unipileDSN.includes('.')
      ? `https://${unipileDSN}/api/v1/accounts/${linkedinAccount.unipile_account_id}`
      : `https://${unipileDSN}.unipile.com:13443/api/v1/accounts/${linkedinAccount.unipile_account_id}`;

    console.log('\nChecking account capabilities...');

    const response = await fetch(accountUrl, {
      headers: {
        'X-API-KEY': process.env.UNIPILE_API_KEY!,
        'Accept': 'application/json'
      }
    });

    if (response.ok) {
      const accountInfo = await response.json();
      console.log('\n📊 Account Info:', JSON.stringify(accountInfo, null, 2));

      const premiumFeatures = accountInfo.connection_params?.im?.premiumFeatures || [];
      console.log('\n✨ Premium Features:', premiumFeatures);

      if (premiumFeatures.includes('sales_navigator')) {
        console.log('\n🎯 ✅ SALES NAVIGATOR AVAILABLE!');
      } else if (premiumFeatures.includes('recruiter')) {
        console.log('\n🎯 ✅ RECRUITER AVAILABLE!');
      } else {
        console.log('\n📌 Using CLASSIC API (no premium features)');
      }
    } else {
      console.error('Failed to fetch account info:', response.status);
    }
  }
}

check();
