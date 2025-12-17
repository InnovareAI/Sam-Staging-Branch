import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fix() {
  console.log('=== FIXING FOREIGN KEY CONSTRAINT ===\n');

  // Step 1: Drop the broken constraint
  console.log('Step 1: Drop broken FK constraint');
  const { error: e1 } = await supabase.rpc('drop_constraint_if_exists', {
    table_name: 'campaigns',
    constraint_name: 'campaigns_linkedin_account_id_fkey'
  });

  // If RPC doesn't exist, we need to run raw SQL via the dashboard
  if (e1) {
    console.log('   RPC not available, need to run in Supabase SQL Editor:');
    console.log('   ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_linkedin_account_id_fkey;');
    console.log('');
    console.log('   Then run this script again.');
    return;
  }

  console.log('   ✅ Dropped old constraint');

  // Step 2: Set invalid IDs to NULL
  console.log('\nStep 2: Set invalid linkedin_account_ids to NULL');

  // Get valid account IDs
  const { data: accounts } = await supabase
    .from('user_unipile_accounts')
    .select('id');

  const validIds = (accounts || []).map(a => a.id);

  // Get campaigns with invalid IDs
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, linkedin_account_id')
    .not('linkedin_account_id', 'is', null);

  let nullified = 0;
  for (const c of (campaigns || [])) {
    if (!validIds.includes(c.linkedin_account_id)) {
      const { error } = await supabase
        .from('campaigns')
        .update({ linkedin_account_id: null })
        .eq('id', c.id);

      if (!error) {
        console.log(`   ✅ ${c.name} -> NULL`);
        nullified++;
      } else {
        console.log(`   ❌ ${c.name}: ${error.message}`);
      }
    }
  }
  console.log(`   Nullified: ${nullified} campaigns`);

  // Step 3: Add correct constraint
  console.log('\nStep 3: Add correct FK constraint');
  const { error: e3 } = await supabase.rpc('add_fk_constraint', {
    table_name: 'campaigns',
    constraint_name: 'fk_campaigns_linkedin_account',
    column_name: 'linkedin_account_id',
    ref_table: 'user_unipile_accounts',
    ref_column: 'id'
  });

  if (e3) {
    console.log('   RPC not available, need to run in Supabase SQL Editor:');
    console.log('   ALTER TABLE campaigns ADD CONSTRAINT fk_campaigns_linkedin_account');
    console.log('   FOREIGN KEY (linkedin_account_id) REFERENCES user_unipile_accounts(id) ON DELETE SET NULL;');
  } else {
    console.log('   ✅ Added new constraint');
  }

  console.log('\n=== DONE ===');
}

fix().catch(console.error);
