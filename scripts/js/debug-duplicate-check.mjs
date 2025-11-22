import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugDuplicateCheck() {
  const campaignId = 'd74d38c2-bd2c-4522-b503-72eda6350983';
  const linkedinUrl = 'http://www.linkedin.com/in/bradleybreton';

  console.log('🔍 Debugging duplicate detection logic...\n');
  console.log(`Campaign ID: ${campaignId}`);
  console.log(`LinkedIn URL: ${linkedinUrl}\n`);

  // This is the EXACT query from line 124-130
  console.log('Query 1: Check if exists in OTHER campaigns (neq campaign_id)');
  const { data: existingInOtherCampaign, error: error1 } = await supabase
    .from('campaign_prospects')
    .select('status, contacted_at, campaign_id, campaigns(campaign_name)')
    .eq('linkedin_url', linkedinUrl)
    .neq('campaign_id', campaignId)  // Must be in a DIFFERENT campaign
    .limit(1)
    .single();

  console.log('Result:', existingInOtherCampaign);
  console.log('Error:', error1);
  console.log('Would trigger duplicate?', existingInOtherCampaign ? 'YES ⚠️' : 'NO ✅');
  console.log('');

  // This is the EXACT query from line 156-163
  console.log('Query 2: Check if already contacted in THIS campaign (eq campaign_id)');
  const { data: existingInThisCampaign, error: error2 } = await supabase
    .from('campaign_prospects')
    .select('status, contacted_at')
    .eq('linkedin_url', linkedinUrl)
    .eq('campaign_id', campaignId)
    .in('status', ['connection_request_sent', 'connected', 'messaging', 'replied'])
    .limit(1)
    .single();

  console.log('Result:', existingInThisCampaign);
  console.log('Error:', error2);
  console.log('Would skip?', existingInThisCampaign ? 'YES ⚠️' : 'NO ✅');
  console.log('');

  // Also check ALL entries for this LinkedIn URL
  console.log('Query 3: ALL entries for this LinkedIn URL');
  const { data: allEntries } = await supabase
    .from('campaign_prospects')
    .select('id, campaign_id, status, contacted_at, campaigns(campaign_name)')
    .eq('linkedin_url', linkedinUrl);

  console.log(`Found ${allEntries.length} total entries:`);
  allEntries.forEach((e, i) => {
    console.log(`  ${i + 1}. Campaign: ${e.campaigns?.campaign_name || 'null'} (${e.campaign_id})`);
    console.log(`     Status: ${e.status}, Contacted: ${e.contacted_at || 'Never'}`);
  });
}

debugDuplicateCheck().catch(console.error);
