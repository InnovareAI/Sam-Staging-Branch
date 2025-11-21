#!/usr/bin/env node
/**
 * Trigger IA7 campaign via Inngest API
 */

import { Inngest } from 'inngest';

const inngest = new Inngest({
  id: 'sam-ai',
  eventKey: process.env.INNGEST_EVENT_KEY
});

const CAMPAIGN_ID = '02c9d97e-ae70-4be1-bc1a-9b086a767d56';
const WORKSPACE_ID = '85e80099-12f9-491a-a0a1-ad48d086a9f0';
const ACCOUNT_ID = 'xT9TYxlYTTC1ukKenVPhLA';

const prospects = [{
  id: '13fb3658-8935-41fe-91b2-f03917754aa6',
  first_name: 'christian',
  last_name: 'woerle',
  email: null,
  company_name: 'unavailable',
  title: 'Climate+Tech AI Think-tank / Interim CTO / Business Angel / Digital Innovation',
  linkedin_url: 'https://www.linkedin.com/in/christian-woerle-06617b10b',
  linkedin_user_id: null
}];

const messages = {
  connection_request: "Hi Christian, your work in climate tech and digital innovation caught my attention. As someone working in B2B SaaS, I'd love to connect and explore potential synergies in the tech innovation space.",
  follow_up_messages: [
    "Hello Christian, thanks for connecting! I noticed your experience with climate tech AI and digital innovation. I'm curious about your thoughts on how AI is transforming sustainability solutions in the SaaS space. Would you be open to a brief exchange of ideas?",
    "Quick follow-up - I recently came across an interesting case study on AI-driven sustainability solutions in SaaS. Given your background in climate tech, I thought you might find it valuable. Would you be interested in taking a look?",
    "I've been working on some innovative B2B SaaS solutions that align with sustainable tech practices. Your expertise in this area would be invaluable - perhaps we could schedule a 15-minute call to exchange insights?",
    "Just reaching out one more time - I believe there could be some interesting collaboration opportunities given our shared interest in tech innovation and sustainability. Would you be open to a brief discussion?",
    "I respect that timing might not be right, but I'll keep following your work in the climate tech space. Feel free to reach out if you'd like to connect in the future. Wishing you continued success!"
  ]
};

console.log('🚀 TRIGGERING IA7 CAMPAIGN VIA INNGEST\n');

try {
  const result = await inngest.send({
    name: 'campaign/connector/execute',
    data: {
      campaignId: CAMPAIGN_ID,
      workspaceId: WORKSPACE_ID,
      accountId: ACCOUNT_ID,
      prospects,
      messages,
      settings: {
        timezone: 'America/Los_Angeles',
        working_hours_start: 5,
        working_hours_end: 18,
        skip_weekends: true,
        skip_holidays: true
      }
    }
  });

  console.log('✅ Inngest event sent successfully!');
  console.log('   Event IDs:', result.ids);
  console.log('\n📊 View execution at:');
  console.log(`   https://app.inngest.com/env/production/runs/${result.ids[0]}`);

} catch (error) {
  console.error('\n❌ ERROR:', error.message);
  console.error('   Stack:', error.stack);
  process.exit(1);
}
