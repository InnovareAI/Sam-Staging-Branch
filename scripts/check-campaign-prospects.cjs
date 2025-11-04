const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

(async () => {
  const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

  console.log('🔍 CHECKING APPROVED PROSPECTS → CAMPAIGN PIPELINE\n');

  // Get approved prospects from last 24h
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const { data: approvedProspects } = await supabase
    .from('prospect_approval_data')
    .select('id, session_id, approval_status, contact, created_at')
    .eq('workspace_id', workspaceId)
    .eq('approval_status', 'approved')
    .gte('created_at', yesterday.toISOString())
    .order('created_at', { ascending: false });

  console.log(`✅ Approved Prospects (last 24h): ${approvedProspects.length}\n`);

  // For each approved prospect, check if they're in campaign_prospects
  for (const prospect of approvedProspects) {
    const contact = typeof prospect.contact === 'string' ? JSON.parse(prospect.contact) : prospect.contact;
    const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'NO NAME';
    const linkedinUrl = contact.linkedInUrl || contact.linkedin_url || 'NO URL';

    console.log(`  ${name}`);
    console.log(`    LinkedIn: ${linkedinUrl}`);
    console.log(`    Approved: ${new Date(prospect.created_at).toLocaleString()}`);
    console.log(`    Prospect ID: ${prospect.id}`);

    // Check if this prospect is in campaign_prospects
    const { data: campaignProspects, error } = await supabase
      .from('campaign_prospects')
      .select('id, campaign_id, status, created_at, campaigns!inner(name)')
      .or(`prospect_id.eq.${prospect.id},linkedin_url.eq.${linkedinUrl}`)
      .limit(5);

    if (error) {
      console.log(`    ❌ Error checking campaigns: ${error.message}`);
    } else if (!campaignProspects || campaignProspects.length === 0) {
      console.log(`    ⚠️  NOT in any campaign`);
    } else {
      console.log(`    ✅ In ${campaignProspects.length} campaign(s):`);
      campaignProspects.forEach(cp => {
        console.log(`       - ${cp.campaigns.name} (status: ${cp.status})`);
      });
    }
    console.log('');
  }

  // Also check all campaign_prospects created in last 24h
  const { data: recentCampaignProspects, error: cpError } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, status, created_at, campaigns!inner(name, workspace_id)')
    .eq('campaigns.workspace_id', workspaceId)
    .gte('created_at', yesterday.toISOString())
    .order('created_at', { ascending: false });

  if (cpError) {
    console.log(`\n❌ Error fetching recent campaign prospects: ${cpError.message}`);
  } else {
    console.log(`\n📋 Campaign Prospects Created (last 24h): ${recentCampaignProspects.length}\n`);

    if (recentCampaignProspects.length > 0) {
      const byCampaign = {};
      recentCampaignProspects.forEach(cp => {
        const campaignName = cp.campaigns?.name || 'Unknown';
        if (!byCampaign[campaignName]) {
          byCampaign[campaignName] = [];
        }
        byCampaign[campaignName].push(cp);
      });

      Object.entries(byCampaign).forEach(([campaignName, prospects]) => {
        console.log(`  ${campaignName}: ${prospects.length} prospects`);
        prospects.forEach((p, i) => {
          const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || 'NO NAME';
          console.log(`    ${i + 1}. ${name} (${p.status})`);
        });
        console.log('');
      });
    }
  }
})();
