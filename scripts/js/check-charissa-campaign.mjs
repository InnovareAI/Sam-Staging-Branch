import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function check() {
  // Find Charissa's workspace
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name')
    .ilike('name', '%charissa%');

  if (workspaces && workspaces.length > 0) {
    console.log('Found workspace:', workspaces[0].name);
    await checkWorkspace(workspaces[0].id, workspaces[0].name);
    return;
  }

  // Try finding by user
  const { data: users } = await supabase
    .from('users')
    .select('id, email, name')
    .or('name.ilike.%charissa%,email.ilike.%charissa%');

  console.log('Users found:', users?.length || 0);

  if (users && users.length > 0) {
    for (const user of users) {
      console.log('User:', user.name, user.email);
      const { data: wm } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id);

      if (wm && wm.length > 0) {
        const { data: ws } = await supabase
          .from('workspaces')
          .select('id, name')
          .eq('id', wm[0].workspace_id)
          .single();

        if (ws) {
          console.log('Workspace:', ws.name);
          await checkWorkspace(ws.id, ws.name);
        }
      }
    }
  }
}

async function checkWorkspace(workspaceId, workspaceName) {
  console.log('\n=== CAMPAIGN STATUS ===\n');

  // Get campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active');

  console.log('Active campaigns:', campaigns?.length || 0);

  for (const campaign of campaigns || []) {
    console.log('\n📊 Campaign:', campaign.name);
    console.log('   ID:', campaign.id);
    console.log('   Status:', campaign.status);
    console.log('   Daily limit:', campaign.daily_limit || 'not set');

    // Get leads stats
    const { count: totalLeads } = await supabase
      .from('campaign_leads')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id);

    const { count: pendingCR } = await supabase
      .from('campaign_leads')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .eq('status', 'pending_connection');

    const { count: sentCR } = await supabase
      .from('campaign_leads')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .eq('status', 'connection_request_sent');

    const { count: connected } = await supabase
      .from('campaign_leads')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .eq('status', 'connected');

    console.log('   Total leads:', totalLeads);
    console.log('   Pending CR:', pendingCR);
    console.log('   CR Sent:', sentCR);
    console.log('   Connected:', connected);

    // Check today's sends
    const today = new Date().toISOString().split('T')[0];
    const { data: todaysSends } = await supabase
      .from('campaign_leads')
      .select('id, linkedin_profile_url, connection_request_sent_at')
      .eq('campaign_id', campaign.id)
      .gte('connection_request_sent_at', today + 'T00:00:00')
      .order('connection_request_sent_at', { ascending: false })
      .limit(20);

    console.log('\n   📤 Sent today:', todaysSends?.length || 0);
    if (todaysSends && todaysSends.length > 0) {
      console.log('   Last sent:', todaysSends[0].connection_request_sent_at);
    }
  }

  // Check LinkedIn account status
  const { data: account } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('account_type', 'linkedin')
    .single();

  console.log('\n=== LINKEDIN ACCOUNT ===');
  console.log('Connection status:', account?.connection_status);
  console.log('Unipile account ID:', account?.unipile_account_id);
  console.log('Daily CR limit:', account?.daily_connection_request_limit);
  console.log('CRs sent today:', account?.connection_requests_sent_today);
  console.log('Last CR sent:', account?.last_connection_request_sent_at);
}

check().catch(console.error);
