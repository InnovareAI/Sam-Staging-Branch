import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

console.log('🔍 Investigating 404 Error Source\n');

const id = '640207ac-7c6a-46ec-97ed-b12bdd28da49';

const { data: item } = await supabase
  .from('send_queue')
  .select('*')
  .eq('id', id)
  .single();

console.log('Queue Item Details:');
console.log('==================');
console.log('ID:', item.id);
console.log('LinkedIn User ID:', item.linkedin_user_id);
console.log('Message Type:', item.message_type);
console.log('Status:', item.status);
console.log('Error:', item.error_message);
console.log('Created:', item.created_at);
console.log('Updated:', item.updated_at);
console.log('Scheduled:', item.scheduled_for);

// Get campaign
const { data: campaign } = await supabase
  .from('campaigns')
  .select('*')
  .eq('id', item.campaign_id)
  .single();

console.log('\nCampaign:');
console.log('=========');
console.log('Name:', campaign.name);
console.log('Type:', campaign.campaign_type);
console.log('Messenger Enabled:', campaign.messenger_enabled);

console.log('\nANALYSIS:');
console.log('=========');
console.log('This is a', item.message_type, 'message');
console.log('LinkedIn ID format:', item.linkedin_user_id.startsWith('ACo') || item.linkedin_user_id.startsWith('ACw') ? 'Provider ID ✅' : 'Vanity slug');
console.log('Campaign type:', campaign.campaign_type);

console.log('\nWHY 404?');
console.log('========');
console.log('The error says "Cannot POST /api/v1/messages/send"');
console.log('This endpoint DOES NOT EXIST in Unipile API.');
console.log('\nPossible causes:');
console.log('1. Old script (direct-queue-processor.mjs) is still running');
console.log('2. Some other code is calling wrong endpoint');
console.log('3. Production code has a bug in the messenger message path');

console.log('\nProduction code should use:');
console.log('- Connection requests: POST /api/v1/users/invite');
console.log('- Direct messages: POST /api/v1/chats');
