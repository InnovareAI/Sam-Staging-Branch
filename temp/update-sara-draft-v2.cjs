const https = require('https');

const SUPABASE_URL = 'latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const DRAFT_ID = '73d1aaeb-28f4-4e8f-b3bf-0a18c2e2da3d';

// Update the draft with a more human message
const updateDraft = (newText) => {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      draft_text: newText,
      updated_at: new Date().toISOString()
    });

    const options = {
      hostname: SUPABASE_URL,
      path: `/rest/v1/reply_agent_drafts?id=eq.${DRAFT_ID}`,
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
  // New human, warm, conversational reply that engages with her teaching AI
  const newDraftText = `Hi Sara,

That's really cool that you teach AI — what area do you focus on? Always curious to hear from people in the education space.

Since you're into AI, you might find SAM interesting — it's an AI sales agent that handles LinkedIn outreach and follow-ups automatically. Here's a quick demo if you want to take a look: https://links.innovareai.com/SAM_Demo

Would love to hear your thoughts!

Merry Christmas 🎄`;

  console.log('New draft text:');
  console.log(newDraftText);

  console.log('\n\nUpdating draft...');
  const result = await updateDraft(newDraftText);
  console.log('\nDraft updated successfully!');
  console.log('Result:', JSON.stringify(result, null, 2));
}

main().catch(console.error);
