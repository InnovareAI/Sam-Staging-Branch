#!/usr/bin/env node
import 'dotenv/config';

const SARA_DRAFT_ID = '9301679d-5c5d-48b3-9fb2-90246f1078cf';
const APP_URL = 'https://app.meet-sam.com';

// Call the reply-agent-process endpoint to trigger notification
// Or directly call the internal notification endpoint

const response = await fetch(`${APP_URL}/api/reply-agent/notify`, {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'x-cron-secret': process.env.CRON_SECRET
  },
  body: JSON.stringify({
    draft_id: SARA_DRAFT_ID
  })
});

if (response.ok) {
  const data = await response.json();
  console.log('✅ Notification sent:', data);
} else {
  console.log(`❌ Failed: ${response.status}`);
  // Fallback - use env webhook directly
  const webhookUrl = process.env.GOOGLE_CHAT_REPLIES_WEBHOOK_URL;
  console.log(`Webhook URL available: ${!!webhookUrl}`);
  
  if (webhookUrl) {
    console.log('\nTrying direct webhook...');
    const directResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `📬 *New Reply from Sara Ritchie*\n\n*Their Message:*\n"I would be happy to connect. Do you have a link to book a call?"\n\n*Draft Reply:*\n"Here's a link to grab time: https://calendar.app.google/R9jsMVbnBzjFjqc28\n\nBefore we chat — what's your business focused on? Want to make sure the call is actually useful for you."\n\n✅ Approve: ${APP_URL}/api/reply-agent/approve?token=6472b503-f892-4554-afd0-17ba2587abd6&action=approve`
      })
    });
    
    if (directResponse.ok) {
      console.log('✅ Direct webhook sent!');
    } else {
      console.log('❌ Direct webhook failed:', await directResponse.text());
    }
  }
}
