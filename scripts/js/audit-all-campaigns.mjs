#!/usr/bin/env node
/**
 * Audit ALL campaigns for data completeness issues
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

async function auditAllCampaigns() {
  console.log('🔍 AUDITING ALL CAMPAIGNS FOR DATA COMPLETENESS\n');
  console.log('='.repeat(70));
  
  // Get all campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*, workspaces(name)')
    .order('created_at', { ascending: false })
    .limit(20);
  
  console.log(`\nFound ${campaigns?.length || 0} recent campaigns\n`);
  
  if (!campaigns || campaigns.length === 0) {
    console.log('❌ No campaigns found');
    return;
  }
  
  const issues = [];
  
  for (const campaign of campaigns) {
    const campaignIssues = [];
    
    // Check prospects
    const { data: prospects } = await supabase
      .from('campaign_prospects')
      .select('*')
      .eq('campaign_id', campaign.id);
    
    const prospectCount = prospects?.length || 0;
    const missingLinkedIn = prospects?.filter(p => !p.linkedin_url).length || 0;
    const missingName = prospects?.filter(p => !p.first_name || !p.last_name).length || 0;
    const ready = prospects?.filter(p => 
      !p.contacted_at && 
      p.linkedin_url && 
      ['pending', 'approved', 'ready_to_message'].includes(p.status)
    ).length || 0;
    
    // Check message templates
    const hasConnection = campaign.connection_message || campaign.message_templates?.connection_request;
    const hasFollowUp = campaign.follow_up_messages?.length > 0 || campaign.message_templates?.follow_up_messages?.length > 0;
    
    // Check LinkedIn account
    const { data: account } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', campaign.workspace_id)
      .eq('user_id', campaign.created_by)
      .eq('account_type', 'linkedin')
      .eq('connection_status', 'connected')
      .maybeSingle();
    
    // Identify issues
    if (prospectCount === 0) {
      campaignIssues.push('No prospects');
    }
    if (missingLinkedIn > 0) {
      campaignIssues.push(`${missingLinkedIn}/${prospectCount} prospects missing LinkedIn URL`);
    }
    if (missingName > 0) {
      campaignIssues.push(`${missingName}/${prospectCount} prospects missing name`);
    }
    if (!hasConnection) {
      campaignIssues.push('No connection message');
    }
    if (!account) {
      campaignIssues.push('No LinkedIn account');
    }
    if (ready === 0 && prospectCount > 0) {
      campaignIssues.push('No prospects ready to message');
    }
    
    if (campaignIssues.length > 0) {
      issues.push({
        campaign,
        issues: campaignIssues,
        prospectCount,
        missingLinkedIn,
        ready
      });
      
      console.log('⚠️  ' + '='.repeat(66));
      console.log(`📊 ${campaign.name}`);
      console.log(`   Workspace: ${campaign.workspaces?.name || 'Unknown'}`);
      console.log(`   Status: ${campaign.status}`);
      console.log(`   Created: ${new Date(campaign.created_at).toLocaleDateString()}`);
      console.log(`\n   🔴 ISSUES:`);
      campaignIssues.forEach(issue => console.log(`      - ${issue}`));
      console.log('');
    }
  }
  
  console.log('='.repeat(70));
  console.log('📊 AUDIT SUMMARY');
  console.log('='.repeat(70));
  console.log(`\nTotal campaigns audited: ${campaigns.length}`);
  console.log(`Campaigns with issues: ${issues.length}`);
  
  if (issues.length > 0) {
    console.log('\n🔴 COMMON ISSUES:');
    const issueTypes = {};
    issues.forEach(({ issues: campaignIssues }) => {
      campaignIssues.forEach(issue => {
        issueTypes[issue] = (issueTypes[issue] || 0) + 1;
      });
    });
    
    Object.entries(issueTypes)
      .sort((a, b) => b[1] - a[1])
      .forEach(([issue, count]) => {
        console.log(`   ${count}x - ${issue}`);
      });
  } else {
    console.log('\n✅ All campaigns have complete data');
  }
  
  console.log('\n' + '='.repeat(70));
}

auditAllCampaigns().catch(console.error);
