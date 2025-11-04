const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
const userId = 'f6885ff3-deef-4781-8721-93011c990b1b';

(async () => {
  console.log('🧪 TESTING CAMPAIGN PIPELINE\n');

  // Step 1: Get approved prospects NOT in campaigns
  console.log('Step 1: Getting approved prospects...');

  const { data: sessions } = await supabase
    .from('prospect_approval_sessions')
    .select('id')
    .eq('workspace_id', workspaceId);

  const sessionIds = sessions.map(s => s.id);

  const { data: approvedData } = await supabase
    .from('prospect_approval_data')
    .select('prospect_id, name, contact')
    .in('session_id', sessionIds)
    .eq('approval_status', 'approved');

  if (!approvedData || approvedData.length === 0) {
    console.log('⚠️  No approved prospects found. Exiting.');
    return;
  }

  // Filter out prospects already in campaigns
  const available = [];
  for (const prospect of approvedData) {
    const contact = typeof prospect.contact === 'string' ? JSON.parse(prospect.contact) : prospect.contact;
    const linkedinUrl = contact?.linkedin_url || contact?.linkedInUrl || prospect.linkedin_url;

    if (!linkedinUrl) continue;

    const { data: existing } = await supabase
      .from('campaign_prospects')
      .select('id')
      .eq('linkedin_url', linkedinUrl)
      .maybeSingle();

    if (!existing) {
      available.push({ ...prospect, linkedinUrl });
    }
  }

  console.log(`✅ Found ${available.length} prospects available for campaign\n`);

  if (available.length === 0) {
    console.log('⚠️  No prospects available. Exiting.');
    return;
  }

  // Step 2: Create a test campaign
  console.log('Step 2: Creating test campaign...');

  const campaignName = `TEST-${Date.now()}-Pipeline-Test`;

  const { data: campaignId, error: campaignError } = await supabase
    .rpc('create_campaign', {
      p_workspace_id: workspaceId,
      p_name: campaignName,
      p_description: 'Test campaign for pipeline verification',
      p_campaign_type: 'linkedin_outreach',
      p_target_icp: { test: true },
      p_ab_test_variant: null,
      p_message_templates: {
        connection: 'Hi {firstName}, would love to connect!'
      }
    });

  if (campaignError) {
    console.error('❌ Failed to create campaign:', campaignError);
    return;
  }

  console.log(`✅ Campaign created: ${campaignName}`);
  console.log(`   ID: ${campaignId}\n`);

  // Step 3: Add prospects to campaign
  console.log(`Step 3: Adding ${Math.min(available.length, 5)} prospects to campaign...`);

  // Only add first 5 for testing
  const prospectsToAdd = available.slice(0, 5).map(p => p.prospect_id);

  console.log('Prospect IDs to add:');
  console.log(JSON.stringify(prospectsToAdd, null, 2));

  // Manually build campaign_prospects records (simulating the API)
  const campaignProspects = [];
  for (const p of available.slice(0, 5)) {
    const contact = typeof p.contact === 'string' ? JSON.parse(p.contact) : p.contact;

    // Extract name from top-level name field or contact
    const fullName = p.name || '';
    const nameParts = fullName.split(' ');
    const firstName = contact?.firstName || nameParts[0] || 'Unknown';
    const lastName = contact?.lastName || nameParts.slice(1).join(' ') || '';

    campaignProspects.push({
      campaign_id: campaignId,
      workspace_id: workspaceId,
      first_name: firstName,
      last_name: lastName,
      linkedin_url: p.linkedinUrl,
      email: contact?.email || null,
      status: 'approved',
      added_by: userId
    });
  }

  const { data: inserted, error: insertError } = await supabase
    .from('campaign_prospects')
    .insert(campaignProspects)
    .select();

  if (insertError) {
    console.error('❌ Failed to add prospects:', insertError);
    return;
  }

  console.log(`✅ Added ${inserted.length} prospects to campaign\n`);

  // Step 4: Verify
  console.log('Step 4: Verifying campaign_prospects...');

  const { data: verification, count } = await supabase
    .from('campaign_prospects')
    .select('first_name, last_name, linkedin_url, status', { count: 'exact' })
    .eq('campaign_id', campaignId);

  console.log(`✅ Verified ${count} prospects in campaign:`);
  verification.forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.first_name} ${p.last_name} (${p.status})`);
  });

  console.log('\n✅ PIPELINE TEST COMPLETE!');
  console.log(`\nCampaign Details:`);
  console.log(`  Name: ${campaignName}`);
  console.log(`  ID: ${campaignId}`);
  console.log(`  Prospects: ${count}`);
  console.log(`  Status: Ready for N8N workflow`);
})();
