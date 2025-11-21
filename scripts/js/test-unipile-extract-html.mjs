#!/usr/bin/env node
import { UnipileClient } from 'unipile-node-sdk';

const unipile = new UnipileClient(
  `https://${process.env.UNIPILE_DSN}`,
  process.env.UNIPILE_API_KEY
);

const ACCOUNT_ID = 'xT9TYxlYTTC1ukKenVPhLA';
const LINKEDIN_URL = 'https://www.linkedin.com/in/christian-woerle-06617b10b';

console.log('🧪 EXTRACTING HTML ERROR\n');

try {
  const profile = await unipile.users.getProfile({
    account_id: ACCOUNT_ID,
    identifier: LINKEDIN_URL
  });
  
  console.log('✅ SUCCESS:', profile);
  
} catch (error) {
  if (error.body && error.body.text) {
    console.log('📄 HTML RESPONSE:');
    const html = await error.body.text();
    console.log(html);
  } else if (error.body) {
    console.log('📄 BLOB RESPONSE - Type:', error.body.type);
    console.log('📄 BLOB RESPONSE - Size:', error.body.size);
    
    // Extract blob content
    const reader = error.body.stream().getReader();
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const blob = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      blob.set(chunk, offset);
      offset += chunk.length;
    }
    const text = new TextDecoder().decode(blob);
    console.log('📄 EXTRACTED TEXT:');
    console.log(text);
  }
  
  process.exit(1);
}
