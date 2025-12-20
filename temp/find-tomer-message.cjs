const https = require('https');

const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

// Correct Thorsten account ID from the database
const THORSTEN_ACCOUNT_ID = '09Uv5wIaSFOiN2gru_svbA';

async function findTomer() {
  console.log('🔍 Looking for Tomer Sagi message in Thorsten\'s account...\n');
  console.log('Account ID:', THORSTEN_ACCOUNT_ID);

  // 1. Get all chats
  console.log('\n=== Getting Chats ===');
  const chats = await getChats();

  // Look for Tomer in the chats
  const tomerChat = chats.find(c =>
    c.attendee_name?.toLowerCase().includes('tomer') ||
    c.title?.toLowerCase().includes('tomer')
  );

  if (tomerChat) {
    console.log('\n✅ Found Tomer\'s chat!');
    console.log('Chat ID:', tomerChat.id);
    console.log('Attendee:', tomerChat.attendee_name);
    console.log('Last message:', tomerChat.last_message_text);
    console.log('Is sender (them?):', tomerChat.last_message_is_sender);

    // Get messages from this chat
    console.log('\n=== Messages in Tomer\'s Chat ===');
    await getMessagesFromChat(tomerChat.id);
  } else {
    console.log('\n❌ No chat found for Tomer');
    console.log('Available chats:', chats.map(c => c.attendee_name || c.title || 'Unknown').join(', '));
  }

  // Also check recent messages
  console.log('\n\n=== All Recent Messages ===');
  await getRecentMessages();
}

function getChats() {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api6.unipile.com',
      port: 13670,
      path: `/api/v1/chats?account_id=${THORSTEN_ACCOUNT_ID}&limit=30`,
      method: 'GET',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log(`Found ${result.items?.length || 0} chats`);
          resolve(result.items || []);
        } catch (e) {
          console.log('Error:', data.slice(0, 200));
          resolve([]);
        }
      });
    });
    req.on('error', (e) => { console.log('Error:', e.message); resolve([]); });
    req.end();
  });
}

function getMessagesFromChat(chatId) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api6.unipile.com',
      port: 13670,
      path: `/api/v1/chats/${chatId}/messages?limit=10`,
      method: 'GET',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          const messages = result.items || [];
          messages.forEach((msg, i) => {
            const direction = msg.is_sender ? '➡️ OUTBOUND' : '⬅️ INBOUND';
            console.log(`${i+1}. ${direction} - ${msg.created_at}`);
            console.log(`   "${msg.text?.slice(0, 100)}..."`);
          });
        } catch (e) {
          console.log('Error:', data.slice(0, 200));
        }
        resolve();
      });
    });
    req.on('error', (e) => { console.log('Error:', e.message); resolve(); });
    req.end();
  });
}

function getRecentMessages() {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api6.unipile.com',
      port: 13670,
      path: `/api/v1/messages?account_id=${THORSTEN_ACCOUNT_ID}&limit=20`,
      method: 'GET',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          const messages = result.items || [];
          console.log(`Found ${messages.length} messages total`);

          const inbound = messages.filter(m => m.is_sender === 0);
          console.log(`\nInbound messages: ${inbound.length}`);

          inbound.slice(0, 5).forEach((msg, i) => {
            console.log(`\n${i+1}. From: ${msg.sender_name || msg.sender_id}`);
            console.log(`   Date: ${msg.created_at}`);
            console.log(`   Text: "${msg.text?.slice(0, 100)}"`);
          });
        } catch (e) {
          console.log('Error:', data.slice(0, 200));
        }
        resolve();
      });
    });
    req.on('error', (e) => { console.log('Error:', e.message); resolve(); });
    req.end();
  });
}

findTomer();
