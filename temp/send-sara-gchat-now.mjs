#!/usr/bin/env node

const WEBHOOK_URL = 'https://chat.googleapis.com/v1/spaces/AAQAyTeGzr8/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=VV6Io-G_p6TTusbc6kH1aBCfMMGUxXWHJP3gJk0WZrs';
const APP_URL = 'https://app.meet-sam.com';
const APPROVAL_TOKEN = '6472b503-f892-4554-afd0-17ba2587abd6';
const DRAFT_ID = '9301679d-5c5d-48b3-9fb2-90246f1078cf';

const approveUrl = `${APP_URL}/api/reply-agent/approve?token=${APPROVAL_TOKEN}&action=approve`;
const rejectUrl = `${APP_URL}/api/reply-agent/approve?token=${APPROVAL_TOKEN}&action=reject`;

const message = {
  cards: [{
    header: {
      title: "📬 Reply Pending Approval",
      subtitle: "Sara Ritchie → Charissa"
    },
    sections: [
      {
        widgets: [
          { keyValue: { topLabel: "Prospect", content: "Sara Ritchie" } },
          { keyValue: { topLabel: "Title", content: "Fractional COO for Dental Practices" } },
          { keyValue: { topLabel: "Intent", content: "🟢 INTERESTED" } }
        ]
      },
      {
        widgets: [{
          textParagraph: {
            text: "<b>📥 Their Message:</b><br>\"I would be happy to connect. Do you have a link to book a call?\""
          }
        }]
      },
      {
        widgets: [{
          textParagraph: {
            text: "<b>📤 Draft Reply:</b><br>\"Here's a link to grab time: https://calendar.app.google/R9jsMVbnBzjFjqc28<br><br>Before we chat — what's your business focused on? Want to make sure the call is actually useful for you.\""
          }
        }]
      },
      {
        widgets: [{
          buttons: [
            { textButton: { text: "✅ APPROVE", onClick: { openLink: { url: approveUrl } } } },
            { textButton: { text: "❌ REJECT", onClick: { openLink: { url: rejectUrl } } } }
          ]
        }]
      }
    ]
  }]
};

const response = await fetch(WEBHOOK_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(message)
});

if (response.ok) {
  console.log('✅ Sent to Google Chat!');
} else {
  console.log(`❌ Failed: ${response.status} - ${await response.text()}`);
}
