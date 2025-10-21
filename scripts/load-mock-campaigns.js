/**
 * Load Mock Campaigns into Database
 * Temporary script to create real campaigns from mock data for testing
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const mockCampaigns = [
  {
    name: 'Q4 SaaS Outreach',
    status: 'active',
    campaign_type: 'connector',
    description: 'Quarterly outreach campaign targeting SaaS decision makers',
    message_templates: {
      connection_message: 'Hi {first_name}, impressed by your work at {company_name}. Would love to connect!',
      follow_up_messages: [
        'Thanks for connecting! What are your biggest challenges in Q4?'
      ]
    }
  },
  {
    name: 'Holiday Networking Campaign',
    status: 'active',
    campaign_type: 'messenger',
    description: 'End-of-year networking with existing connections',
    message_templates: {
      initial_message: 'Hi {first_name}! Hope you have great holidays! Wanted to catch up.',
      follow_up_messages: [
        'How has {company_name} been doing this year?'
      ]
    }
  },
  {
    name: 'Company Page Growth',
    status: 'active',
    campaign_type: 'company_follow',
    description: 'Build company page followers and engagement',
    message_templates: {}
  },
  {
    name: 'Inbound Lead Follow-up',
    status: 'active',
    campaign_type: 'inbound',
    description: 'Follow up with inbound leads from website',
    message_templates: {
      initial_message: 'Hi {first_name}, thanks for your interest! Happy to answer any questions.',
      follow_up_messages: [
        'Did you get a chance to review our solution?'
      ]
    }
  },
  {
    name: 'Email Newsletter Campaign',
    status: 'completed',
    campaign_type: 'email',
    description: 'Monthly email newsletter to subscribers',
    message_templates: {
      subject: 'Latest Updates from {company_name}',
      body: 'Hi {first_name}, here are this month\'s highlights...'
    }
  }
];

async function loadMockCampaigns() {
  try {
    console.log('🔄 Loading mock campaigns into database...\n');

    // Get all workspaces
    const { data: workspaces, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name');

    if (workspaceError) {
      throw new Error(`Failed to fetch workspaces: ${workspaceError.message}`);
    }

    if (!workspaces || workspaces.length === 0) {
      throw new Error('No workspaces found. Please create a workspace first.');
    }

    console.log(`Found ${workspaces.length} workspace(s):`);
    workspaces.forEach(w => console.log(`  - ${w.name} (${w.id})`));
    console.log();

    // Use InnovareAI workspace (or first if not found)
    const innovareWorkspace = workspaces.find(w => w.name.toLowerCase().includes('innovare'));
    const workspace = innovareWorkspace || workspaces[0];
    const workspaceId = workspace.id;
    console.log(`Using workspace: ${workspace.name}\n`);

    // Check if mock campaigns already exist
    const { data: existing } = await supabase
      .from('campaigns')
      .select('name')
      .eq('workspace_id', workspaceId)
      .in('name', mockCampaigns.map(c => c.name));

    if (existing && existing.length > 0) {
      console.log(`⚠️  Found ${existing.length} existing campaign(s):`);
      existing.forEach(c => console.log(`  - ${c.name}`));
      console.log('\n❌ Skipping to avoid duplicates. Delete these campaigns first if you want to reload.');
      return;
    }

    // Insert mock campaigns
    console.log(`Creating ${mockCampaigns.length} mock campaigns...\n`);

    for (const campaign of mockCampaigns) {
      try {
        // Use the create_campaign RPC function
        const { data: campaignId, error } = await supabase
          .rpc('create_campaign', {
            p_workspace_id: workspaceId,
            p_name: campaign.name,
            p_description: campaign.description,
            p_campaign_type: campaign.campaign_type,
            p_target_icp: {},
            p_ab_test_variant: null,
            p_message_templates: campaign.message_templates
          });

        if (error) {
          console.error(`  ❌ Failed to create "${campaign.name}": ${error.message}`);
          continue;
        }

        // Update status
        await supabase
          .from('campaigns')
          .update({ status: campaign.status })
          .eq('id', campaignId);

        console.log(`  ✅ Created "${campaign.name}" (${campaign.status})`);
      } catch (error) {
        console.error(`  ❌ Error creating "${campaign.name}":`, error.message);
      }
    }

    console.log('\n✅ Mock campaigns loaded successfully!');
    console.log('\n📊 Summary:');
    console.log(`  Workspace: ${workspaces[0].name}`);
    console.log(`  Campaigns created: ${mockCampaigns.length}`);
    console.log('\n💡 You can now test campaign status updates in the Campaign Hub.');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

loadMockCampaigns();
