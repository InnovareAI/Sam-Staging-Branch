require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Check email_queue for /messages/send errors
  const { data: emailFailed, error: emailError } = await supabase
    .from('email_queue')
    .select('id, campaign_id, error_message, status, updated_at')
    .eq('status', 'failed')
    .order('updated_at', { ascending: false })
    .limit(10);

  console.log('Email Queue Failed Items:');
  console.log('========================');

  if (emailError) {
    console.log('Error querying email_queue:', emailError.message);
  } else if (!emailFailed || emailFailed.length === 0) {
    console.log('No failed items in email_queue');
  } else {
    for (const item of emailFailed) {
      console.log('ID:', item.id);
      console.log('Campaign:', item.campaign_id);
      console.log('Error:', item.error_message?.substring(0, 150) || 'none');
      console.log('Updated:', item.updated_at);
      console.log('---');
    }
  }

  // Also check send_queue for the specific error
  console.log('\nSend Queue - Messages/Send Errors:');
  console.log('===================================');

  const { data: sendFailed } = await supabase
    .from('send_queue')
    .select('id, campaign_id, error_message, message_type, updated_at')
    .eq('status', 'failed')
    .ilike('error_message', '%messages/send%')
    .order('updated_at', { ascending: false })
    .limit(10);

  if (!sendFailed || sendFailed.length === 0) {
    console.log('No items with /messages/send error');
  } else {
    for (const item of sendFailed) {
      console.log('ID:', item.id);
      console.log('Campaign:', item.campaign_id);
      console.log('Type:', item.message_type);
      console.log('Error:', item.error_message?.substring(0, 100));
      console.log('---');
    }
  }
})();
