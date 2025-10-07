/**
 * Test Trial Confirmation Email
 * Finds the most recent signup and sends them a trial confirmation email
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testTrialConfirmationEmail() {
  try {
    console.log('🔍 Finding most recent signup...\n');

    // Find most recent user with workspace and subscription
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        first_name,
        last_name,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(5);

    if (usersError) throw usersError;

    if (!users || users.length === 0) {
      console.log('❌ No users found');
      return;
    }

    console.log(`Found ${users.length} recent users:\n`);

    // Find workspace and subscription for each user
    for (const user of users) {
      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .single();

      if (!membership) continue;

      const { data: workspace } = await supabase
        .from('workspaces')
        .select('id, name')
        .eq('id', membership.workspace_id)
        .single();

      const { data: subscription } = await supabase
        .from('workspace_subscriptions')
        .select('plan, status, trial_end')
        .eq('workspace_id', membership.workspace_id)
        .single();

      console.log(`📧 ${user.email}`);
      console.log(`   User ID: ${user.id}`);
      console.log(`   Name: ${user.first_name} ${user.last_name}`);
      console.log(`   Workspace: ${workspace?.name || 'None'} (${workspace?.id || 'N/A'})`);
      console.log(`   Plan: ${subscription?.plan || 'None'}`);
      console.log(`   Status: ${subscription?.status || 'N/A'}`);
      console.log(`   Created: ${new Date(user.created_at).toLocaleString()}\n`);

      // Use the first user with a workspace and subscription
      if (workspace && subscription) {
        console.log('✅ Selected this user for test email\n');
        console.log('📤 Sending trial confirmation email...\n');

        const response = await fetch('http://localhost:3000/api/auth/send-trial-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId: workspace.id,
            userId: user.id,
            plan: subscription.plan
          })
        });

        const result = await response.json();

        if (response.ok) {
          console.log('✅ Trial confirmation email sent successfully!');
          console.log(`   To: ${user.email}`);
          console.log(`   Message ID: ${result.messageId}`);
          console.log(`   Status: ${result.message}`);
        } else {
          console.log('❌ Failed to send email:');
          console.log(`   Error: ${result.error}`);
          console.log(`   Details: ${result.details || 'N/A'}`);
        }

        return;
      }
    }

    console.log('❌ No users found with workspace and subscription');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testTrialConfirmationEmail();
