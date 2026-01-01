import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function checkWorkspaceContamination() {
  console.log('\n=== WORKSPACE CONTAMINATION CHECK ===\n');

  // First, find workspaces by name
  console.log('Finding workspaces by name...');

  // Get all workspaces
  const { data: allWorkspaces } = await supabase
    .from('workspaces')
    .select('id, name');

  console.log(`Total workspaces: ${allWorkspaces?.length || 0}`);
  console.log('All workspaces:', allWorkspaces?.map(w => ({ id: w.id, name: w.name })));

  // Find Sebastian's workspace(s) - look for "henkel" or "swiss" in name
  const sebastianWorkspaces = allWorkspaces?.filter(w =>
    w.name?.toLowerCase().includes('henkel') ||
    w.name?.toLowerCase().includes('sebastian') ||
    w.name?.toLowerCase().includes('swiss')
  );

  console.log('\nSebastian workspaces found:', sebastianWorkspaces?.map(w => ({ id: w.id, name: w.name })));
  const sebastianWorkspaceIds = sebastianWorkspaces?.map(w => w.id) || [];

  // Find Rony's workspace(s) - look for "innovare" or "rony" or "chatterjee"
  const ronyWorkspaces = allWorkspaces?.filter(w =>
    w.name?.toLowerCase().includes('innovare') ||
    w.name?.toLowerCase().includes('rony') ||
    w.name?.toLowerCase().includes('chatterjee') ||
    w.name?.toLowerCase().includes('tursio')
  );

  console.log('Rony workspaces found:', ronyWorkspaces?.map(w => ({ id: w.id, name: w.name })));
  const ronyWorkspaceIds = ronyWorkspaces?.map(w => w.id) || [];

  if (sebastianWorkspaceIds.length === 0) {
    console.log('❌ No Sebastian workspace found');
    return;
  }

  if (ronyWorkspaceIds.length === 0) {
    console.log('❌ No Rony workspace found');
    return;
  }

  // Step 1: Get Sebastian's campaigns
  console.log('\nStep 1: Getting Sebastian campaigns...');
  const { data: sebastianCampaigns } = await supabase
    .from('campaigns')
    .select('id, campaign_name, workspace_id')
    .in('workspace_id', sebastianWorkspaceIds);

  console.log(`Sebastian has ${sebastianCampaigns?.length || 0} campaigns`);
  console.log('Campaigns:', JSON.stringify(sebastianCampaigns, null, 2));

  // Step 2: Get Rony's campaigns
  console.log('\nStep 2: Getting Rony campaigns...');
  const { data: ronyCampaigns } = await supabase
    .from('campaigns')
    .select('id, campaign_name, workspace_id')
    .in('workspace_id', ronyWorkspaceIds);

  console.log(`Rony has ${ronyCampaigns?.length || 0} campaigns`);
  console.log('Campaigns:', JSON.stringify(ronyCampaigns, null, 2));

  const sebastianCampaignIds = sebastianCampaigns?.map(c => c.id) || [];
  const ronyCampaignIds = ronyCampaigns?.map(c => c.id) || [];

  // Step 3: Check for linkedin_url overlaps in campaign_prospects
  console.log('\nStep 3: Checking linkedin_url overlaps in campaign_prospects...');

  // Get all linkedin_urls from Sebastian's campaigns
  const { data: sebastianProspects } = await supabase
    .from('campaign_prospects')
    .select('linkedin_url, linkedin_user_id, campaign_id')
    .in('campaign_id', sebastianCampaignIds)
    .not('linkedin_url', 'is', null);

  console.log(`Sebastian's campaigns have ${sebastianProspects?.length || 0} prospects with linkedin_url`);

  // Get all linkedin_urls from Rony's campaigns
  const { data: ronyProspects } = await supabase
    .from('campaign_prospects')
    .select('linkedin_url, linkedin_user_id, campaign_id')
    .in('campaign_id', ronyCampaignIds)
    .not('linkedin_url', 'is', null);

  console.log(`Rony's campaigns have ${ronyProspects?.length || 0} prospects with linkedin_url`);

  // Check for overlaps by linkedin_url
  const sebastianUrls = new Set(sebastianProspects?.map(p => p.linkedin_url.toLowerCase()) || []);
  const ronyUrls = new Set(ronyProspects?.map(p => p.linkedin_url.toLowerCase()) || []);

  const urlOverlaps = [...sebastianUrls].filter(url => ronyUrls.has(url));
  console.log(`\n📊 LinkedIn URL overlaps: ${urlOverlaps.length}`);
  if (urlOverlaps.length > 0) {
    console.log('⚠️ OVERLAPPING URLs found:', urlOverlaps.slice(0, 10));
  }

  // Step 4: Check for linkedin_user_id overlaps
  console.log('\nStep 4: Checking linkedin_user_id overlaps in campaign_prospects...');

  const sebastianUserIds = new Set(
    sebastianProspects?.filter(p => p.linkedin_user_id).map(p => p.linkedin_user_id) || []
  );
  const ronyUserIds = new Set(
    ronyProspects?.filter(p => p.linkedin_user_id).map(p => p.linkedin_user_id) || []
  );

  const userIdOverlaps = [...sebastianUserIds].filter(id => ronyUserIds.has(id));
  console.log(`\n📊 LinkedIn user_id overlaps: ${userIdOverlaps.length}`);
  if (userIdOverlaps.length > 0) {
    console.log('⚠️ OVERLAPPING user IDs found:', userIdOverlaps.slice(0, 10));
  }

  // Step 5: Check send_queue table
  console.log('\nStep 5: Checking send_queue for cross-workspace contamination...');

  // Get all send_queue entries for Sebastian's campaigns
  const { data: sebastianQueue } = await supabase
    .from('send_queue')
    .select('linkedin_user_id, campaign_id, workspace_id')
    .in('campaign_id', sebastianCampaignIds)
    .not('linkedin_user_id', 'is', null);

  console.log(`Sebastian's send_queue entries: ${sebastianQueue?.length || 0}`);

  // Get all send_queue entries for Rony's campaigns
  const { data: ronyQueue } = await supabase
    .from('send_queue')
    .select('linkedin_user_id, campaign_id, workspace_id')
    .in('campaign_id', ronyCampaignIds)
    .not('linkedin_user_id', 'is', null);

  console.log(`Rony's send_queue entries: ${ronyQueue?.length || 0}`);

  // Check for overlaps in send_queue
  const sebastianQueueIds = new Set(sebastianQueue?.map(q => q.linkedin_user_id) || []);
  const ronyQueueIds = new Set(ronyQueue?.map(q => q.linkedin_user_id) || []);

  const queueOverlaps = [...sebastianQueueIds].filter(id => ronyQueueIds.has(id));
  console.log(`\n📊 Send queue linkedin_user_id overlaps: ${queueOverlaps.length}`);
  if (queueOverlaps.length > 0) {
    console.log('⚠️ OVERLAPPING queue IDs found:', queueOverlaps.slice(0, 10));
  }

  // Final verdict
  console.log('\n=== FINAL VERDICT ===\n');

  const hasContamination = urlOverlaps.length > 0 || userIdOverlaps.length > 0 || queueOverlaps.length > 0;

  if (hasContamination) {
    console.log('❌ CONTAMINATION DETECTED!');
    console.log(`   - LinkedIn URL overlaps: ${urlOverlaps.length}`);
    console.log(`   - LinkedIn user_id overlaps: ${userIdOverlaps.length}`);
    console.log(`   - Send queue overlaps: ${queueOverlaps.length}`);
  } else {
    console.log('✅ NO CONTAMINATION DETECTED');
    console.log('   All prospects are properly isolated between workspaces');
  }

  // Additional check: email_queue table
  console.log('\nStep 6: Checking email_queue for cross-workspace contamination...');

  const { data: sebastianEmailQueue } = await supabase
    .from('email_queue')
    .select('email, campaign_id, workspace_id')
    .in('campaign_id', sebastianCampaignIds)
    .not('email', 'is', null);

  console.log(`Sebastian's email_queue entries: ${sebastianEmailQueue?.length || 0}`);

  const { data: ronyEmailQueue } = await supabase
    .from('email_queue')
    .select('email, campaign_id, workspace_id')
    .in('campaign_id', ronyCampaignIds)
    .not('email', 'is', null);

  console.log(`Rony's email_queue entries: ${ronyEmailQueue?.length || 0}`);

  const sebastianEmails = new Set(sebastianEmailQueue?.map(q => q.email.toLowerCase()) || []);
  const ronyEmails = new Set(ronyEmailQueue?.map(q => q.email.toLowerCase()) || []);

  const emailOverlaps = [...sebastianEmails].filter(email => ronyEmails.has(email));
  console.log(`\n📊 Email queue overlaps: ${emailOverlaps.length}`);
  if (emailOverlaps.length > 0) {
    console.log('⚠️ OVERLAPPING emails found:', emailOverlaps.slice(0, 10));
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Sebastian's workspace ID: ${sebastianWorkspaceIds.join(', ')}`);
  console.log(`Sebastian's campaign count: ${sebastianCampaigns?.length || 0}`);
  console.log(`Sebastian's prospect count: ${sebastianProspects?.length || 0}`);
  console.log(`Sebastian's send_queue entries: ${sebastianQueue?.length || 0}`);
  console.log(`Sebastian's email_queue entries: ${sebastianEmailQueue?.length || 0}`);
  console.log(`\nRony's workspace ID: ${ronyWorkspaceIds.join(', ')}`);
  console.log(`Rony's campaign count: ${ronyCampaigns?.length || 0}`);
  console.log(`Rony's prospect count: ${ronyProspects?.length || 0}`);
  console.log(`Rony's send_queue entries: ${ronyQueue?.length || 0}`);
  console.log(`Rony's email_queue entries: ${ronyEmailQueue?.length || 0}`);
  console.log('\n=== OVERLAP COUNTS ===');
  console.log(`LinkedIn URL overlaps: ${urlOverlaps.length}`);
  console.log(`LinkedIn user_id overlaps: ${userIdOverlaps.length}`);
  console.log(`Send queue overlaps: ${queueOverlaps.length}`);
  console.log(`Email queue overlaps: ${emailOverlaps.length}`);
}

checkWorkspaceContamination().catch(console.error);
