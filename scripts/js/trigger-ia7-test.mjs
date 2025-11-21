import { Inngest } from 'inngest';

const inngest = new Inngest({
  id: 'sam-ai',
  eventKey: process.env.INNGEST_EVENT_KEY
});

console.log('📤 Triggering Inngest campaign execution for IA7...');

const result = await inngest.send({
  name: 'campaign/connector/execute',
  data: {
    campaignId: '02c9d97e-ae70-4be1-bc1a-9b086a767d56',
    workspaceId: '85e80099-12f9-491a-a0a1-ad48d086a9f0',
    prospectId: '13fb3658-8935-41fe-91b2-f03917754aa6'
  }
});

console.log('✅ Event sent to Inngest:');
console.log('   Run IDs:', result.ids);
console.log('\n📊 Check Inngest dashboard for execution:');
console.log('   https://app.inngest.com/env/production/runs');
