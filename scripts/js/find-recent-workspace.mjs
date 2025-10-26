import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function findRecentWorkspace() {
  try {
    // Get most recent campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('workspace_id, name, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (campaignError) throw campaignError;

    console.log(`\n📊 Most Recent Campaign:`);
    console.log(`   Name: ${campaign.name}`);
    console.log(`   Workspace ID: ${campaign.workspace_id}`);
    console.log(`   Created: ${new Date(campaign.created_at).toLocaleString()}\n`);

    // Get recent sessions for this workspace
    const { data: sessions, error: sessionsError } = await supabase
      .from('prospect_approval_sessions')
      .select('*')
      .eq('workspace_id', campaign.workspace_id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (sessionsError) throw sessionsError;

    console.log(`📋 Recent Approval Sessions (${sessions.length}):`);
    sessions.forEach((s, i) => {
      console.log(`\n${i + 1}. Session ID: ${s.id}`);
      console.log(`   Campaign Name: ${s.campaign_name}`);
      console.log(`   Status: ${s.status}`);
      console.log(`   Created: ${new Date(s.created_at).toLocaleString()}`);
    });

    console.log(`\n✅ Use this workspace ID for testing: ${campaign.workspace_id}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

findRecentWorkspace();
