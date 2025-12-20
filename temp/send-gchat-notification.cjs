const https = require('https');

const apiKey = process.env.SUPABASE_KEY;
const webhookUrl = process.env.GOOGLE_CHAT_REPLIES_WEBHOOK_URL;

console.log('Webhook URL set:', webhookUrl ? 'Yes' : 'No');

if (!webhookUrl) {
  console.log('No webhook URL - cannot send notification');
  process.exit(1);
}

// Fetch drafts
const options = {
  hostname: 'latxadqrvrrrcvkktrog.supabase.co',
  path: '/rest/v1/reply_agent_drafts?id=in.(4b95c0bf-3b17-417b-8dbe-3c5ea18937e0,73d1aaeb-28f4-4e8f-b3bf-0a18c2e2da3d)&select=*',
  method: 'GET',
  headers: {
    'apikey': apiKey,
    'Authorization': 'Bearer ' + apiKey,
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const drafts = JSON.parse(data);

    drafts.forEach(draft => {
      const editUrl = 'https://app.meet-sam.com/reply-agent/edit?id=' + draft.id + '&token=' + draft.approval_token;

      const message = {
        cardsV2: [{
          cardId: 'reply-draft-' + draft.id,
          card: {
            header: {
              title: '📬 Reply Draft Ready: ' + draft.prospect_name,
              subtitle: draft.channel === 'email' ? '📧 Email' : '💼 LinkedIn'
            },
            sections: [
              {
                header: 'Prospect Message',
                widgets: [{
                  textParagraph: {
                    text: (draft.inbound_message_text || '').substring(0, 200)
                  }
                }]
              },
              {
                header: 'Draft Reply',
                widgets: [{
                  textParagraph: {
                    text: (draft.draft_text || '').substring(0, 300) + '...'
                  }
                }]
              },
              {
                widgets: [{
                  buttonList: {
                    buttons: [
                      {
                        text: '✏️ Review & Edit',
                        onClick: {
                          openLink: { url: editUrl }
                        }
                      }
                    ]
                  }
                }]
              }
            ]
          }
        }]
      };

      // Parse webhook URL
      const url = new URL(webhookUrl);

      const postOptions = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const postReq = https.request(postOptions, (postRes) => {
        let responseData = '';
        postRes.on('data', (chunk) => responseData += chunk);
        postRes.on('end', () => {
          console.log('Sent notification for', draft.prospect_name, '- Status:', postRes.statusCode);
        });
      });

      postReq.on('error', (e) => console.error('Error sending notification:', e.message));
      postReq.write(JSON.stringify(message));
      postReq.end();
    });
  });
});

req.on('error', (e) => console.error('Error:', e.message));
req.end();
