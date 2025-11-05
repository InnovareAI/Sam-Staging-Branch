// Add a test prospect to campaign
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addTestProspect() {
  const campaignId = '5bcceaf1-ba9c-4c0e-b777-d5bade96d5a2'; // Most recent campaign
  const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

  console.log('Adding test prospect to campaign...');

  const { data, error } = await supabase
    .from('campaign_prospects')
    .insert({
      campaign_id: campaignId,
      workspace_id: workspaceId,
      first_name: 'John',
      last_name: 'TestUser',
      email: 'john.test@example.com',
      company_name: 'Test Company',
      title: 'CEO',
      linkedin_url: 'https://www.linkedin.com/in/test-user-123',
      status: 'approved',
      personalization_data: {
        source: 'manual_test',
        added_at: new Date().toISOString()
      }
    })
    .select();

  if (error) {
    console.error('❌ Failed:', error);
    return;
  }

  console.log('✅ Test prospect added:', data[0].id);
  console.log('\nNow you can:');
  console.log('1. Go to Campaigns in the UI');
  console.log('2. Find campaign: 20251031-IAI-test 4');
  console.log('3. Try to launch it');
}

addTestProspect().catch(console.error);
