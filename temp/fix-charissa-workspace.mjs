import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fix() {
  // Fix 1: Link Charissa's account to her workspace
  console.log('Linking Charissa account to Charissa workspace...');

  const { error: e1 } = await supabase
    .from('user_unipile_accounts')
    .update({ workspace_id: '7f0341da-88db-476b-ae0a-fc0da5b70861' })
    .eq('id', 'c53d51a2-0727-4ad0-b746-ed7889d8eb97');

  if (e1) {
    console.log('❌ Error:', e1.message);
  } else {
    console.log('✅ Charissa account linked to workspace');
  }

  // Fix 2: Update all Charissa's campaigns
  console.log('\nUpdating Charissa campaigns...');

  const { data: updated, error: e2 } = await supabase
    .from('campaigns')
    .update({ linkedin_account_id: 'c53d51a2-0727-4ad0-b746-ed7889d8eb97' })
    .eq('workspace_id', '7f0341da-88db-476b-ae0a-fc0da5b70861')
    .is('linkedin_account_id', null)
    .select('name');

  if (e2) {
    console.log('❌ Error:', e2.message);
  } else {
    console.log('✅ Updated campaigns:');
    for (const c of (updated || [])) {
      console.log('   -', c.name);
    }
  }

  console.log('\nDone.');
}

fix().catch(console.error);
