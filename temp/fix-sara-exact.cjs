const https = require('https');

const SUPABASE_URL = 'latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';
const WEBHOOK_URL = 'https://chat.googleapis.com/v1/spaces/AAQAyTeGzr8/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=VV6Io-G_p6TTusbc6kH1aBCfMMGUxXWHJP3gJk0WZrs';

const DRAFT_ID = '73d1aaeb-28f4-4e8f-b3bf-0a18c2e2da3d';

// User's EXACT message - no changes
const exactMessage = `happy holidays and lets touch base in the week after christmans to get you setup with a free trial`;

// 1. Update database
const updateDraft = () => {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      draft_text: exactMessage,
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
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('DB Update status:', res.statusCode);
        resolve();
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
};

// 2. Send notification
const sendNotification = () => {
  const baseUrl = 'https://app.meet-sam.com';
  const token = 'ac547981-35a4-4abb-ad1b-a10e5f812eea';

  const payload = {
    cardsV2: [{
      cardId: `reply-${DRAFT_ID}-${Date.now()}`,
      card: {
        header: {
          title: '📬 New Reply from Sara Ritchie',
          subtitle: 'Fractional COO for Dental Practices',
          imageType: 'CIRCLE'
        },
        sections: [
          {
            header: 'Intent: 👍 VAGUE_POSITIVE',
            widgets: [{
              textParagraph: {
                text: '<b>Their Message:</b>\n"I am very interested in AI, and I teach it as well."'
              }
            }]
          },
          {
            header: "💡 SAM's Draft Reply",
            widgets: [{
              textParagraph: { text: exactMessage }
            }]
          },
          {
            widgets: [{
              buttonList: {
                buttons: [
                  {
                    text: '✅ Approve',
                    onClick: { openLink: { url: `${baseUrl}/api/reply-agent/approve?token=${token}&action=approve` } },
                    color: { red: 0.063, green: 0.722, blue: 0.506, alpha: 1 }
                  },
                  {
                    text: '✏️ Edit',
                    onClick: { openLink: { url: `${baseUrl}/reply-agent/edit?id=${DRAFT_ID}&token=${token}` } },
                    color: { red: 0.42, green: 0.48, blue: 0.54, alpha: 1 }
                  },
                  {
                    text: '❌ Reject',
                    onClick: { openLink: { url: `${baseUrl}/api/reply-agent/approve?token=${token}&action=reject` } },
                    color: { red: 0.937, green: 0.267, blue: 0.267, alpha: 1 }
                  }
                ]
              }
            }]
          }
        ]
      }
    }]
  };

  const url = new URL(WEBHOOK_URL);
  const postData = JSON.stringify(payload);

  const options = {
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = https.request(options, (res) => {
    console.log('Notification status:', res.statusCode);
  });
  req.write(postData);
  req.end();
};

async function main() {
  console.log('Message:', exactMessage);
  await updateDraft();
  sendNotification();
  console.log('Done');
}

main();
