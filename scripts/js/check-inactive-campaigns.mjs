#!/usr/bin/env node
/**
 * Check all inactive campaigns and identify incomplete data issues
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

async function checkInactiveCampaigns() {
  console.log('🔍 CHECKING INACTIVE CAMPAIGNS\n');
  console.log('='.repeat(70));
  
  // Get all inactive campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*, workspaces(name)')
    .eq('status', 'inactive')
    .order('updated_at', { ascending: false });
  
  console.log(`\nFound ${campaigns?.length || 0} inactive campaigns\n`);
  
  if (!campaigns || campaigns.length === 0) {
    console.log('✅ No inactive campaigns found');
    return;
  }
  
  for (const campaign of campaigns) {
    console.log('\n' + '='.repeat(70));
    console.log(`📊 Campaign: ${campaign.name}`);
    console.log(`   Workspace: ${campaign.workspaces?.name || 'Unknown'}`);
    console.log(`   Created: ${new Date(campaign.created_at).toLocaleDateString()}`);
    console.log(`   Last updated: ${new Date(campaign.updated_at).toLocaleString()}`);
    
    // Check prospects
    const { data: prospects } = await supabase
      .from('campaign_prospects')
      .select('*')
      .eq('campaign_id', campaign.id);
    
    console.log(`\n   📋 Prospects: ${prospects?.length || 0} total`);
    
    if (prospects && prospects.length > 0) {
      // Analyze data completeness
      const missingLinkedIn = prospects.filter(p => !p.linkedin_url);
      const missingName = prospects.filter(p => !p.first_name || !p.last_name);
      const missingCompany = prospects.filter(p => !p.company_name);
      const contacted = prospects.filter(p => p.contacted_at);
      
      console.log(`   ❌ Missing LinkedIn URL: ${missingLinkedIn.length}`);
      console.log(`   ❌ Missing name: ${missingName.length}`);
      console.log(`   ⚠️  Missing company: ${missingCompany.length}`);
      console.log(`   ✅ Already contacted: ${contacted.length}`);
      
      if (missingLinkedIn.length > 0) {
        console.log('\n   🔴 CRITICAL: Prospects missing LinkedIn URLs:');
        missingLinkedIn.slice(0, 3).forEach((p, i) => {
          console.log(`   ${i + 1}. ${p.first_name || 'Unknown'} ${p.last_name || ''}`);
          console.log(`      ID: ${p.id}`);
          console.log(`      Company: ${p.company_name || 'N/A'}`);
        });
      }
    }
    
    // Check message templates
    const hasConnection = campaign.connection_message || campaign.message_templates?.connection_request;
    const hasFollowUp = campaign.follow_up_messages?.length > 0 || campaign.message_templates?.follow_up_messages?.length > 0;
    
    console.log(`\n   💬 Message Templates:`);
    console.log(`   Connection message: ${hasConnection ? '✅' : '❌ MISSING'}`);
    console.log(`   Follow-up messages: ${hasFollowUp ? '✅' : '❌ MISSING'}`);
    
    // Check LinkedIn account
    const { data: account } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', campaign.workspace_id)
      .eq('user_id', campaign.created_by)
      .eq('account_type', 'linkedin')
      .eq('connection_status', 'connected')
      .single();
    
    console.log(`\n   🔗 LinkedIn Account: ${account ? '✅ Connected' : '❌ NOT CONNECTED'}`);
    
    // Determine why campaign is inactive
    const reasons = [];
    if (!prospects || prospects.length === 0) reasons.push('No prospects');
    if (prospects && prospects.filter(p => !p.linkedin_url).length === prospects.length) reasons.push('All prospects missing LinkedIn URLs');
    if (!hasConnection) reasons.push('Missing connection message');
    if (!account) reasons.push('No LinkedIn account connected');
    
    console.log(`\n   ⚠️  REASONS FOR INACTIVE STATUS:`);
    reasons.forEach(r => console.log(`      - ${r}`));
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));
  console.log(`\nTotal inactive campaigns: ${campaigns.length}`);
  console.log('\nAction needed: Check each campaign for missing data');
  console.log('\n' + '='.repeat(70));
}

checkInactiveCampaigns().catch(console.error);
