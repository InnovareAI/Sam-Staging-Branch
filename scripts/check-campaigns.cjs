const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

(async () => {
  const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

  console.log('🔍 CHECKING CAMPAIGNS AND PROSPECTS\n');

  // Get recent campaigns
  const { data: campaigns, error: campaignsError } = await supabase
    .from('campaigns')
    .select('id, name, status, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (campaignsError) {
    console.log('❌ Error fetching campaigns:', campaignsError);
  } else {
    console.log(`📊 Recent Campaigns (${campaigns.length}):\n`);
    campaigns.forEach(c => {
      console.log(`  ${c.name}`);
      console.log(`    ID: ${c.id}`);
      console.log(`    Status: ${c.status}`);
      console.log(`    Created: ${new Date(c.created_at).toLocaleString()}`);
      console.log('');
    });
  }

  // Get recent campaign prospects
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const { data: prospects, error: prospectsError } = await supabase
    .from('campaign_prospects')
    .select(`
      id,
      campaign_id,
      first_name,
      last_name,
      approval_status,
      created_at,
      campaigns!inner(name, workspace_id)
    `)
    .eq('campaigns.workspace_id', workspaceId)
    .gte('created_at', yesterday.toISOString())
    .order('created_at', { ascending: false })
    .limit(20);

  if (prospectsError) {
    console.log('❌ Error fetching campaign prospects:', prospectsError);
  } else {
    console.log(`\n📋 Recent Campaign Prospects (last 24h): ${prospects.length}\n`);

    if (prospects.length === 0) {
      console.log('  No prospects added to campaigns in the last 24 hours');
    } else {
      const byCampaign = {};
      prospects.forEach(p => {
        const campaignName = p.campaigns?.name || 'Unknown Campaign';
        if (!byCampaign[campaignName]) {
          byCampaign[campaignName] = [];
        }
        byCampaign[campaignName].push(p);
      });

      Object.entries(byCampaign).forEach(([campaignName, prospectsInCampaign]) => {
        console.log(`  Campaign: ${campaignName}`);
        console.log(`    Count: ${prospectsInCampaign.length}`);
        prospectsInCampaign.forEach((p, i) => {
          const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || 'NO NAME';
          console.log(`    ${i + 1}. ${name} (${p.approval_status || 'no status'})`);
        });
        console.log('');
      });
    }
  }

  // Check for approved prospects NOT in campaigns
  const { data: approvedProspects, error: approvedError } = await supabase
    .from('prospect_approval_data')
    .select('id, session_id, approval_status, contact, created_at')
    .eq('workspace_id', workspaceId)
    .eq('approval_status', 'approved')
    .gte('created_at', yesterday.toISOString())
    .order('created_at', { ascending: false });

  if (approvedError) {
    console.log('❌ Error fetching approved prospects:', approvedError);
  } else {
    console.log(`\n✅ Approved Prospects (last 24h): ${approvedProspects.length}\n`);
    if (approvedProspects.length > 0) {
      approvedProspects.forEach((p, i) => {
        const contact = typeof p.contact === 'string' ? JSON.parse(p.contact) : p.contact;
        const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'NO NAME';
        console.log(`  ${i + 1}. ${name}`);
        console.log(`     Session: ${p.session_id}`);
        console.log(`     Approved: ${new Date(p.created_at).toLocaleString()}`);
        console.log('');
      });
    }
  }
})();
