#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CHARISSA_WORKSPACE_ID = '7f0341da-88db-476b-ae0a-fc0da5b70861';
const PROSPECT_ID = '7849e385-0b15-43cd-8f93-a9fc3cc29340';
const CAMPAIGN_ID = 'd53a5d1a-5432-4724-9574-f795863805d5';
const SARA_LINKEDIN_URL = 'https://www.linkedin.com/in/sara-ritchie-6a24b834/';

// Message IDs from Unipile
const SARA_REPLY_MSG_ID = 'BEdLymIpVXyQigMDvPq1jA';

console.log('📨 Creating reply agent draft for Sara (final)...');

// Generate approval token and expiry
const approvalToken = crypto.randomUUID();
const expiresAt = new Date();
expiresAt.setHours(expiresAt.getHours() + 48); // 48 hour expiry

const { data: draft, error: draftError } = await supabase
  .from('reply_agent_drafts')
  .insert({
    workspace_id: CHARISSA_WORKSPACE_ID,
    prospect_id: PROSPECT_ID,
    campaign_id: CAMPAIGN_ID,
    inbound_message_id: SARA_REPLY_MSG_ID,
    inbound_message_text: 'I would be happy to connect. Do you have a link to book a call?',
    inbound_message_at: '2025-12-16T00:11:34.603Z',
    channel: 'linkedin',
    prospect_name: 'Sara Ritchie',
    prospect_linkedin_url: SARA_LINKEDIN_URL,
    prospect_company: null,
    prospect_title: 'Fractional COO for Dental Practices & Companies',
    draft_text: '[Pending AI generation]',  // Required placeholder - will be replaced by reply-agent-process
    approval_token: approvalToken,
    expires_at: expiresAt.toISOString(),
    status: 'pending_generation'  // Reply Agent cron will pick this up
  })
  .select()
  .single();

if (draftError) {
  console.log(`❌ Error creating draft: ${draftError.message}`);
  process.exit(1);
}

console.log(`✅ Created draft: ${draft.id}`);
console.log(`   Status: ${draft.status}`);
console.log(`   Approval Token: ${draft.approval_token}`);

// Check if Reply Agent is enabled for Charissa's workspace
const { data: config } = await supabase
  .from('workspace_reply_agent_config')
  .select('enabled')
  .eq('workspace_id', CHARISSA_WORKSPACE_ID)
  .single();

console.log(`\n📋 Reply Agent enabled for Charissa: ${config?.enabled ?? 'NO CONFIG FOUND'}`);

if (!config?.enabled) {
  console.log('\n⚠️ Reply Agent is NOT enabled for Charissa\'s workspace!');
  console.log('   Enabling it now...');
  
  const { error: enableError } = await supabase
    .from('workspace_reply_agent_config')
    .upsert({
      workspace_id: CHARISSA_WORKSPACE_ID,
      enabled: true,
      approval_mode: 'manual',
      updated_at: new Date().toISOString()
    });
  
  if (enableError) {
    console.log(`   ❌ Failed to enable: ${enableError.message}`);
  } else {
    console.log(`   ✅ Reply Agent enabled!`);
  }
}

console.log('\n' + '='.repeat(70));
console.log('✅ SETUP COMPLETE');
console.log('   Draft ID:', draft.id);
console.log('   Status: pending_generation');
console.log('\n   Reply Agent cron will generate AI response in ~5 minutes.');
console.log('   Then notification will be sent to Google Chat/Slack for approval.');
console.log('='.repeat(70));
