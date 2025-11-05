import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

const stanUserId = '6a927440-ebe1-49b4-ae5e-fbee5d27944d';

console.log('🔍 Checking Stan Bounev workspace situation\n');

// Check workspace_members
console.log('1️⃣ Checking workspace_members table...\n');
const { data: memberships, error: memberError } = await supabase
  .from('workspace_members')
  .select('*')
  .eq('user_id', stanUserId);

if (memberError) {
  console.log('❌ Error querying workspace_members:', memberError.message);
} else {
  console.log(`✅ Found ${memberships?.length || 0} workspace memberships`);
  if (memberships && memberships.length > 0) {
    memberships.forEach((m, i) => {
      console.log(`\n   Membership ${i + 1}:`);
      console.log(`   - Workspace ID: ${m.workspace_id}`);
      console.log(`   - Role: ${m.role}`);
      console.log(`   - Created: ${m.created_at}`);
    });
  }
}

// Check workspaces table
console.log('\n\n2️⃣ Checking workspaces table...\n');
const { data: workspaces, error: workspaceError } = await supabase
  .from('workspaces')
  .select('*');

if (workspaceError) {
  console.log('❌ Error querying workspaces:', workspaceError.message);
} else {
  console.log(`✅ Found ${workspaces?.length || 0} total workspaces in database`);
  if (workspaces && workspaces.length > 0) {
    workspaces.slice(0, 5).forEach((w, i) => {
      console.log(`\n   Workspace ${i + 1}:`);
      console.log(`   - ID: ${w.id}`);
      console.log(`   - Name: ${w.name}`);
      console.log(`   - Owner: ${w.owner_id}`);
    });
  }
}

// Check if Stan's membership workspace exists
if (memberships && memberships.length > 0) {
  console.log('\n\n3️⃣ Checking if Stan\'s workspaces exist...\n');
  for (const membership of memberships) {
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', membership.workspace_id)
      .single();

    if (wsError) {
      console.log(`❌ Workspace ${membership.workspace_id} NOT FOUND`);
      console.log(`   Error: ${wsError.message}`);
    } else {
      console.log(`✅ Workspace ${membership.workspace_id} exists`);
      console.log(`   Name: ${workspace.name}`);
      console.log(`   Owner: ${workspace.owner_id}`);
    }
  }
}

// Check workspace_accounts for Stan
console.log('\n\n4️⃣ Checking workspace_accounts for Stan...\n');
if (memberships && memberships.length > 0) {
  for (const membership of memberships) {
    const { data: accounts, error: accError } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', membership.workspace_id)
      .eq('account_type', 'linkedin');

    if (accError) {
      console.log(`❌ Error querying accounts for workspace ${membership.workspace_id}`);
      console.log(`   Error: ${accError.message}`);
    } else {
      console.log(`✅ Workspace ${membership.workspace_id}: ${accounts?.length || 0} LinkedIn accounts`);
      if (accounts && accounts.length > 0) {
        accounts.forEach(acc => {
          console.log(`   - Account: ${acc.account_name}`);
          console.log(`     Unipile ID: ${acc.unipile_account_id}`);
          console.log(`     Status: ${acc.connection_status}`);
        });
      }
    }
  }
}

console.log('\n✅ Check complete!');
