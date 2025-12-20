const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Get prospects that would be picked up by the cron query
  const { data, error } = await supabase
    .from('campaign_prospects')
    .select(`
      id, first_name, last_name, linkedin_user_id, status, campaign_id,
      campaigns (linkedin_account_id)
    `)
    .in('status', ['connected', 'connection_request_sent', 'messaging', 'follow_up_sent'])
    .is('responded_at', null)
    .not('linkedin_user_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(100);

  console.log('Total prospects matching cron query:', data?.length || 0);
  console.log('Error:', error?.message || 'none');

  // Group by linkedin_account_id
  const byAccount = {};
  data?.forEach(p => {
    const campaign = p.campaigns;
    const accId = campaign?.linkedin_account_id || 'NO_ACCOUNT';
    if (!byAccount[accId]) byAccount[accId] = [];
    byAccount[accId].push(p);
  });

  console.log('\nBy LinkedIn Account:');
  Object.entries(byAccount).forEach(([accId, prospects]) => {
    console.log('\n  Account:', accId?.slice(0, 30) + '...');
    console.log('  Prospects:', prospects.length);
    prospects.slice(0, 3).forEach(p => {
      console.log('    -', p.first_name, p.last_name, '| ID:', p.linkedin_user_id?.slice(0, 25));
    });
  });

  // Check specifically for Irish's account
  const irishAccountId = '102ec481-d08a-4b84-967e-fa8c92d453d8';
  const irishProspects = byAccount[irishAccountId] || [];
  console.log('\n\n=== IRISH\'S PROSPECTS ===');
  console.log('Count:', irishProspects.length);
  irishProspects.forEach(p => {
    console.log('  -', p.first_name, p.last_name, '[' + p.status + ']', '| ID:', p.linkedin_user_id?.slice(0, 25));
  });
}

check();
