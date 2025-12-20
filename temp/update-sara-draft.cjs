const https = require('https');

const SUPABASE_URL = 'latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

// First, get Sara's current draft
const getDraft = () => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: SUPABASE_URL,
      path: '/rest/v1/reply_agent_drafts?prospect_id=eq.7f0b6ee4-fd9b-4c40-b1dc-91c3a5b56635&select=id,draft_text,inbound_message_text&order=created_at.desc&limit=1',
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.end();
  });
};

// Update the draft with a more human message
const updateDraft = (draftId, newText) => {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      draft_text: newText,
      updated_at: new Date().toISOString()
    });

    const options = {
      hostname: SUPABASE_URL,
      path: `/rest/v1/reply_agent_drafts?id=eq.${draftId}`,
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('Update status:', res.statusCode);
        resolve(data ? JSON.parse(data) : {});
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
};

async function main() {
  console.log('Fetching Sara\'s draft...');
  const drafts = await getDraft();

  if (!drafts || drafts.length === 0) {
    console.log('No draft found');
    return;
  }

  const draft = drafts[0];
  console.log('\nCurrent draft:');
  console.log('ID:', draft.id);
  console.log('Inbound message:', draft.inbound_message_text);
  console.log('Current draft text:', draft.draft_text);

  // New human, warm, conversational reply
  const newDraftText = `Hi Sara,

That's really cool that you teach AI — what area do you focus on? Always curious to learn from people in the education space.

I'd love to show you what we're building with SAM. It's essentially an AI sales agent that handles LinkedIn outreach and follow-ups automatically.

Here's a quick demo if you want to take a peek: https://links.innovareai.com/SAM_Demo

Would love to hear your thoughts, especially from a teaching perspective!

Merry Christmas 🎄`;

  console.log('\n\nNew draft text:');
  console.log(newDraftText);

  console.log('\n\nUpdating draft...');
  const result = await updateDraft(draft.id, newDraftText);
  console.log('\nDraft updated successfully!');
  console.log('Result:', JSON.stringify(result, null, 2));
}

main().catch(console.error);
