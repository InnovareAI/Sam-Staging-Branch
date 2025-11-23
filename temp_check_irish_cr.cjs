
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getRecentSentMessages(accountName) {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // First, find the unipile account id for the given name
  const { data: account, error: accountError } = await supabase
    .from('unipile_accounts')
    .select('id, name')
    .ilike('name', `%${accountName}%`)
    .limit(1)
    .single();

  if (accountError || !account) {
    console.error(`Error: Account '${accountName}' not found.`, accountError);
    return;
  }

  console.log(`Found account: ${account.name} (ID: ${account.id})`);
  console.log(`Checking for connection requests sent after ${new Date(twentyFourHoursAgo).toLocaleString('en-US', { timeZone: 'America/New_York' })} (ET)`);
  console.log('---');

  // Now, find the sent messages from the send_queue for that account
  const { data: messages, error: messagesError } = await supabase
    .from('send_queue')
    .select(`
      sent_at,
      status,
      campaign_prospects (
        first_name,
        last_name,
        linkedin_url
      )
    `)
    .eq('unipile_account_id', account.id)
    .eq('status', 'sent')
    .gt('sent_at', twentyFourHoursAgo)
    .order('sent_at', { ascending: false });

  if (messagesError) {
    console.error('Error fetching sent messages:', messagesError);
    return;
  }

  if (messages && messages.length > 0) {
    console.log(`--- ${messages.length} Connection Requests Sent by ${account.name} in Last 24 Hours ---`);
    messages.forEach(msg => {
      const prospect = msg.campaign_prospects;
      if (prospect) {
        const sentTime = new Date(msg.sent_at).toLocaleString('en-US', { timeZone: 'America/New_York' });
        console.log(`Prospect: ${prospect.first_name} ${prospect.last_name}`);
        console.log(`LinkedIn: ${prospect.linkedin_url || 'N/A'}`);
        console.log(`Sent At:  ${sentTime} (ET)`);
        console.log('----------------------------------------');
      }
    });
  } else {
    console.log(`No connection requests sent by ${account.name} in the last 24 hours.`);
  }
}

// The name might be 'Irish Maguad' or just 'Irish'
getRecentSentMessages('Irish');
