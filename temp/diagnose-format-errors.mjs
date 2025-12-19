import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

// Check one of the format error IDs
const queueId = '73d84dec-ab72-4813-ada8-6128c3dda877';

const { data: queueItem } = await supabase
  .from('send_queue')
  .select('*')
  .eq('id', queueId)
  .single();

console.log('Queue Item with format error:');
console.log('ID:', queueItem.id);
console.log('LinkedIn User ID:', queueItem.linkedin_user_id);
console.log('Message Type:', queueItem.message_type);
console.log('Status:', queueItem.status);
console.log('Error:', queueItem.error_message);
console.log('Created:', queueItem.created_at);
console.log('Updated:', queueItem.updated_at);
console.log('Scheduled:', queueItem.scheduled_for);

// Check the prospect
const { data: prospect } = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('id', queueItem.prospect_id)
  .single();

console.log('\nProspect:');
console.log('Name:', prospect.first_name, prospect.last_name);
console.log('LinkedIn URL:', prospect.linkedin_url);
console.log('LinkedIn User ID:', prospect.linkedin_user_id);

// Check the campaign
const { data: campaign } = await supabase
  .from('campaigns')
  .select('*')
  .eq('id', queueItem.campaign_id)
  .single();

console.log('\nCampaign:');
console.log('Name:', campaign.name);
console.log('Type:', campaign.campaign_type);
console.log('LinkedIn Account ID:', campaign.linkedin_account_id);

// Get the LinkedIn account
const { data: account } = await supabase
  .from('user_unipile_accounts')
  .select('*')
  .eq('id', campaign.linkedin_account_id)
  .single();

console.log('\nLinkedIn Account:');
console.log('Name:', account.account_name);
console.log('Unipile Account ID:', account.unipile_account_id);
console.log('Provider:', account.provider);

// Try to resolve the vanity slug manually
console.log('\n=======================');
console.log('RESOLUTION TEST');
console.log('=======================');
console.log('Attempting to resolve:', queueItem.linkedin_user_id);

const UNIPILE_DSN = 'api6.unipile.com:13670';
const UNIPILE_API_KEY = '85ZMr7iE.Pw5mVHOgvpPXOl47GXXXoW0uLPvOUK23bWXD+hHuziA=';

try {
  const encodedSlug = encodeURIComponent(queueItem.linkedin_user_id);
  const accountId = account.unipile_account_id;
  const url = `https://${UNIPILE_DSN}/api/v1/users/${encodedSlug}?account_id=${accountId}`;
  console.log('URL:', url);

  const response = await fetch(url, {
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Accept': 'application/json'
    }
  });

  console.log('Status:', response.status);
  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));

  if (data.provider_id) {
    console.log('\nSUCCESS! Resolved to:', data.provider_id);
  } else {
    console.log('\nFAILED: No provider_id in response');
  }
} catch (error) {
  console.error('ERROR:', error.message);
}
