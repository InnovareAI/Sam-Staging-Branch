#!/usr/bin/env node

/**
 * Test campaign execution via Inngest
 * Sends a campaign/connector/execute event directly to Inngest
 */

import { Inngest } from 'inngest';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const inngest = new Inngest({
  id: "sam-ai",
  name: "SAM AI Campaign Automation",
  eventKey: process.env.INNGEST_EVENT_KEY,
});

const campaignId = '683f9214-8a3f-4015-98fe-aa3ae76a9ebe'; // Charissa's campaign
const workspaceId = 'f67f9d54-dc3d-42d7-8b73-2ad3c01beed4'; // IA4 workspace

console.log('🧪 Testing campaign/connector/execute event...\n');

async function testCampaignEvent() {
  try {
    console.log('📤 Sending campaign execution event to Inngest...');

    const result = await inngest.send({
      name: 'campaign/connector/execute',
      data: {
        campaignId,
        workspaceId,
        accountId: '6f285a2a-7a3e-4ae0-a024-ea26a1cdb933', // Michelle's LinkedIn account
        prospects: [
          {
            id: 'test-prospect-1',
            first_name: 'Test',
            last_name: 'Prospect',
            email: 'test@example.com',
            company_name: 'Test Company',
            title: 'CEO',
            linkedin_url: 'https://www.linkedin.com/in/test-prospect',
            linkedin_user_id: null
          }
        ],
        messages: {
          connection_request: 'Hi {{first_name}}, I noticed we share an interest in...',
          follow_up_messages: [
            'Hey {{first_name}}, just following up...',
            'Hi {{first_name}}, wanted to check in...'
          ]
        },
        settings: {
          timezone: 'America/Los_Angeles',
          working_hours_start: 5,
          working_hours_end: 18,
          skip_weekends: true,
          skip_holidays: true
        }
      }
    });

    console.log('✅ Campaign event sent successfully!');
    console.log('Event ID:', result.ids[0]);
    console.log('\n📊 Check Inngest dashboard for execution:');
    console.log('https://app.inngest.com/env/production/functions');

  } catch (error) {
    console.error('❌ Error sending campaign event:', error.message);
    console.error('Error details:', error);
  }
}

testCampaignEvent().catch(console.error);
