#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SARA_DRAFT_ID = '9301679d-5c5d-48b3-9fb2-90246f1078cf';
const APP_URL = 'https://app.meet-sam.com';

// Get the draft
const { data: draft } = await supabase
  .from('reply_agent_drafts')
  .select('*')
  .eq('id', SARA_DRAFT_ID)
  .single();

if (!draft) {
  console.log('❌ Draft not found');
  process.exit(1);
}

console.log('📤 Sending Sara draft to Google Chat...');

// Google Chat webhook URL for IA team
const GCHAT_WEBHOOK = process.env.GOOGLE_CHAT_WEBHOOK_URL || process.env.GCHAT_WEBHOOK_IA;

if (!GCHAT_WEBHOOK) {
  // Try to get from workspace config or use default IA webhook
  console.log('Looking for Google Chat webhook...');
}

// Build the approval URLs
const approveUrl = `${APP_URL}/api/reply-agent/approve?token=${draft.approval_token}&action=approve`;
const rejectUrl = `${APP_URL}/api/reply-agent/approve?token=${draft.approval_token}&action=reject`;
const editUrl = `${APP_URL}/reply-agent/edit?id=${draft.id}&token=${draft.approval_token}`;

// Build Google Chat card message
const cardMessage = {
  cards: [{
    header: {
      title: "📬 New Reply Pending Approval",
      subtitle: `From: ${draft.prospect_name}`,
    },
    sections: [
      {
        widgets: [
          {
            keyValue: {
              topLabel: "Prospect",
              content: draft.prospect_name || 'Sara Ritchie',
            }
          },
          {
            keyValue: {
              topLabel: "Title",
              content: draft.prospect_title || 'Fractional COO for Dental Practices',
            }
          },
          {
            keyValue: {
              topLabel: "Intent",
              content: draft.intent_detected || 'INTERESTED',
            }
          }
        ]
      },
      {
        widgets: [
          {
            textParagraph: {
              text: `<b>📥 Their Message:</b><br>"${draft.inbound_message_text}"`
            }
          }
        ]
      },
      {
        widgets: [
          {
            textParagraph: {
              text: `<b>📤 Draft Reply:</b><br>"${draft.draft_text}"`
            }
          }
        ]
      },
      {
        widgets: [
          {
            buttons: [
              {
                textButton: {
                  text: "✅ APPROVE & SEND",
                  onClick: { openLink: { url: approveUrl } }
                }
              },
              {
                textButton: {
                  text: "✏️ EDIT",
                  onClick: { openLink: { url: editUrl } }
                }
              },
              {
                textButton: {
                  text: "❌ REJECT",
                  onClick: { openLink: { url: rejectUrl } }
                }
              }
            ]
          }
        ]
      }
    ]
  }]
};

// Get the webhook URL from environment or hardcoded IA channel
const webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_IA || 
  'https://chat.googleapis.com/v1/spaces/AAAAlqdh4fk/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=MGeJOGlk6x2ENvbVLjJV_5YJPW3p2q_tlyl20qZv6_E';

const response = await fetch(webhookUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(cardMessage)
});

if (response.ok) {
  console.log('✅ Sent to Google Chat!');
  console.log(`\nApprove: ${approveUrl}`);
} else {
  const error = await response.text();
  console.log(`❌ Failed: ${response.status} - ${error}`);
}
