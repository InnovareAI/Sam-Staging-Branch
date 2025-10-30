#!/usr/bin/env node
/**
 * Automatically fix ALL campaigns with 0 prospects by transferring approved prospects
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

async function autoFixEmptyCampaigns() {
  console.log('🔧 AUTO-FIXING CAMPAIGNS WITH 0 PROSPECTS\n');
  console.log('='.repeat(70));
  
  // Get all campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*, workspaces(name)')
    .order('created_at', { ascending: false });
  
  console.log(`\nChecking ${campaigns?.length || 0} campaigns...\n`);
  
  if (!campaigns || campaigns.length === 0) {
    console.log('❌ No campaigns found');
    return;
  }
  
  let fixedCount = 0;
  let skippedCount = 0;
  
  for (const campaign of campaigns) {
    // Count prospects
    const { count: prospectCount } = await supabase
      .from('campaign_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id);
    
    if (prospectCount && prospectCount > 0) {
      skippedCount++;
      continue; // Campaign already has prospects
    }
    
    console.log('\n' + '='.repeat(70));
    console.log(`📋 Empty Campaign: ${campaign.name}`);
    console.log(`   Workspace: ${campaign.workspaces?.name || 'Unknown'}`);
    console.log(`   Created: ${new Date(campaign.created_at).toLocaleDateString()}`);
    
    // Try to find matching approval session by campaign name
    const { data: session } = await supabase
      .from('prospect_approval_sessions')
      .select('*')
      .eq('workspace_id', campaign.workspace_id)
      .eq('campaign_name', campaign.name)
      .maybeSingle();
    
    if (!session) {
      console.log(`   ⚠️  No matching approval session found`);
      continue;
    }
    
    console.log(`   ✅ Found matching session: ${session.id}`);
    
    // Get approved prospects
    const { data: approvedProspects } = await supabase
      .from('prospect_approval_data')
      .select('*')
      .eq('session_id', session.id)
      .eq('approval_status', 'approved');
    
    if (!approvedProspects || approvedProspects.length === 0) {
      console.log(`   ⚠️  No approved prospects in session`);
      continue;
    }
    
    console.log(`   📊 Found ${approvedProspects.length} approved prospects`);
    
    // Transform and insert
    const campaignProspects = approvedProspects.map(prospect => {
      const contact = prospect.contact || {};
      const linkedinUrl = contact.linkedin_url || contact.linkedinUrl || prospect.linkedin_url;
      
      let firstName = 'Unknown';
      let lastName = 'User';
      
      if (prospect.name) {
        const nameParts = prospect.name.split(' ');
        firstName = nameParts[0] || 'Unknown';
        lastName = nameParts.slice(1).join(' ') || 'User';
      } else if (linkedinUrl) {
        const match = linkedinUrl.match(/\/in\/([^\/\?]+)/);
        if (match) {
          const urlName = match[1].split('-');
          firstName = urlName[0] ? urlName[0].charAt(0).toUpperCase() + urlName[0].slice(1) : 'Unknown';
          lastName = urlName.length > 1 ? urlName.slice(1).join('-') : 'User';
        }
      }
      
      return {
        campaign_id: campaign.id,
        workspace_id: campaign.workspace_id,
        first_name: firstName,
        last_name: lastName,
        email: contact.email || null,
        company_name: prospect.company?.name || '',
        linkedin_url: linkedinUrl,
        title: prospect.title || '',
        location: prospect.location || null,
        industry: prospect.company?.industry || 'Not specified',
        status: 'approved',
        personalization_data: {
          source: 'approval_session',
          session_id: session.id,
          approved_at: new Date().toISOString()
        }
      };
    });
    
    const { data: inserted, error } = await supabase
      .from('campaign_prospects')
      .insert(campaignProspects)
      .select();
    
    if (error) {
      console.log(`   ❌ Error: ${error.message}`);
    } else {
      console.log(`   ✅ Transferred ${inserted.length} prospects`);
      fixedCount++;
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 AUTO-FIX SUMMARY');
  console.log('='.repeat(70));
  console.log(`\n   Total campaigns: ${campaigns.length}`);
  console.log(`   Fixed: ${fixedCount}`);
  console.log(`   Skipped (already have prospects): ${skippedCount}`);
  console.log('\n' + '='.repeat(70));
}

autoFixEmptyCampaigns().catch(console.error);
