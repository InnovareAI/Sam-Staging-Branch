// Check for campaign sequences and templates
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCampaignSequences() {
  const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

  console.log('🔍 CHECKING FOR CAMPAIGN SEQUENCES AND MESSAGE TEMPLATES\n');

  // Get all campaigns and inspect their full structure
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  console.log(`📊 Found ${campaigns?.length || 0} campaigns\n`);

  for (const campaign of campaigns || []) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Campaign: ${campaign.name}`);
    console.log(`Status: ${campaign.status}`);
    console.log(`Created: ${new Date(campaign.created_at).toLocaleString()}\n`);

    // List all fields that might contain sequences
    const sequenceFields = [
      'message_sequence',
      'messages',
      'sequence',
      'template',
      'message_template',
      'initial_message',
      'follow_up_messages',
      'linkedin_message',
      'email_message',
      'personalization_template'
    ];

    console.log('📝 Sequence-related fields:');

    for (const field of sequenceFields) {
      if (campaign[field] !== undefined && campaign[field] !== null) {
        const value = campaign[field];
        const preview = typeof value === 'string'
          ? value.substring(0, 100)
          : JSON.stringify(value).substring(0, 100);

        console.log(`   ✅ ${field}: ${preview}${preview.length >= 100 ? '...' : ''}`);
      }
    }

    // Show all non-null fields
    console.log('\n📋 All populated fields:');
    Object.keys(campaign).forEach(key => {
      if (campaign[key] !== null && campaign[key] !== undefined) {
        const value = campaign[key];
        const type = typeof value;
        const preview = type === 'object'
          ? `[${type}]`
          : type === 'string' && value.length > 50
          ? value.substring(0, 50) + '...'
          : value;

        console.log(`   - ${key}: ${preview}`);
      }
    });
  }

  console.log(`\n\n${'='.repeat(80)}\n`);

  // Check if there's a separate templates table
  console.log('🔍 Checking for message templates table...\n');

  // Try to query common template table names
  const templateTableNames = [
    'message_templates',
    'campaign_templates',
    'email_templates',
    'linkedin_templates',
    'sequences',
    'message_sequences'
  ];

  for (const tableName of templateTableNames) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('workspace_id', workspaceId)
        .limit(1);

      if (!error) {
        console.log(`   ✅ Found table: ${tableName}`);
        if (data && data.length > 0) {
          console.log(`      Has data: ${data.length} records`);
        }
      }
    } catch (e) {
      // Table doesn't exist, skip
    }
  }

  console.log('\n✅ Sequence check complete!\n');
}

checkCampaignSequences().catch(console.error);
