// Check for existing prospects
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkProspects() {
  const campaignName = '20251104-BLL-test 5';

  console.log('🔍 Checking campaign prospects...\n');

  // Get campaign
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, campaign_type')
    .eq('name', campaignName)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!campaigns || campaigns.length === 0) {
    console.log('❌ Campaign not found');
    return;
  }

  const campaign = campaigns[0];
  console.log('✅ Campaign found:');
  console.log('   Name:', campaign.name);
  console.log('   ID:', campaign.id);
  console.log('   Status:', campaign.status);
  console.log('   Type:', campaign.campaign_type || 'messenger');

  // Get prospects
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, status, linkedin_url, contacted_at')
    .eq('campaign_id', campaign.id);

  console.log('\n📊 Total prospects:', prospects?.length || 0);

  if (prospects && prospects.length > 0) {
    // Group by status
    const byStatus = {};
    prospects.forEach(p => {
      if (!byStatus[p.status]) byStatus[p.status] = [];
      byStatus[p.status].push(p);
    });

    console.log('\n📋 Prospects by status:');
    Object.keys(byStatus).forEach(status => {
      console.log('  ', status + ':', byStatus[status].length);
    });

    console.log('\n👥 All prospects:');
    prospects.forEach((p, i) => {
      console.log('   ' + (i + 1) + '.', p.first_name, p.last_name);
      console.log('      Status:', p.status);
      console.log('      LinkedIn:', p.linkedin_url || '❌ MISSING');
      console.log('      Contacted:', p.contacted_at || 'Never');
    });
  }

  console.log('\n💡 Execute API looks for prospects with:');
  console.log('   - Status: pending, approved, or ready_to_message');
  console.log('   - contacted_at: NULL');
}

checkProspects().catch(console.error);
