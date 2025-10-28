#!/usr/bin/env node

/**
 * List all campaigns to find one to test with
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listCampaigns() {
  try {
    console.log('📋 Listing campaigns with messages and prospects...\n');

    // Get all campaigns
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select(`
        id,
        name,
        status,
        connection_message,
        workspace_id,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Failed to fetch campaigns:', error.message);
      process.exit(1);
    }

    if (!campaigns || campaigns.length === 0) {
      console.log('⚠️  No campaigns found');
      process.exit(0);
    }

    console.log(`Found ${campaigns.length} recent campaigns:\n`);

    for (const campaign of campaigns) {
      // Count prospects
      const { count: prospectCount } = await supabase
        .from('campaign_prospects')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .in('status', ['pending', 'approved', 'ready_to_message']);

      // Check if has LinkedIn URLs
      const { count: linkedinCount } = await supabase
        .from('campaign_prospects')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .not('linkedin_url', 'is', null);

      const hasMessage = !!campaign.connection_message;
      const hasProspects = (prospectCount || 0) > 0;
      const hasLinkedIn = (linkedinCount || 0) > 0;
      const canTest = hasMessage && hasProspects && hasLinkedIn;

      console.log('─'.repeat(80));
      console.log(`Campaign: ${campaign.name}`);
      console.log(`ID: ${campaign.id}`);
      console.log(`Status: ${campaign.status}`);
      console.log(`Workspace: ${campaign.workspace_id}`);
      console.log(`Has message: ${hasMessage ? '✅' : '❌'}`);
      console.log(`Ready prospects: ${prospectCount || 0}`);
      console.log(`With LinkedIn URLs: ${linkedinCount || 0}`);
      console.log(`Can test: ${canTest ? '✅ YES' : '❌ NO'}`);

      if (hasMessage) {
        console.log(`\n📝 Connection message preview:`);
        console.log(campaign.connection_message.substring(0, 100) + '...');
      }

      if (canTest) {
        console.log(`\n🧪 Test command:`);
        console.log(`   node test-dry-run.mjs ${campaign.id}`);
      }
      console.log('');
    }

    console.log('─'.repeat(80));
    console.log('\n💡 To test a campaign, copy the command above and run it.');

  } catch (error) {
    console.error('💥 Error:', error.message);
    process.exit(1);
  }
}

listCampaigns();
