const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

(async () => {
  const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

  console.log('🔍 SIMULATING APPROVED PROSPECTS API\n');

  // Get all approval sessions for this workspace
  const { data: sessions, error: sessionsError } = await supabase
    .from('prospect_approval_sessions')
    .select('id, campaign_name, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (sessionsError) {
    console.log('❌ Error fetching sessions:', sessionsError);
    return;
  }

  console.log(`📊 Approval Sessions: ${sessions.length}\n`);

  const sessionIds = sessions.map(s => s.id);

  if (sessionIds.length === 0) {
    console.log('⚠️  No approval sessions found');
    return;
  }

  // Get approved prospects (not in campaigns yet)
  const { data: approvedData, error: dataError } = await supabase
    .from('prospect_approval_data')
    .select(`
      *,
      prospect_approval_sessions(
        workspace_id,
        campaign_name,
        campaign_tag,
        prospect_source
      )
    `)
    .in('session_id', sessionIds)
    .eq('approval_status', 'approved')
    .order('created_at', { ascending: false });

  if (dataError) {
    console.log('❌ Error fetching approved prospects:', dataError);
    return;
  }

  console.log(`✅ Approved Prospects: ${approvedData.length}\n`);

  // Check which ones are already in campaigns
  for (const prospect of approvedData) {
    const contact = typeof prospect.contact === 'string' ? JSON.parse(prospect.contact) : prospect.contact;
    const linkedinUrl = contact?.linkedin_url || contact?.linkedInUrl || prospect.linkedin_url || null;
    const name = [contact?.firstName, contact?.lastName].filter(Boolean).join(' ') || prospect.name || 'NO NAME';

    console.log(`  ${name}`);
    console.log(`    LinkedIn: ${linkedinUrl}`);
    console.log(`    Session: ${prospect.prospect_approval_sessions?.campaign_name || 'Unknown'}`);
    console.log(`    Prospect ID: ${prospect.prospect_id}`);

    // Check if already in campaign
    if (linkedinUrl) {
      const { data: campaignProspect } = await supabase
        .from('campaign_prospects')
        .select('campaign_id, campaigns(name)')
        .eq('linkedin_url', linkedinUrl)
        .maybeSingle();

      if (campaignProspect) {
        console.log(`    🚫 Already in campaign: ${campaignProspect.campaigns?.name}`);
      } else {
        console.log(`    ✅ AVAILABLE for campaign`);
      }
    } else {
      console.log(`    ⚠️  No LinkedIn URL - cannot add to campaign`);
    }
    console.log('');
  }

  // Count available prospects
  const available = [];
  for (const prospect of approvedData) {
    const contact = typeof prospect.contact === 'string' ? JSON.parse(prospect.contact) : prospect.contact;
    const linkedinUrl = contact?.linkedin_url || contact?.linkedInUrl || prospect.linkedin_url || null;

    if (!linkedinUrl) continue;

    const { data: campaignProspect } = await supabase
      .from('campaign_prospects')
      .eq('linkedin_url', linkedinUrl)
      .maybeSingle();

    if (!campaignProspect) {
      available.push(prospect);
    }
  }

  console.log(`\n📋 SUMMARY:`);
  console.log(`  Total Approved: ${approvedData.length}`);
  console.log(`  Available for Campaigns: ${available.length}`);
  console.log(`  Already in Campaigns: ${approvedData.length - available.length}\n`);

  if (available.length > 0) {
    console.log(`✅ Ready to create campaign with ${available.length} prospects`);
    console.log(`\nProspect IDs for add-approved-prospects API:`);
    console.log(JSON.stringify(available.map(p => p.prospect_id), null, 2));
  } else {
    console.log(`⚠️  No prospects available for new campaigns`);
  }
})();
