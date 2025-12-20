const https = require('https');

const WEBHOOK_URL = 'https://chat.googleapis.com/v1/spaces/AAQAyTeGzr8/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=VV6Io-G_p6TTusbc6kH1aBCfMMGUxXWHJP3gJk0WZrs';

const draft = {
  id: '73d1aaeb-28f4-4e8f-b3bf-0a18c2e2da3d',
  prospect_name: 'Sara Ritchie',
  prospect_title: 'Fractional COO for Dental Practices',
  inbound_message_text: 'I am very interested in AI, and I teach it as well.',
  draft_text: `Hi Sara,

That's really cool — always love meeting people in the AI space!

Happy holidays, and let's touch base the week after Christmas to get you set up with a free trial.

Merry Christmas 🎄`,
  approval_token: 'ac547981-35a4-4abb-ad1b-a10e5f812eea'
};

const baseUrl = 'https://app.meet-sam.com';
const approveUrl = `${baseUrl}/api/reply-agent/approve?token=${draft.approval_token}&action=approve`;
const editUrl = `${baseUrl}/reply-agent/edit?id=${draft.id}&token=${draft.approval_token}`;
const rejectUrl = `${baseUrl}/api/reply-agent/approve?token=${draft.approval_token}&action=reject`;

const payload = {
  cardsV2: [{
    cardId: `reply-${draft.id}-${Date.now()}`,
    card: {
      header: {
        title: `📬 New Reply from ${draft.prospect_name}`,
        subtitle: draft.prospect_title,
        imageType: 'CIRCLE'
      },
      sections: [
        {
          header: 'Intent: 👍 VAGUE_POSITIVE',
          widgets: [{
            textParagraph: {
              text: `<b>Their Message:</b>\n"${draft.inbound_message_text}"`
            }
          }]
        },
        {
          header: "💡 SAM's Draft Reply",
          widgets: [{
            textParagraph: { text: draft.draft_text }
          }]
        },
        {
          widgets: [{
            buttonList: {
              buttons: [
                {
                  text: '✅ Approve',
                  onClick: { openLink: { url: approveUrl } },
                  color: { red: 0.063, green: 0.722, blue: 0.506, alpha: 1 }
                },
                {
                  text: '✏️ Edit',
                  onClick: { openLink: { url: editUrl } },
                  color: { red: 0.42, green: 0.48, blue: 0.54, alpha: 1 }
                },
                {
                  text: '❌ Reject',
                  onClick: { openLink: { url: rejectUrl } },
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
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    if (res.statusCode === 200) {
      console.log('✅ Notification sent with all 3 buttons!');
    } else {
      console.log('Response:', data);
    }
  });
});

req.on('error', e => console.error('Error:', e));
req.write(postData);
req.end();
