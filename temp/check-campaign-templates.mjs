#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CHARISSA_WORKSPACE_ID = '7f0341da-88db-476b-ae0a-fc0da5b70861';

// The message that was sent to Sara
const MESSAGE_TO_SARA = `Hi Sara,

I work for InnovareAI, an AI company known for its innovative workflow automation and AI agent solutions. I'm always interested in connecting with like-minded individuals who want to learn all things AI.

Would you be open to connecting?`;

console.log('🔍 CHECKING IF MESSAGE MATCHES CAMPAIGN TEMPLATES');
console.log('='.repeat(70));

console.log('\nMessage sent to Sara:');
console.log('─'.repeat(40));
console.log(MESSAGE_TO_SARA);
console.log('─'.repeat(40));

// Get campaign message templates
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name, message_templates, connection_request_message, created_at')
  .eq('workspace_id', CHARISSA_WORKSPACE_ID)
  .order('created_at', { ascending: false });

console.log('\n\nCampaign Templates:');
for (const c of campaigns || []) {
  console.log('\n' + '─'.repeat(70));
  console.log(`Campaign: ${c.name} (Created: ${c.created_at})`);
  
  if (c.connection_request_message) {
    console.log('\nCR Message:');
    console.log(c.connection_request_message);
  }
  
  if (c.message_templates) {
    console.log('\nMessage Templates:');
    console.log(JSON.stringify(c.message_templates, null, 2));
  }
}

// Check workspace settings for default template
const { data: workspace } = await supabase
  .from('workspaces')
  .select('*')
  .eq('id', CHARISSA_WORKSPACE_ID)
  .single();

console.log('\n' + '─'.repeat(70));
console.log('Workspace settings:', workspace?.name);

console.log('\n' + '='.repeat(70));
