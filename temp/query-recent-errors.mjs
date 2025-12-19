import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function queryRecentErrors() {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  console.log('🔍 Querying send_queue for errors in last 30 minutes...\n');
  console.log('Time threshold:', thirtyMinutesAgo);

  const { data: errors, error } = await supabase
    .from('send_queue')
    .select('*')
    .eq('status', 'failed')
    .gte('updated_at', thirtyMinutesAgo)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('❌ Query error:', error);
    return;
  }

  const errorCount = errors ? errors.length : 0;
  console.log(`\n📊 Found ${errorCount} failed entries\n`);

  if (!errors || errors.length === 0) {
    console.log('No errors found in the last 30 minutes.');
    return;
  }

  // Group by error type
  const errorsByType = {};
  const formatErrors = [];
  const endpointErrors = [];

  errors.forEach(entry => {
    const errorMsg = entry.error_message || '';

    // Categorize errors
    if (errorMsg.includes('Cannot POST /api/v1/messages/send')) {
      endpointErrors.push(entry);
      errorsByType['404_endpoint'] = (errorsByType['404_endpoint'] || 0) + 1;
    } else if (errorMsg.includes('expected format')) {
      formatErrors.push(entry);
      errorsByType['format_error'] = (errorsByType['format_error'] || 0) + 1;
    } else {
      const key = errorMsg.substring(0, 50);
      errorsByType[key] = (errorsByType[key] || 0) + 1;
    }
  });

  console.log('📋 ERROR BREAKDOWN:');
  console.log('==================');
  Object.entries(errorsByType).forEach(([type, count]) => {
    console.log(`${type}: ${count}`);
  });

  if (endpointErrors.length > 0) {
    console.log('\n\n🚨 404 ENDPOINT ERRORS:');
    console.log('=======================');
    endpointErrors.slice(0, 3).forEach(entry => {
      console.log('\nID:', entry.id);
      console.log('Campaign ID:', entry.campaign_id);
      console.log('Prospect ID:', entry.prospect_id);
      console.log('Message Type:', entry.message_type);
      console.log('LinkedIn User ID:', entry.linkedin_user_id);
      console.log('Error:', entry.error_message);
      console.log('Updated:', entry.updated_at);
    });
  }

  if (formatErrors.length > 0) {
    console.log('\n\n🚨 FORMAT ERRORS:');
    console.log('=================');
    formatErrors.slice(0, 5).forEach(entry => {
      console.log('\nID:', entry.id);
      console.log('Campaign ID:', entry.campaign_id);
      console.log('Prospect ID:', entry.prospect_id);
      console.log('LinkedIn User ID:', entry.linkedin_user_id);
      console.log('Error:', entry.error_message);
      console.log('Updated:', entry.updated_at);
    });

    // Show all unique linkedin_user_id values causing format errors
    console.log('\n📋 All LinkedIn User IDs causing format errors:');
    const uniqueIds = [...new Set(formatErrors.map(e => e.linkedin_user_id))];
    uniqueIds.forEach(id => {
      console.log(`  - "${id}"`);
    });
  }

  // Check campaign types
  console.log('\n\n🎯 CAMPAIGN TYPE ANALYSIS:');
  console.log('===========================');
  const campaignIds = [...new Set(errors.map(e => e.campaign_id))];

  for (const campaignId of campaignIds) {
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, name, campaign_type, messenger_enabled')
      .eq('id', campaignId)
      .single();

    if (campaign) {
      const errorsForCampaign = errors.filter(e => e.campaign_id === campaignId);
      const typeValue = campaign.campaign_type || 'linkedin_only';
      console.log(`\nCampaign: ${campaign.name}`);
      console.log(`  Type: ${typeValue}`);
      console.log(`  Messenger: ${campaign.messenger_enabled ? 'YES' : 'NO'}`);
      console.log(`  Errors: ${errorsForCampaign.length}`);

      const errorTypes = [...new Set(errorsForCampaign.map(e => {
        const msg = e.error_message || '';
        if (msg.includes('Cannot POST')) return '404_endpoint';
        if (msg.includes('format')) return 'format_error';
        return 'other';
      }))];
      console.log(`  Error types: ${errorTypes.join(', ')}`);
    }
  }
}

queryRecentErrors();
