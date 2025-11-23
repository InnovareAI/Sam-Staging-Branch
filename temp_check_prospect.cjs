require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkProspectStatus(firstName, lastName) {
  let query = supabase
    .from('campaign_prospects')
    .select(
      `
        id,
        first_name,
        last_name,
        status,
        linkedin_url,
        campaigns(campaign_name),
        send_queue(scheduled_for, sent_at, status)
      `
    )
    .or(`first_name.ilike.%${firstName}%,last_name.ilike.%${lastName}%`);

  const { data: prospects, error } = await query;

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (prospects && prospects.length > 0) {
    console.log(`--- Prospect Status for ${firstName} ${lastName} ---`);
    prospects.forEach(p => {
      console.log(`Name:        ${p.first_name} ${p.last_name}`);
      console.log(`LinkedIn URL: ${p.linkedin_url || 'N/A'}`);
      console.log(`Prospect Status: ${p.status.toUpperCase()}`);
      console.log(`Campaign:    ${p.campaigns ? p.campaigns.campaign_name : 'N/A'}`);
      if (p.send_queue && p.send_queue.length > 0) {
        p.send_queue.forEach(sq => {
          const scheduledTime = sq.scheduled_for ? new Date(sq.scheduled_for).toLocaleString('en-US', { timeZone: 'America/New_York' }) : 'N/A';
          const sentTime = sq.sent_at ? new Date(sq.sent_at).toLocaleString('en-US', { timeZone: 'America/New_York' }) : 'N/A';
          console.log(`  Message Status: ${sq.status.toUpperCase()}`);
          console.log(`  Scheduled:      ${scheduledTime} (ET)`);
          console.log(`  Executed:       ${sentTime} (ET)`);
        });
      } else {
        console.log('  No messages in send queue for this prospect.');
      }
      console.log('----------------------------------------');
    });
  } else {
    console.log(`Prospect '${firstName} ${lastName}' not found.`);
    console.log('Please double-check the spelling or provide more details.');
  }
}

checkProspectStatus('Tara', 'Ariyath');