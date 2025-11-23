require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getRecentSentMessagesByAddedBy(accountName) {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  console.log(`Searching for connection requests sent by accounts related to '${accountName}' in the last 24 hours...`);
  console.log(`Timeframe: After ${new Date(twentyFourHoursAgo).toLocaleString('en-US', { timeZone: 'America/New_York' })} (ET)`);
  console.log('---');

  // Fetch all sent messages in the last 24 hours and their associated prospect data
  const { data: messages, error: messagesError } = await supabase
    .from('send_queue')
    .select(`
      sent_at,
      status,
      campaign_prospects (
        first_name,
        last_name,
        linkedin_url,
        added_by_unipile_account
      )
    `)
    .eq('status', 'sent')
    .gt('sent_at', twentyFourHoursAgo)
    .not('campaign_prospects.added_by_unipile_account', 'is', null) // Ensure account data exists
    .order('sent_at', { ascending: false });

  if (messagesError) {
    console.error('Error fetching sent messages:', messagesError);
    return;
  }

  // Filter messages in application code for accounts related to 'Irish Maguad'
  const filteredMessages = messages.filter(msg => 
    msg.campaign_prospects && 
    msg.campaign_prospects.added_by_unipile_account && 
    msg.campaign_prospects.added_by_unipile_account.toLowerCase().includes(accountName.toLowerCase())
  );

  if (filteredMessages && filteredMessages.length > 0) {
    console.log(`--- ${filteredMessages.length} Connection Requests Sent by ~'${accountName}' in Last 24 Hours ---`);
    filteredMessages.forEach(msg => {
      const prospect = msg.campaign_prospects;
      const sentTime = new Date(msg.sent_at).toLocaleString('en-US', { timeZone: 'America/New_York' });
      console.log(`Prospect: ${prospect.first_name} ${prospect.last_name}`);
      console.log(`LinkedIn: ${prospect.linkedin_url || 'N/A'}`);
      console.log(`Sent At:  ${sentTime} (ET)`);
      console.log(`Account:  ${prospect.added_by_unipile_account}`);
      console.log('----------------------------------------');
    });
  } else {
    console.log(`No connection requests found for an account like '${accountName}' in the last 24 hours.`);
  }
}

getRecentSentMessagesByAddedBy('Irish Maguad');