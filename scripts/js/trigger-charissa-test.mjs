import { Inngest } from 'inngest';

const inngest = new Inngest({
  id: 'sam-ai',
  eventKey: process.env.INNGEST_EVENT_KEY
});

console.log('📤 Triggering Inngest campaign execution for Charissa (IA4)...');
console.log('   Prospect: Allan Glanfield');

const result = await inngest.send({
  name: 'campaign/connector/execute',
  data: {
    campaignId: '5bb3ac9c-eac3-475b-b2a5-5f939edace34',
    workspaceId: '7f0341da-88db-476b-ae0a-fc0da5b70861',
    prospectId: '02a2e754-a386-4824-8764-b43f80770777'
  }
});

console.log('✅ Event sent to Inngest:');
console.log('   Run IDs:', result.ids);
console.log('\n📊 Check Inngest dashboard for execution:');
console.log('   https://app.inngest.com/env/production/runs');
