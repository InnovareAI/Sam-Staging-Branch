const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLinkedInAccounts() {
  console.log('🔍 Checking LinkedIn accounts...\n');

  // Get all workspace accounts
  const { data: accounts, error } = await supabase
    .from('workspace_accounts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log(`Found ${accounts.length} total workspace accounts:\n`);

  accounts.forEach(acc => {
    console.log(`Account ID: ${acc.id}`);
    console.log(`Workspace: ${acc.workspace_id}`);
    console.log(`Type: ${acc.account_type}`);
    console.log(`Name: ${acc.account_name}`);
    console.log(`Unipile ID: ${acc.unipile_account_id}`);
    console.log(`Active: ${acc.is_active}`);
    console.log(`Created: ${acc.created_at}`);
    console.log('---\n');
  });

  // Check for active LinkedIn accounts
  const linkedinAccounts = accounts.filter(acc =>
    acc.account_type === 'linkedin' && acc.is_active
  );

  console.log(`\n✅ Active LinkedIn accounts: ${linkedinAccounts.length}`);

  if (linkedinAccounts.length === 0) {
    console.log('\n⚠️  NO ACTIVE LINKEDIN ACCOUNTS FOUND!');
    console.log('\nYou need to either:');
    console.log('1. Add a LinkedIn account via Workspace Settings → Integrations');
    console.log('2. OR insert manually with:');
    console.log(`
INSERT INTO workspace_accounts (
  workspace_id,
  account_type,
  account_name,
  unipile_account_id,
  is_active
) VALUES (
  'YOUR_WORKSPACE_ID',
  'linkedin',
  'Thorsten Linz',
  'mERQmojtSZq5GeomZZazlw',
  true
);
`);
  } else {
    console.log('\n✅ LinkedIn account configured correctly!');
    linkedinAccounts.forEach(acc => {
      console.log(`  - ${acc.account_name} (${acc.unipile_account_id})`);
    });
  }
}

checkLinkedInAccounts().catch(console.error);
