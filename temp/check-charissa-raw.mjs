#!/usr/bin/env node

const UNIPILE_BASE_URL = 'https://api6.unipile.com:13670';
const UNIPILE_API_KEY = '85ZMr7iE.Pw5mVHOgvpPXOl47GXXXoW0uLPvOUK23bWXD+hHuziA=';
const CHARISSA_ACCOUNT_ID = '4nt1J-blSnGUPBjH2Nfjpg';

// Sara Ritchie's LinkedIn vanity
const SARA_VANITY = 'sara-ritchie-6a24b834';

console.log('🔍 LOOKING UP SARA RITCHIE DIRECTLY');
console.log('='.repeat(70));

// 1. Look up Sara's profile
console.log('\n1️⃣ Looking up Sara Ritchie profile...');
const profileResponse = await fetch(
  `${UNIPILE_BASE_URL}/api/v1/users/${SARA_VANITY}?account_id=${CHARISSA_ACCOUNT_ID}`,
  {
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Accept': 'application/json'
    }
  }
);

if (!profileResponse.ok) {
  console.log('Profile lookup failed:', profileResponse.status, await profileResponse.text());
} else {
  const profile = await profileResponse.json();
  console.log('   Name:', profile.first_name, profile.last_name);
  console.log('   Provider ID:', profile.provider_id);
  console.log('   Network Distance:', profile.network_distance);

  const providerId = profile.provider_id;

  // 2. Search chats for this provider_id
  console.log('\n2️⃣ Searching chats for Sara\'s provider_id...');

  const chatsResponse = await fetch(
    `${UNIPILE_BASE_URL}/api/v1/chats?account_id=${CHARISSA_ACCOUNT_ID}&limit=50`,
    {
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    }
  );

  const chatsData = await chatsResponse.json();
  const chats = chatsData.items || [];

  // Find chat with Sara
  const saraChat = chats.find(c => c.attendee_provider_id === providerId);

  if (saraChat) {
    console.log('   ✅ FOUND CHAT WITH SARA!');
    console.log('   Chat ID:', saraChat.id);

    // Get messages
    const messagesResponse = await fetch(
      `${UNIPILE_BASE_URL}/api/v1/chats/${saraChat.id}/messages?limit=20`,
      {
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Accept': 'application/json'
        }
      }
    );

    const msgData = await messagesResponse.json();
    console.log('\n   📬 MESSAGES:');
    for (const msg of (msgData.items || []).reverse()) {
      const direction = msg.is_sender === 1 ? '→ CHARISSA' : '← SARA';
      console.log(`\n   [${direction}] (${msg.created_at})`);
      console.log(`   "${msg.text}"`);
    }
  } else {
    console.log('   ❌ No chat found with Sara\'s provider_id');
    console.log('   Checked', chats.length, 'chats');

    // Show first few provider_ids for debugging
    console.log('\n   Sample provider_ids in chats:');
    chats.slice(0, 5).forEach(c => {
      console.log(`      - ${c.attendee_provider_id}`);
    });
  }
}

console.log('\n' + '='.repeat(70));
