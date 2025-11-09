#!/usr/bin/env node

/**
 * Transfer approved prospects to a campaign
 * Usage: node scripts/transfer-approved-prospects.js "campaign-name"
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function transferProspects(campaignName) {
  try {
    console.log(`\n🔍 Searching for campaign: "${campaignName}"\n`);

    // Find campaign by name
    const { data: campaigns, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .ilike('name', `%${campaignName}%`)
      .limit(5);

    if (campaignError) {
      console.error('❌ Error finding campaign:', campaignError.message);
      process.exit(1);
    }

    if (!campaigns || campaigns.length === 0) {
      console.error('❌ No campaigns found matching:', campaignName);
      process.exit(1);
    }

    if (campaigns.length > 1) {
      console.log('⚠️  Multiple campaigns found:');
      campaigns.forEach((c, i) => {
        console.log(`  ${i + 1}. ${c.name} (${c.id}) - Workspace: ${c.workspace_id}`);
      });
      console.log('\n💡 Using the first match. Re-run with more specific name if needed.\n');
    }

    const campaign = campaigns[0];
    console.log(`✅ Found campaign: ${campaign.name}`);
    console.log(`   ID: ${campaign.id}`);
    console.log(`   Workspace: ${campaign.workspace_id}\n`);

    // Get approved prospects matching this campaign name
    const { data: approvedProspects, error: prospectsError } = await supabase
      .from('prospect_approval_data')
      .select('*')
      .eq('approval_status', 'approved')
      .eq('campaign_name', campaign.name);

    if (prospectsError) {
      console.error('❌ Error fetching approved prospects:', prospectsError.message);
      process.exit(1);
    }

    if (!approvedProspects || approvedProspects.length === 0) {
      console.log('⚠️  No approved prospects found for this campaign');
      console.log('   Campaign name in approval data:', campaign.name);

      // Try to find ANY approved prospects to help debug
      const { data: anyApproved } = await supabase
        .from('prospect_approval_data')
        .select('campaign_name, approval_status')
        .eq('approval_status', 'approved')
        .limit(5);

      if (anyApproved && anyApproved.length > 0) {
        console.log('\n📋 Recent approved prospects with campaign names:');
        anyApproved.forEach(p => {
          console.log(`   - "${p.campaign_name}"`);
        });
      }

      process.exit(0);
    }

    console.log(`📊 Found ${approvedProspects.length} approved prospects\n`);

    // Transform and insert prospects
    const campaignProspects = approvedProspects.map(prospect => {
      const contact = prospect.contact || {};
      const linkedinUrl = contact.linkedin_url || contact.linkedinUrl || prospect.linkedin_url || null;

      // Extract names
      let firstName = contact.firstName || prospect.first_name || 'Unknown';
      let lastName = contact.lastName || prospect.last_name || 'User';

      if (linkedinUrl && (!contact.firstName || !contact.lastName)) {
        const match = linkedinUrl.match(/\/in\/([^\/\?]+)/);
        if (match) {
          const urlName = match[1].split('-');
          if (urlName.length > 0) firstName = urlName[0];
          if (urlName.length > 1) lastName = urlName.slice(1).join('-');
        }
      }

      return {
        campaign_id: campaign.id,
        workspace_id: campaign.workspace_id,
        first_name: firstName,
        last_name: lastName,
        email: contact.email || null,
        company_name: prospect.company?.name || contact.company || contact.companyName || '',
        linkedin_url: linkedinUrl,
        title: prospect.title || contact.title || contact.headline || '',
        location: prospect.location || contact.location || null,
        industry: prospect.company?.industry?.[0] || 'Not specified',
        status: 'approved',
        notes: null,
        personalization_data: {
          source: 'script_transfer',
          approval_data_id: prospect.id,
          transferred_at: new Date().toISOString()
        }
      };
    });

    console.log('💾 Inserting prospects into campaign_prospects...\n');

    const { data: inserted, error: insertError } = await supabase
      .from('campaign_prospects')
      .insert(campaignProspects)
      .select();

    if (insertError) {
      console.error('❌ Error inserting prospects:', insertError.message);
      process.exit(1);
    }

    console.log(`✅ Successfully transferred ${inserted.length} prospects!\n`);

    // Show sample
    console.log('📋 Sample prospects transferred:');
    inserted.slice(0, 5).forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.first_name} ${p.last_name} - ${p.company_name}`);
      if (p.linkedin_url) console.log(`      LinkedIn: ${p.linkedin_url}`);
    });

    if (inserted.length > 5) {
      console.log(`   ... and ${inserted.length - 5} more\n`);
    }

    // Get updated count
    const { count } = await supabase
      .from('campaign_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id);

    console.log(`\n📊 Campaign now has ${count} total prospects\n`);
    console.log('✅ Done! Refresh the Campaign Hub to see the update.\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

// Get campaign name from command line
const campaignName = process.argv[2] || '20251109-CLI-CSV Upload';

transferProspects(campaignName);
