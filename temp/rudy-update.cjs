const https = require('https');

const SUPABASE_URL = 'latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';
const WEBHOOK_URL = 'https://chat.googleapis.com/v1/spaces/AAQAyTeGzr8/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=VV6Io-G_p6TTusbc6kH1aBCfMMGUxXWHJP3gJk0WZrs';

const DRAFT_ID = '4b95c0bf-3b17-417b-8dbe-3c5ea18937e0';

const message = `Hi Rudy,

No worries on the timing. Yes, SAM is still live — here's a quick demo: https://links.innovareai.com/SAM_Demo

It handles LinkedIn outreach and follow-ups automatically, so SBFO SERVICE can focus on closing deals instead of chasing them.

Happy to do a quick call after you watch it, or I can send you the trial link if you'd rather explore on your own.

Wishing you a wonderful Christmas and happy holidays!`;

// 1. Update database
const updateDraft = () => {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      draft_text: message,
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
      console.log('DB Update:', res.statusCode);
      resolve();
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
};

// 2. Get token from DB then send notification
const getTokenAndNotify = () => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: SUPABASE_URL,
      path: `/rest/v1/reply_agent_drafts?id=eq.${DRAFT_ID}&select=approval_token,inbound_message_text`,
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
      res.on('end', () => {
        const draft = JSON.parse(data)[0];
        const token = draft.approval_token;
        const inbound = draft.inbound_message_text;

        const baseUrl = 'https://app.meet-sam.com';
        const payload = {
          cardsV2: [{
            cardId: `reply-${DRAFT_ID}-${Date.now()}`,
            card: {
              header: {
                title: '📬 New Reply from Rudy Walgraef',
                subtitle: 'SBFO SERVICE',
                imageType: 'CIRCLE'
              },
              sections: [
                {
                  header: 'Intent: 🔥 INTERESTED',
                  widgets: [{
                    textParagraph: {
                      text: `<b>Their Message:</b>\n"${inbound}"`
                    }
                  }]
                },
                {
                  header: "💡 SAM's Draft Reply",
                  widgets: [{
                    textParagraph: { text: message }
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

        const notifyReq = https.request({
          hostname: url.hostname,
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        }, (res) => {
          console.log('Notification:', res.statusCode);
          resolve();
        });
        notifyReq.write(postData);
        notifyReq.end();
      });
    });
    req.on('error', reject);
    req.end();
  });
};

async function main() {
  await updateDraft();
  await getTokenAndNotify();
}

main();
