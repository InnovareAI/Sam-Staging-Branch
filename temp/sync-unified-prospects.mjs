// Sync Unified Prospects - Combines LinkedIn and Email data
// Creates a master prospect database and syncs to Airtable
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

const AIRTABLE_API_KEY = 'patGjqqtngAUpsPPz.0b428b264625f558675671497d7a53a0eb0be01d1a8bb6365051c3d9839abdd7';
const AIRTABLE_BASE_ID = 'appo6ZgNqEWLtw66q';
const AIRTABLE_PROSPECTS_TABLE = 'tblMqDWVazMY1TD1l'; // LinkedIn Positive Leads 25-26

const INNOVARE_WORKSPACE_IDS = [
  'babdcab8-1a78-4b2f-913e-6e9fd9821009', // Thorsten Linz
  '7f0341da-88db-476b-ae0a-fc0da5b70861', // Charissa Saniel
  '04666209-fce8-4d71-8eaf-01278edfc73b', // Michelle Gestuveo
  '96c03b38-a2f4-40de-9e16-43098599e1d4', // Irish Maguad
  '2a8f7c3d-9b1e-4f6a-8c2d-5e9a1b4f7d3c', // Chona Lamberte
  'cd57981a-e63b-401c-bde1-ac71752c2293', // Jennifer Fleming
];

// Map workspace to Airtable account name (must match existing Airtable options)
// Options: Cha, Irish, Michelle, Charlie, Danilo, TL
const WORKSPACE_TO_ACCOUNT = {
  'babdcab8-1a78-4b2f-913e-6e9fd9821009': 'TL',       // Thorsten Linz
  '7f0341da-88db-476b-ae0a-fc0da5b70861': 'Cha',      // Charissa
  '04666209-fce8-4d71-8eaf-01278edfc73b': 'Michelle', // Michelle
  '96c03b38-a2f4-40de-9e16-43098599e1d4': 'Irish',    // Irish
  '2a8f7c3d-9b1e-4f6a-8c2d-5e9a1b4f7d3c': 'Charlie',  // Chona (using Charlie)
  'cd57981a-e63b-401c-bde1-ac71752c2293': 'TL',       // Jennifer (using TL for now)
};

async function getLinkedInProspects() {
  console.log('📱 Fetching LinkedIn prospects...');

  const { data: prospects, error } = await supabase
    .from('campaign_prospects')
    .select(`
      id,
      workspace_id,
      campaign_id,
      first_name,
      last_name,
      email,
      linkedin_url,
      company_name,
      title,
      industry,
      location,
      status,
      contacted_at,
      connection_accepted_at,
      responded_at,
      notes,
      personalization_data,
      reply_sentiment,
      meeting_booked,
      meeting_booked_at,
      trial_signup,
      trial_signup_at,
      converted_to_mrr,
      mrr_converted_at,
      mrr_value,
      created_at,
      updated_at
    `)
    .in('workspace_id', INNOVARE_WORKSPACE_IDS)
    .in('status', ['replied', 'connected', 'connection_request_sent', 'approved']);

  if (error) {
    console.log('Error:', error.message);
    return [];
  }

  console.log(`  Found ${prospects?.length || 0} LinkedIn prospects (sent/connected/replied)`);
  return prospects || [];
}

async function getEmailProspects() {
  console.log('📧 Fetching Email prospects...');

  const { data: prospects, error } = await supabase
    .from('email_campaign_prospects')
    .select('*')
    .in('workspace_id', INNOVARE_WORKSPACE_IDS);

  if (error && !error.message.includes('does not exist')) {
    console.log('Error:', error.message);
  }

  console.log(`  Found ${prospects?.length || 0} Email prospects`);
  return prospects || [];
}

function mapLinkedInStatus(status) {
  const map = {
    'pending': 'pending',
    'approved': 'sent',
    'connection_request_sent': 'sent',
    'connected': 'connected',
    'replied': 'replied',
    'failed': 'failed',
    'already_invited': 'sent'
  };
  return map[status] || 'none';
}

function determineOverallStatus(liStatus, emailStatus, replySentiment) {
  // Check for replies first
  if (liStatus === 'replied' || emailStatus === 'replied') {
    if (replySentiment === 'positive') return 'positive';
    if (replySentiment === 'negative') return 'not_interested';
    return 'replied';
  }

  // Check for engagement
  if (liStatus === 'connected' || emailStatus === 'opened' || emailStatus === 'clicked') {
    return 'engaged';
  }

  // Check if contacted
  if (liStatus === 'sent' || emailStatus === 'sent') {
    return 'contacted';
  }

  return 'new';
}

function buildMessageHistory(prospect) {
  const messages = [];

  // Add contact event
  if (prospect.contacted_at) {
    messages.push({
      sender: 'campaign',
      channel: 'linkedin',
      content: 'Connection request sent',
      sent_at: prospect.contacted_at
    });
  }

  // Add connection accepted
  if (prospect.connection_accepted_at) {
    messages.push({
      sender: 'system',
      channel: 'linkedin',
      content: 'Connection accepted',
      sent_at: prospect.connection_accepted_at
    });
  }

  // Add prospect reply
  if (prospect.notes && prospect.status === 'replied') {
    messages.push({
      sender: 'prospect',
      channel: 'linkedin',
      content: prospect.notes,
      sent_at: prospect.responded_at
    });
  }

  return messages;
}

async function syncToAirtable(prospects) {
  console.log('\n📊 Syncing to Airtable...');

  // Filter to only replied/positive prospects for now
  const positiveProspects = prospects.filter(p =>
    p.linkedin_status === 'replied' ||
    p.linkedin_status === 'connected' ||
    p.email_status === 'replied'
  );

  console.log(`  ${positiveProspects.length} prospects to sync (replied/connected)`);

  // Get existing records to avoid duplicates
  const existingResponse = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_PROSPECTS_TABLE}?fields[]=Profile%20URL&fields[]=Email`,
    { headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` } }
  );
  const existingData = await existingResponse.json();
  const existingUrls = new Set(existingData.records?.map(r => r.fields['Profile URL']) || []);
  const existingEmails = new Set(existingData.records?.map(r => r.fields['Email']) || []);

  // Filter out already synced
  const newProspects = positiveProspects.filter(p => {
    const url = p.linkedin_url || p.profile_url;
    return !existingUrls.has(url) && (!p.email || !existingEmails.has(p.email));
  });

  console.log(`  ${newProspects.length} new prospects to add`);

  if (newProspects.length === 0) {
    console.log('  No new prospects to sync');
    return;
  }

  // Map to Airtable format
  const records = newProspects.map(p => ({
    fields: {
      'Profile URL': p.linkedin_url || '',
      'Name of Interested Lead': `${p.first_name || ''} ${p.last_name || ''}`.trim(),
      'Job Title': p.title || '',
      'Email': p.email || '',
      'Company Name': p.company || '',
      'Date': p.linkedin_replied_at ? p.linkedin_replied_at.split('T')[0] : new Date().toISOString().split('T')[0],
      'LinkedIn Account': WORKSPACE_TO_ACCOUNT[p.workspace_id] || 'Unknown',
      'Status of the Lead': p.reply_sentiment === 'positive' ? 'Interested Lead' :
                           p.reply_sentiment === 'negative' ? 'NOT INTERESTED' : 'need more info',
      'Last Messages/ Responses': p.linkedin_last_message || p.prospect_reply_message || '',
      'Action': p.linkedin_status === 'replied' ? 'Responded' : 'Connected',
      'Industry': p.industry || '',
      'Country': p.country || ''
    }
  }));

  // Batch insert (10 at a time)
  let synced = 0;
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);

    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_PROSPECTS_TABLE}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ records: batch })
      }
    );

    const result = await response.json();
    if (result.error) {
      console.log('  ❌ Error:', result.error.message);
    } else {
      synced += batch.length;
    }
  }

  console.log(`  ✅ Synced ${synced} prospects to Airtable`);
}

async function identifyRepurposeCandidates(prospects) {
  console.log('\n🔄 Identifying repurpose candidates...');

  const canRepurpose = prospects.filter(p => {
    // LinkedIn contacted, no reply, has email
    const liNoReply = p.linkedin_status === 'sent' && !p.linkedin_replied_at && p.email;
    // Email contacted, no reply, has LinkedIn
    const emailNoReply = p.email_status === 'sent' && !p.email_replied_at && (p.linkedin_url || p.profile_url);

    return liNoReply || emailNoReply;
  });

  console.log(`  ${canRepurpose.length} prospects can be repurposed`);

  // Group by recommended channel
  const toEmail = canRepurpose.filter(p => p.linkedin_status === 'sent' && p.email);
  const toLinkedIn = canRepurpose.filter(p => p.email_status === 'sent' && (p.linkedin_url || p.profile_url));

  console.log(`    → ${toEmail.length} can be contacted via Email`);
  console.log(`    → ${toLinkedIn.length} can be contacted via LinkedIn`);

  return { toEmail, toLinkedIn };
}

async function sync() {
  console.log('=== Unified Prospects Sync ===');
  console.log('Time:', new Date().toISOString());
  console.log('');

  try {
    // 1. Get LinkedIn prospects
    const linkedInProspects = await getLinkedInProspects();

    // 2. Get Email prospects
    const emailProspects = await getEmailProspects();

    // 3. Merge into unified format
    console.log('\n🔗 Building unified prospect list...');

    const unified = linkedInProspects.map(p => {
      const liStatus = mapLinkedInStatus(p.status);
      const messageHistory = buildMessageHistory(p);

      return {
        workspace_id: p.workspace_id,
        email: p.email,
        linkedin_url: p.linkedin_url,
        first_name: p.first_name,
        last_name: p.last_name,
        company: p.company_name,
        title: p.title,
        industry: p.industry,
        country: p.location,
        source_channel: 'linkedin',
        linkedin_status: liStatus,
        linkedin_sent_at: p.contacted_at,
        linkedin_connected_at: p.connection_accepted_at,
        linkedin_replied_at: p.responded_at,
        linkedin_last_message: p.notes,
        email_status: 'none',
        overall_status: determineOverallStatus(liStatus, 'none', p.reply_sentiment),
        reply_sentiment: p.reply_sentiment,
        initial_outreach_message: null, // Would need to fetch from campaign
        prospect_reply_message: p.status === 'replied' ? p.notes : null,
        message_history: messageHistory,
        meeting_booked: p.meeting_booked,
        meeting_booked_at: p.meeting_booked_at,
        trial_signup: p.trial_signup,
        converted_to_mrr: p.converted_to_mrr,
        mrr_value: p.mrr_value,
        linkedin_prospect_id: p.id
      };
    });

    // TODO: Merge email prospects by matching email addresses

    console.log(`  Total unified prospects: ${unified.length}`);

    // 4. Sync to Airtable
    await syncToAirtable(unified);

    // 5. Identify repurpose candidates
    await identifyRepurposeCandidates(unified);

    // 6. Summary
    console.log('\n=== Summary ===');
    const statusCounts = {};
    unified.forEach(p => {
      statusCounts[p.overall_status] = (statusCounts[p.overall_status] || 0) + 1;
    });

    console.log('Prospect Status Breakdown:');
    Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).forEach(([s, c]) => {
      console.log(`  ${s}: ${c}`);
    });

  } catch (error) {
    console.error('❌ Sync failed:', error);
  }
}

sync().catch(console.error);
