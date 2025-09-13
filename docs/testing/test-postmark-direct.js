// Test Postmark directly to see if domain is verified
const postmarkResponse = await fetch('https://api.postmarkapp.com/email', {
  method: 'POST',
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-Postmark-Server-Token': 'bf9e070d-eec7-4c41-8fb5-1d37fe384723'
  },
  body: JSON.stringify({
    From: 'SAM AI <tl@innovareai.com>',
    To: 'tl@innovareai.com',
    Subject: 'Direct Postmark Test',
    HtmlBody: '<h1>This is a direct test of Postmark</h1><p>If you receive this, Postmark is working.</p>',
    TextBody: 'This is a direct test of Postmark. If you receive this, Postmark is working.',
    MessageStream: 'outbound'
  })
});

const result = await postmarkResponse.json();
console.log('Postmark response:', result);

if (!postmarkResponse.ok) {
  console.error('❌ Postmark error:', result);
} else {
  console.log('✅ Postmark success:', result.MessageID);
}