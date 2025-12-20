const https = require('https');

// Use the correct replies webhook
const WEBHOOK_URL = 'https://chat.googleapis.com/v1/spaces/AAQAyTeGzr8/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=VV6Io-G_p6TTusbc6kH1aBCfMMGUxXWHJP3gJk0WZrs';

const draft = {
  id: '73d1aaeb-28f4-4e8f-b3bf-0a18c2e2da3d',
  prospect_name: 'Sara Ritchie',
  inbound_message_text: 'I am very interested in AI, and I teach it as well.',
  draft_text: `Hi Sara,

That's really cool that you teach AI — what area do you focus on? Always curious to hear from people in the education space.

Since you're into AI, you might find SAM interesting — it's an AI sales agent that handles LinkedIn outreach and follow-ups automatically. Here's a quick demo if you want to take a look: https://links.innovareai.com/SAM_Demo

Would love to hear your thoughts!

Merry Christmas 🎄`,
  approval_token: 'ac547981-35a4-4abb-ad1b-a10e5f812eea'
};

const baseUrl = 'https://app.meet-sam.com';
const editUrl = `${baseUrl}/api/reply-agent/review?token=${draft.approval_token}`;

const payload = {
  cardsV2: [{
    cardId: `reply-${draft.id}`,
    card: {
      header: {
        title: '💬 Reply Draft Ready (Updated)',
        subtitle: draft.prospect_name
      },
      sections: [
        {
          header: 'Their Message',
          widgets: [{
            textParagraph: { text: draft.inbound_message_text }
          }]
        },
        {
          header: 'Suggested Reply',
          widgets: [{
            textParagraph: { text: draft.draft_text }
          }]
        },
        {
          widgets: [{
            buttonList: {
              buttons: [
                {
                  text: '✏️ Edit & Approve',
                  onClick: { openLink: { url: editUrl } }
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
      console.log('✅ Notification sent successfully!');
    } else {
      console.log('Response:', data);
    }
  });
});

req.on('error', e => console.error('Error:', e));
req.write(postData);
req.end();
