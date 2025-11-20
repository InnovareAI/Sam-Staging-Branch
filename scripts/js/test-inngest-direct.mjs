#!/usr/bin/env node

/**
 * Test Inngest event sending directly
 * This bypasses API authentication to test if Inngest can receive events
 */

import { Inngest } from 'inngest';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const inngest = new Inngest({
  id: "sam-ai",
  name: "SAM AI Campaign Automation",
  eventKey: process.env.INNGEST_EVENT_KEY,
});

console.log('🧪 Testing direct Inngest event sending...\n');
console.log('Event Key present:', !!process.env.INNGEST_EVENT_KEY);
console.log('Signing Key present:', !!process.env.INNGEST_SIGNING_KEY);

async function testDirectEvent() {
  try {
    console.log('\n📤 Sending test event to Inngest...');

    const result = await inngest.send({
      name: 'test/ping',
      data: {
        message: 'Hello from SAM AI',
        timestamp: new Date().toISOString()
      }
    });

    console.log('✅ Event sent successfully!');
    console.log('Result:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ Error sending event:', error.message);
    console.error('Error details:', error);
  }
}

testDirectEvent().catch(console.error);
