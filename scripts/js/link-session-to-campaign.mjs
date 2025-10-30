#!/usr/bin/env node
/**
 * Check linkage between approval session and campaign
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLinkage() {
  console.log('🔗 CHECKING LINKAGE BETWEEN APPROVAL SESSION AND CAMPAIGN\n');
  console.log('='.repeat(70));
  
  // Find approval session
  const { data: session } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .ilike('campaign_name', '%test 2%')
    .single();
  
  console.log('\n📋 Approval Session:');
  console.log(`   Name: ${session.campaign_name}`);
  console.log(`   ID: ${session.id}`);
  console.log(`   Total prospects: ${session.total_prospects}`);
  
  // Get approved prospects
  const { data: approvedProspects } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('session_id', session.id)
    .eq('approval_status', 'approved');
  
  console.log(`   Approved prospects: ${approvedProspects?.length || 0}`);
  
  if (approvedProspects && approvedProspects.length > 0) {
    console.log('\n   ✅ Approved prospects details:');
    approvedProspects.forEach((p, i) => {
      console.log(`   ${i + 1}. Name: ${p.name || 'N/A'}`);
      console.log(`      LinkedIn: ${p.contact?.linkedin_url || 'N/A'}`);
      console.log(`      Title: ${p.title || 'N/A'}`);
      console.log(`      Company: ${p.company?.name || 'N/A'}`);
    });
  }
  
  // Find campaign with same name
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .ilike('name', '%test 2%')
    .single();
  
  if (campaign) {
    console.log(`\n\n📋 Campaign:`);
    console.log(`   Name: ${campaign.name}`);
    console.log(`   ID: ${campaign.id}`);
    console.log(`   Status: ${campaign.status}`);
    
    // Check prospects in campaign
    const { data: campaignProspects } = await supabase
      .from('campaign_prospects')
      .select('*')
      .eq('campaign_id', campaign.id);
    
    console.log(`   Prospects in campaign: ${campaignProspects?.length || 0}`);
    
    if (campaignProspects && campaignProspects.length > 0) {
      console.log('\n   ✅ Campaign has prospects');
    } else {
      console.log('\n   ❌ PROBLEM: Campaign has 0 prospects despite approved prospects existing!');
      console.log('\n   Root cause: The auto-transfer from POST /api/campaigns didn\'t work');
      console.log('   OR the campaign was created without a session_id parameter');
      
      console.log('\n\n🔧 FIX: Manually transfer approved prospects to campaign');
      console.log(`   Run: node scripts/js/fix-campaign-test-2.mjs`);
    }
  } else {
    console.log(`\n\n❌ No campaign found matching "test 2"`);
  }
  
  console.log('\n' + '='.repeat(70));
}

checkLinkage().catch(console.error);
