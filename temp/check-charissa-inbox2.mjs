#!/usr/bin/env node

const UNIPILE_BASE_URL = 'https://api6.unipile.com:13670';
const UNIPILE_API_KEY = '85ZMr7iE.Pw5mVHOgvpPXOl47GXXXoW0uLPvOUK23bWXD+hHuziA=';
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
  console.error('Failed to fetch chats:', chatsResponse.status, await chatsResponse.text());
  process.exit(1);
}

const chatsData = await chatsResponse.json();
const chats = chatsData.items || [];

console.log(`\nFound ${chats.length} recent chats\n`);

// Look for Sara Ritchie
console.log('SEARCHING FOR SARA RITCHIE...\n');

for (const chat of chats) {
  const attendeeName = chat.attendee_name || chat.attendees?.[0]?.name || 'Unknown';

  if (attendeeName.toLowerCase().includes('sara') || attendeeName.toLowerCase().includes('ritchie')) {
    console.log('─'.repeat(70));
    console.log(`🎯 FOUND: ${attendeeName}`);
    console.log(`   Chat ID: ${chat.id}`);
    console.log(`   Attendee Provider ID: ${chat.attendee_provider_id}`);

    // Fetch messages
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
      console.log(`\n   Messages:`);
      for (const msg of (msgData.items || []).reverse()) {
        const direction = msg.is_sender === 1 ? '→ OUT' : '← IN';
        console.log(`   [${direction}] ${msg.text?.slice(0, 80)}...`);
        console.log(`           (${msg.created_at})`);
      }
    }
  }
}

// Show all chat names for reference
console.log('\n' + '─'.repeat(70));
console.log('ALL RECENT CHATS:');
for (const chat of chats.slice(0, 15)) {
  const name = chat.attendee_name || 'Unknown';
  const lastMsg = chat.last_message?.text?.slice(0, 40) || '';
  console.log(`   - ${name}: "${lastMsg}..."`);
}

console.log('\n' + '='.repeat(70));
