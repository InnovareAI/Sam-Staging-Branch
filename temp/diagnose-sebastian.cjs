const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function diagnose() {
  console.log('='.repeat(80));
  console.log('SEBASTIAN LINKEDIN ACCOUNT DIAGNOSIS');
  console.log('='.repeat(80));

  // 1. Check account
  const { data: account } = await supabase
    .from('user_unipile_accounts')
    .select('*')
    .eq('id', '386feaac-21ca-45c9-b098-126bf49baa86')
    .single();

  console.log('\n1. LINKEDIN ACCOUNT STATUS:');
  console.log('   ID:', account.id);
  console.log('   Name:', account.account_name);
  console.log('   Status:', account.connection_status);
  console.log('   Unipile ID:', account.unipile_account_id);
  console.log('   Workspace ID:', account.workspace_id);

  // 2. Check campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, campaign_type, status, linkedin_account_id')
    .eq('workspace_id', 'c3100bea-82a6-4365-b159-6581f1be9be3');

  console.log('\n2. CAMPAIGNS FOR WORKSPACE:');
  campaigns.forEach(c => {
    const match = c.linkedin_account_id === account.id;
    console.log('   Campaign:', c.name);
    console.log('     - Type:', c.campaign_type);
    console.log('     - Status:', c.status);
    console.log('     - LinkedIn Account ID:', c.linkedin_account_id || 'NOT SET');
    console.log('     - Match:', match ? 'CORRECT' : 'MISMATCH');
    console.log('');
  });

  // 3. Check for other accounts in workspace
  const { data: allAccounts } = await supabase
    .from('user_unipile_accounts')
    .select('id, account_name, platform, connection_status')
    .eq('workspace_id', 'c3100bea-82a6-4365-b159-6581f1be9be3');

  console.log('3. ALL ACCOUNTS IN WORKSPACE:');
  allAccounts.forEach(acc => {
    console.log('   -', acc.account_name, '(' + acc.platform + '):', acc.connection_status);
    console.log('     ID:', acc.id);
  });

  console.log('\n' + '='.repeat(80));
  console.log('DIAGNOSIS SUMMARY:');
  console.log('='.repeat(80));

  const missing = campaigns.filter(c => !c.linkedin_account_id);
  const mismatched = campaigns.filter(c => c.linkedin_account_id && c.linkedin_account_id !== account.id);

  if (missing.length > 0) {
    console.log('ISSUE: ' + missing.length + ' campaigns have NO linkedin_account_id set');
    console.log('   Campaigns:', missing.map(c => c.name).join(', '));
  }

  if (mismatched.length > 0) {
    console.log('ISSUE: ' + mismatched.length + ' campaigns have WRONG linkedin_account_id');
    console.log('   Campaigns:', mismatched.map(c => c.name).join(', '));
  }

  if (missing.length === 0 && mismatched.length === 0) {
    console.log('All campaigns correctly linked to Sebastian account');
  }

  console.log('='.repeat(80));
}

diagnose();
