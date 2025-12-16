#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CHARISSA_WORKSPACE_ID = '7f0341da-88db-476b-ae0a-fc0da5b70861';
const SARA_PROVIDER_ID = 'ACoAAAcxZNoBOO3uKSFEtKndR6hFtahdCk0Gj_Y';
const SARA_LINKEDIN_URL = 'https://www.linkedin.com/in/sara-ritchie-6a24b834/';

console.log('🔧 ADDING SARA RITCHIE TO DATABASE');
console.log('='.repeat(70));

// 1. Get a campaign to add her to
const { data: campaign } = await supabase
  .from('campaigns')
  .select('id, name, linkedin_account_id')
  .eq('workspace_id', CHARISSA_WORKSPACE_ID)
  .eq('status', 'active')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

console.log(`\n✓ Using campaign: ${campaign.name} (${campaign.id})`);

// 2. Get Sara's profile from Unipile
const UNIPILE_BASE_URL = 'https://api6.unipile.com:13670';
const UNIPILE_API_KEY = '85ZMr7iE.Pw5mVHOgvpPXOl47GXXXoW0uLPvOUK23bWXD+hHuziA=';
const CHARISSA_ACCOUNT_ID = '4nt1J-blSnGUPBjH2Nfjpg';

console.log('\n📋 Fetching Sara\'s profile from Unipile...');
const profileResponse = await fetch(
  `${UNIPILE_BASE_URL}/api/v1/users/sara-ritchie-6a24b834?account_id=${CHARISSA_ACCOUNT_ID}`,
  {
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Accept': 'application/json'
    }
  }
);

const profile = await profileResponse.json();
console.log(`   Name: ${profile.first_name} ${profile.last_name}`);
console.log(`   Headline: ${profile.headline?.slice(0, 80)}...`);
console.log(`   Location: ${profile.location}`);

// 3. Create the prospect record with correct column names
console.log('\n📝 Creating prospect record...');
const { data: prospect, error } = await supabase
  .from('campaign_prospects')
  .insert({
    campaign_id: campaign.id,
    workspace_id: CHARISSA_WORKSPACE_ID,
    first_name: profile.first_name || 'Sara',
    last_name: profile.last_name || 'Ritchie',
    linkedin_url: SARA_LINKEDIN_URL,
    linkedin_user_id: SARA_PROVIDER_ID,
    company_name: profile.current_company_name || null,
    title: profile.headline || null,
    location: profile.location || null,
    status: 'replied',
    responded_at: '2025-12-16T00:11:34.603Z',
    contacted_at: '2025-12-02T15:16:55.919Z',
    connection_accepted_at: '2025-12-16T00:11:00.000Z',  // She accepted to reply
    unipile_account_id: CHARISSA_ACCOUNT_ID,
    connection_degree: 1
  })
  .select()
  .single();

if (error) {
  console.log(`❌ Error creating prospect: ${error.message}`);
  process.exit(1);
}

console.log(`✅ Created prospect: ${prospect.id}`);

// 4. Create a reply_agent_drafts entry for her reply
console.log('\n📨 Creating reply agent draft...');
const { data: draft, error: draftError } = await supabase
  .from('reply_agent_drafts')
  .insert({
    workspace_id: CHARISSA_WORKSPACE_ID,
    prospect_id: prospect.id,
    campaign_id: campaign.id,
    original_message: 'I would be happy to connect. Do you have a link to book a call?',
    original_message_timestamp: '2025-12-16T00:11:34.603Z',
    status: 'pending_generation',
    channel: 'linkedin',
    created_at: new Date().toISOString()
  })
  .select()
  .single();

if (draftError) {
  console.log(`❌ Error creating draft: ${draftError.message}`);
} else {
  console.log(`✅ Created draft: ${draft.id}`);
}

// 5. Log the conversation history
console.log('\n💬 Recording conversation in campaign_messages...');
const { error: msgError } = await supabase
  .from('campaign_messages')
  .insert([
    {
      workspace_id: CHARISSA_WORKSPACE_ID,
      campaign_id: campaign.id,
      prospect_id: prospect.id,
      recipient_name: 'Sara Ritchie',
      recipient_linkedin_profile: SARA_LINKEDIN_URL,
      message_type: 'connection_request',
      message_content: `Hi Sara,

I work for InnovareAI, an AI company known for its innovative workflow automation and AI agent solutions. I'm always interested in connecting with like-minded individuals who want to learn all things AI.

Would you be open to connecting?`,
      sent_at: '2025-12-02T15:16:55.919Z',
      direction: 'outbound'
    },
    {
      workspace_id: CHARISSA_WORKSPACE_ID,
      campaign_id: campaign.id,
      prospect_id: prospect.id,
      recipient_name: 'Sara Ritchie',
      recipient_linkedin_profile: SARA_LINKEDIN_URL,
      message_type: 'reply',
      message_content: 'I would be happy to connect. Do you have a link to book a call?',
      sent_at: '2025-12-16T00:11:34.603Z',
      direction: 'inbound'
    }
  ]);

if (msgError) {
  console.log(`⚠️ Error recording messages: ${msgError.message}`);
} else {
  console.log(`✅ Conversation history recorded`);
}

console.log('\n' + '='.repeat(70));
console.log('✅ SARA RITCHIE ADDED TO DATABASE');
console.log('   Prospect ID:', prospect.id);
console.log('   Status: replied');
console.log('   Draft Status: pending_generation');
console.log('='.repeat(70));
