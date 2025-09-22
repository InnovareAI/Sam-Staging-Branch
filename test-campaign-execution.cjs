#!/usr/bin/env node

/**
 * Test Campaign Execution Script
 * 
 * This script tests the campaign creation and execution flow
 * using the real prospect data from charissa-test-campaign.csv
 */

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Read environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCampaignExecution() {
  try {
    console.log('🚀 Starting Campaign Test...\n');

    // 1. Read the CSV data
    const csvData = fs.readFileSync('./charissa-test-campaign.csv', 'utf8');
    const lines = csvData.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',');
    
    const prospects = lines.slice(1).map(line => {
      const values = line.split(',');
      return {
        first_name: values[0],
        last_name: values[1], 
        company_name: values[2],
        job_title: values[3],
        linkedin_profile_url: values[4],
        email_address: values[5],
        location: values[6],
        industry: values[7]
      };
    });

    console.log(`📊 Found ${prospects.length} prospects:`);
    prospects.forEach((p, i) => {
      console.log(`${i + 1}. ${p.first_name} ${p.last_name} - ${p.job_title} at ${p.company_name}`);
    });
    console.log('');

    // 2. Get workspace (use existing workspace)
    const { data: workspaces, error: workspaceError } = await supabase
      .from('workspaces')
      .select('*')
      .limit(1);

    if (workspaceError || !workspaces?.length) {
      throw new Error('No workspace found');
    }

    const workspace = workspaces[0];
    console.log(`🏢 Using workspace: ${workspace.name} (${workspace.id})\n`);

    // 3. Create campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        workspace_id: workspace.id,
        name: 'Charissa Test Campaign',
        description: 'Test campaign with real prospects - LinkedIn Playbook A/B test',
        type: 'linkedin',
        status: 'draft',
        settings: {
          message_template: "Hi {first_name}, I work for InnovareAI, an AI company known for its innovative workflow automation and AI agent solutions. I'm always interested in connecting with like-minded individuals who want to learn all things AI. Would you be open to connecting?",
          variant: 'A',
          approval_required: true,
          daily_limit: 20
        }
      })
      .select()
      .single();

    if (campaignError) {
      throw new Error(`Campaign creation failed: ${campaignError.message}`);
    }

    console.log(`✅ Created campaign: ${campaign.name} (${campaign.id})\n`);

    // 4. Add prospects to workspace and campaign
    let addedProspects = 0;
    for (const prospect of prospects) {
      try {
        // Add to prospects table
        const { data: prospectData, error: prospectError } = await supabase
          .from('prospects')
          .upsert({
            workspace_id: workspace.id,
            name: `${prospect.first_name} ${prospect.last_name}`,
            first_name: prospect.first_name,
            last_name: prospect.last_name,
            email: prospect.email_address,
            company: prospect.company_name,
            title: prospect.job_title,
            location: prospect.location,
            profile_url: prospect.linkedin_profile_url,
            connection_status: 'not_connected',
            metadata: {
              industry: prospect.industry,
              source: 'csv_upload'
            }
          }, { onConflict: 'workspace_id,profile_url' })
          .select()
          .single();

        if (prospectError) {
          console.error(`❌ Failed to add ${prospect.first_name} ${prospect.last_name}:`, prospectError.message);
          continue;
        }

        // Add to campaign_prospects
        const { error: campaignProspectError } = await supabase
          .from('campaign_prospects')
          .insert({
            campaign_id: campaign.id,
            prospect_id: prospectData.id,
            status: 'pending'
          });

        if (campaignProspectError) {
          console.error(`❌ Failed to add ${prospect.first_name} ${prospect.last_name} to campaign:`, campaignProspectError.message);
          continue;
        }

        addedProspects++;
        console.log(`✅ Added ${prospect.first_name} ${prospect.last_name} to campaign`);
      } catch (error) {
        console.error(`❌ Error with ${prospect.first_name} ${prospect.last_name}:`, error.message);
      }
    }

    console.log(`\n📊 Successfully added ${addedProspects}/${prospects.length} prospects to campaign\n`);

    // 5. Activate campaign
    const { error: activateError } = await supabase
      .from('campaigns')
      .update({ status: 'active' })
      .eq('id', campaign.id);

    if (activateError) {
      throw new Error(`Campaign activation failed: ${activateError.message}`);
    }

    console.log('✅ Campaign activated and ready for execution\n');

    // 6. Show execution instructions
    console.log('🎯 Campaign is ready! To execute:');
    console.log('1. Make sure LinkedIn accounts are connected and working');
    console.log('2. Use the campaign execution API:');
    console.log(`   POST /api/campaigns/linkedin/execute`);
    console.log(`   Body: { "campaignId": "${campaign.id}" }`);
    console.log('');
    console.log('📋 Campaign Details:');
    console.log(`   - Campaign ID: ${campaign.id}`);
    console.log(`   - Prospects: ${addedProspects}`);
    console.log(`   - Status: active`);
    console.log(`   - Daily Limit: ${campaign.daily_limit}`);
    console.log('');

    return { campaignId: campaign.id, prospectsAdded: addedProspects };

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testCampaignExecution()
    .then(result => {
      console.log('🎉 Test completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testCampaignExecution };