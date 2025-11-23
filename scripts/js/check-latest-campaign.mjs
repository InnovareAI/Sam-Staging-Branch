#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLatestCampaign() {
  const workspaceId = '96c03b38-a2f4-40de-9e16-43098599e1d4';
  
  console.log('\n🔍 CHECKING LATEST CAMPAIGN\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Get most recent campaign
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(3);

  if (campaigns && campaigns.length > 0) {
    console.log(`Found ${campaigns.length} recent campaigns:\n`);
    
    for (const campaign of campaigns) {
      console.log(`Campaign: ${campaign.name}`);
      console.log(`   ├─ ID: ${campaign.id}`);
      console.log(`   ├─ Status: ${campaign.status}`);
      console.log(`   ├─ Type: ${campaign.campaign_type}`);
      console.log(`   ├─ Created: ${new Date(campaign.created_at).toLocaleString()}`);
      
      // Check prospects for this campaign
      const { count: prospectCount } = await supabase
        .from('campaign_prospects')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id);
      
      console.log(`   └─ Prospects: ${prospectCount || 0} ${prospectCount > 0 ? '✅' : '❌'}\n`);
      
      // If this is the Mexico Marketing campaign, show prospect details
      if (campaign.name.includes('Mexico') || campaign.created_at > '2025-11-23T10:00:00') {
        const { data: prospects } = await supabase
          .from('campaign_prospects')
          .select('first_name, last_name, title, company_name, status')
          .eq('campaign_id', campaign.id)
          .limit(5);
        
        if (prospects && prospects.length > 0) {
          console.log('   Prospect Details:');
          prospects.forEach((p, i) => {
            console.log(`      ${i + 1}. ${p.first_name} ${p.last_name}`);
            console.log(`         ├─ Title: ${p.title || 'N/A'}`);
            console.log(`         ├─ Company: ${p.company_name || 'N/A'}`);
            console.log(`         └─ Status: ${p.status}\n`);
          });
        }
      }
    }
  }

  console.log('═══════════════════════════════════════════════════════════════\n');
}

checkLatestCampaign();
