#!/usr/bin/env node
import 'dotenv/config';

const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const CHARISSA_ACCOUNT_ID = '4nt1J-blSnGUPBjH2Nfjpg';

console.log('🔍 CHECKING CHARISSA\'S LINKEDIN INBOX VIA UNIPILE');
console.log('='.repeat(70));

// Fetch recent chats
const chatsResponse = await fetch(
  `${UNIPILE_BASE_URL}/api/v1/chats?account_id=${CHARISSA_ACCOUNT_ID}&limit=30`,
  {
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Accept': 'application/json'
    }
  }
);

if (!chatsResponse.ok) {
  console.error('Failed to fetch chats:', await chatsResponse.text());
  process.exit(1);
}

const chatsData = await chatsResponse.json();
const chats = chatsData.items || [];

console.log(`\nFound ${chats.length} recent chats\n`);

// Look for Sara Ritchie or any recent inbound messages
for (const chat of chats) {
  const attendeeName = chat.attendee_name || chat.attendees?.[0]?.name || 'Unknown';

  // Check if this is Sara Ritchie
  if (attendeeName.toLowerCase().includes('sara') || attendeeName.toLowerCase().includes('ritchie')) {
    console.log('─'.repeat(70));
    console.log(`🎯 FOUND: ${attendeeName}`);
    console.log(`   Chat ID: ${chat.id}`);
    console.log(`   Attendee Provider ID: ${chat.attendee_provider_id}`);
    console.log(`   Last message: ${chat.last_message?.text?.slice(0, 80)}...`);
    console.log(`   Last message time: ${chat.last_message?.timestamp || chat.updated_at}`);

    // Fetch messages in this chat
    const messagesResponse = await fetch(
      `${UNIPILE_BASE_URL}/api/v1/chats/${chat.id}/messages?limit=10`,
      {
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Accept': 'application/json'
        }
      }
    );

    if (messagesResponse.ok) {
      const msgData = await messagesResponse.json();
      console.log(`\n   Messages in chat:`);
      for (const msg of msgData.items || []) {
        const direction = msg.is_sender === 1 ? 'OUTBOUND' : 'INBOUND';
        console.log(`   [${direction}] ${msg.text?.slice(0, 60)}... (${msg.created_at})`);
      }
    }
  }
}

// Also search for any chat with "ritchie"
console.log('\n' + '─'.repeat(70));
console.log('SEARCHING ALL CHATS FOR "RITCHIE"...');

for (const chat of chats) {
  const attendeeName = (chat.attendee_name || '').toLowerCase();
  if (attendeeName.includes('ritchie')) {
    console.log(`   Found: ${chat.attendee_name} (${chat.id})`);
  }
}

// Show recent inbound messages
console.log('\n' + '─'.repeat(70));
console.log('RECENT CHATS WITH INBOUND MESSAGES (last 10):');

let count = 0;
for (const chat of chats) {
  if (count >= 10) break;

  // Check if last message was inbound
  if (chat.last_message && chat.last_message.is_sender === 0) {
    console.log(`\n   👤 ${chat.attendee_name || 'Unknown'}`);
    console.log(`      Last msg: "${chat.last_message.text?.slice(0, 60)}..."`);
    console.log(`      Time: ${chat.last_message.timestamp || chat.updated_at}`);
    console.log(`      Provider ID: ${chat.attendee_provider_id}`);
    count++;
  }
}

console.log('\n' + '='.repeat(70));
