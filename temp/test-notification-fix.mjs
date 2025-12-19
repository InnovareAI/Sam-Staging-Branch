import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function testNotificationLogic() {
  console.log('=== TESTING NEW NOTIFICATION LOGIC ===\n');

  const testWorkspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'; // Thorsten's workspace

  // STEP 1: Get workspace info and owner (NEW APPROACH)
  console.log('Step 1: Get workspace info...');
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, owner_id')
    .eq('id', testWorkspaceId)
    .single();

  console.log('Workspace:', workspace);

  if (!workspace?.owner_id) {
    console.error('❌ No workspace owner found');
    return;
  }

  // STEP 2: Get owner email
  console.log('\nStep 2: Get owner email...');
  const { data: owner } = await supabase
    .from('users')
    .select('id, email, first_name, last_name')
    .eq('id', workspace.owner_id)
    .single();

  console.log('Owner:', owner);

  const ownerEmail = owner?.email;
  const clientName = workspace.name;

  if (!ownerEmail) {
    console.error('❌ No owner email found');
    return;
  }

  console.log(`✓ Owner email: ${ownerEmail}`);

  // STEP 3: Get additional workspace members
  console.log('\nStep 3: Get additional workspace members...');
  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id, role')
    .eq('workspace_id', testWorkspaceId)
    .eq('status', 'active')
    .neq('user_id', workspace.owner_id);

  console.log('Additional members found:', members?.length || 0);

  // STEP 4: Get emails for additional members
  const additionalRecipients = [];
  if (members && members.length > 0) {
    const memberIds = members.map(m => m.user_id);
    const { data: memberUsers } = await supabase
      .from('users')
      .select('email')
      .in('id', memberIds);

    if (memberUsers) {
      additionalRecipients.push(...memberUsers.map(u => u.email).filter(Boolean));
    }
  }

  console.log('\n=== NOTIFICATION RECIPIENTS ===');
  console.log('Primary (To):', ownerEmail);
  console.log('Additional (Cc):', additionalRecipients.length > 0 ? additionalRecipients.join(', ') : 'None');
  console.log('\n✓ Logic test PASSED - All recipients retrieved successfully');
}

testNotificationLogic().then(() => process.exit(0));
