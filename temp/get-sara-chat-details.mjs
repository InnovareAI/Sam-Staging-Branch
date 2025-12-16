#!/usr/bin/env node

const UNIPILE_BASE_URL = 'https://api6.unipile.com:13670';
const UNIPILE_API_KEY = '85ZMr7iE.Pw5mVHOgvpPXOl47GXXXoW0uLPvOUK23bWXD+hHuziA=';
const CHARISSA_ACCOUNT_ID = '4nt1J-blSnGUPBjH2Nfjpg';
const SARA_CHAT_ID = '66ivovBZUoGR7oyAinv5GA';

console.log('🔍 GETTING FULL DETAILS OF SARA CHAT');
console.log('='.repeat(70));

// 1. Get chat details
console.log('\n1️⃣ Chat Details...');
const chatResponse = await fetch(
  `${UNIPILE_BASE_URL}/api/v1/chats/${SARA_CHAT_ID}`,
  {
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Accept': 'application/json'
    }
  }
);

if (chatResponse.ok) {
  const chat = await chatResponse.json();
  console.log(JSON.stringify(chat, null, 2));
}

// 2. Get messages with full details
console.log('\n2️⃣ Messages with full details...');
const messagesResponse = await fetch(
  `${UNIPILE_BASE_URL}/api/v1/chats/${SARA_CHAT_ID}/messages?limit=20`,
  {
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Accept': 'application/json'
    }
  }
);

if (messagesResponse.ok) {
  const messages = await messagesResponse.json();
  console.log(JSON.stringify(messages, null, 2));
}

console.log('\n' + '='.repeat(70));
