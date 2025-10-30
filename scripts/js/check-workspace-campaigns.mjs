#!/usr/bin/env node
/**
 * Check all campaigns in workspace for issues
 * Identifies stuck, incomplete, or problematic campaigns
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

const WORKSPACE_ID = 'a03ba456-b2d5-44c1-80b8-c09aa26f8a2a'; // InnovareAI

async function checkWorkspaceCampaigns() {
  console.log('🔍 WORKSPACE CAMPAIGN HEALTH CHECK\n');
  console.log('=' .repeat(70));

  // Get all campaigns for workspace
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('workspace_id', WORKSPACE_ID)
    .order('created_at', { ascending: false });

  console.log(`\n📊 Found ${campaigns.length} campaigns in workspace\n`);

  const issues = [];
  const healthy = [];

  for (const campaign of campaigns) {
    const { data: prospects } = await supabase
      .from('campaign_prospects')
      .select('*')
      .eq('campaign_id', campaign.id);

    const ready = prospects?.filter(p =>
      !p.contacted_at &&
      p.linkedin_url &&
      ['pending', 'approved', 'ready_to_message'].includes(p.status)
    ).length || 0;

    const queued = prospects?.filter(p => p.status === 'queued_in_n8n').length || 0;
    const contacted = prospects?.filter(p => p.contacted_at).length || 0;
    const failed = prospects?.filter(p => p.status === 'failed').length || 0;
    const total = prospects?.length || 0;

    const hasIssues =
      (campaign.status === 'active' && total === 0) || // Active but no prospects
      (failed > 0) || // Has failures
      (queued > 0 && ready === 0 && contacted === 0); // Only queued, nothing else

    const campaignInfo = {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      created: new Date(campaign.created_at).toLocaleDateString(),
      total,
      ready,
      queued,
      contacted,
      failed
    };

    if (hasIssues) {
      issues.push(campaignInfo);
    } else {
      healthy.push(campaignInfo);
    }
  }

  // Display healthy campaigns
  if (healthy.length > 0) {
    console.log('✅ HEALTHY CAMPAIGNS (' + healthy.length + ')');
    console.log('-'.repeat(70));
    healthy.forEach(c => {
      console.log(`\n   📋 ${c.name}`);
      console.log(`      ID: ${c.id}`);
      console.log(`      Status: ${c.status.toUpperCase()}`);
      console.log(`      Created: ${c.created}`);
      console.log(`      Prospects: ${c.total} total | ${c.ready} ready | ${c.queued} queued | ${c.contacted} contacted`);
    });
  }

  // Display campaigns with issues
  if (issues.length > 0) {
    console.log('\n\n⚠️  CAMPAIGNS WITH ISSUES (' + issues.length + ')');
    console.log('-'.repeat(70));
    issues.forEach(c => {
      console.log(`\n   📋 ${c.name}`);
      console.log(`      ID: ${c.id}`);
      console.log(`      Status: ${c.status.toUpperCase()}`);
      console.log(`      Created: ${c.created}`);
      console.log(`      Prospects: ${c.total} total | ${c.ready} ready | ${c.queued} queued | ${c.contacted} contacted`);

      // Identify specific issues
      if (c.status === 'active' && c.total === 0) {
        console.log(`      ⚠️  Issue: Active campaign with no prospects`);
      }
      if (c.failed > 0) {
        console.log(`      ⚠️  Issue: ${c.failed} failed prospects`);
      }
      if (c.queued > 0 && c.ready === 0 && c.contacted === 0) {
        console.log(`      ⚠️  Issue: Prospects stuck in queued status`);
      }
    });
  }

  // Summary
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));
  console.log(`\n   Total campaigns: ${campaigns.length}`);
  console.log(`   Healthy: ${healthy.length}`);
  console.log(`   With issues: ${issues.length}`);

  if (issues.length > 0) {
    console.log('\n   💡 RECOMMENDATIONS:');
    console.log('   1. Review campaigns with issues above');
    console.log('   2. Fix specific issues rather than removing all campaigns');
    console.log('   3. Active campaigns with 0 prospects can be safely deleted');
    console.log('   4. Campaigns with failed prospects may need message template review');
  } else {
    console.log('\n   ✅ All campaigns are healthy!');
  }

  console.log('\n' + '='.repeat(70));
}

checkWorkspaceCampaigns().catch(console.error);
