import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load env
const envContent = readFileSync('.env.local', 'utf-8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  }
});

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const workspaceId = 'aa1a214c-02f0-4f3a-8849-92c7a50ee4f7';

  // First, create a test campaign for Brian
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .insert({
      workspace_id: workspaceId,
      name: 'Test Investor Outreach',
      campaign_name: 'Test Investor Outreach',
      status: 'active',
      campaign_type: 'linkedin_outreach',
      connection_message: 'Dear {first_name}, very pleased to meet you. Cheers, Brian Neirby',
      message_templates: {
        connectionRequest: 'Dear {first_name}, very pleased to meet you. Cheers, Brian Neirby',
        followUp1: 'Hi {first_name}, my name is Brian Neirby and I am the Director of ChillMine...',
        followUp2: 'Hi {first_name}, hope all is well! Just wanted to follow up with more details...'
      }
    })
    .select()
    .single();

  if (campaignError) {
    console.error('Campaign create error:', campaignError);
    return;
  }
  console.log('✅ Created test campaign:', campaign.id);

  // Create a test prospect (simulating one of Brian's investor contacts)
  const { data: prospect, error: prospectError } = await supabase
    .from('campaign_prospects')
    .insert({
      workspace_id: workspaceId,
      campaign_id: campaign.id,
      first_name: 'Marcus',
      last_name: 'Thompson',
      company: 'Venture Capital Partners',
      title: 'Managing Partner',
      linkedin_url: 'https://www.linkedin.com/in/marcus-thompson-vc',
      linkedin_user_id: 'test-marcus-thompson',
      status: 'connected',
      email: 'marcus@vcpartners.example.com'
    })
    .select()
    .single();

  if (prospectError) {
    console.error('Prospect create error:', prospectError);
    return;
  }
  console.log('✅ Created test prospect:', prospect.id);

  // Create a test reply draft with a sample investor reply
  const sampleInboundMessage = "Thanks for reaching out Brian! Interesting project and timeline. Happy to receive more info on your data storage solution. What kind of investors are you looking for?";

  const draftReply = `Marcus, appreciate the interest! ChillMine offers water-cooled data storage that's more efficient and sustainable than traditional solutions.

We're raising a pre-seed round and looking for investors who understand deep tech and infrastructure. Our pitch deck has all the details: https://chillmine.docsend.com/view/xxxxx

Worth a quick call to walk through it?

Cheers,
Brian`;

  const { data: draft, error: draftError } = await supabase
    .from('reply_agent_drafts')
    .insert({
      workspace_id: workspaceId,
      campaign_id: campaign.id,
      prospect_id: prospect.id,
      channel: 'linkedin',
      prospect_name: 'Marcus Thompson',
      prospect_company: 'Venture Capital Partners',
      prospect_title: 'Managing Partner',
      prospect_linkedin_url: prospect.linkedin_url,
      inbound_message_id: 'test-inbound-' + Date.now(),
      inbound_message_text: sampleInboundMessage,
      inbound_message_at: new Date().toISOString(),
      draft_text: draftReply,
      intent_detected: 'INTERESTED',
      status: 'pending_approval',
      ai_model: 'claude-opus-4-5-20251101',
      expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    })
    .select()
    .single();

  if (draftError) {
    console.error('Draft create error:', draftError);
    return;
  }

  console.log('✅ Created test reply draft:', draft.id);
  console.log('\n📬 Test Reply Draft Details:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Prospect:', draft.prospect_name);
  console.log('Company:', draft.prospect_company);
  console.log('Intent:', draft.intent_detected);
  console.log('\n📥 Inbound Message:');
  console.log('"' + sampleInboundMessage + '"');
  console.log('\n📤 SAM Draft Reply:');
  console.log('"' + draftReply + '"');
  console.log('\n🔗 Approval Token:', draft.approval_token);
  console.log('\n✅ Ready for review at:');
  console.log(`https://app.meet-sam.com/reply-agent/edit?id=${draft.id}&token=${draft.approval_token}`);
}

main().catch(console.error);
