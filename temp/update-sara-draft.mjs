#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CHARISSA_WORKSPACE_ID = '7f0341da-88db-476b-ae0a-fc0da5b70861';
const SARA_DRAFT_ID = '9301679d-5c5d-48b3-9fb2-90246f1078cf';

console.log('📝 UPDATING CHARISSA REPLY AGENT CONFIG WITH BOOKING LINKS');
console.log('='.repeat(70));

// Update Charissa's reply agent config with booking links
const { data: config, error: configError } = await supabase
  .from('workspace_reply_agent_config')
  .select('*')
  .eq('workspace_id', CHARISSA_WORKSPACE_ID)
  .single();

if (config) {
  // Add booking links to the reply guidelines
  const updatedGuidelines = `${config.reply_guidelines || ''}

## BOOKING LINKS
When a prospect wants to book a call, choose the appropriate link based on their intent:

1. **SAM Demo** (for prospects interested in SAM/sales automation):
   https://calendar.app.google/X9GUQuzqJEJmLvgD9

2. **General AI Consultation** (for prospects interested in AI solutions broadly):
   [Ask user for this link]

Choose based on context - if they mention sales, outreach, LinkedIn automation → SAM Demo link.
If they mention general AI, workflow automation, business operations → General AI link.`;

  const { error: updateError } = await supabase
    .from('workspace_reply_agent_config')
    .update({
      reply_guidelines: updatedGuidelines,
      updated_at: new Date().toISOString()
    })
    .eq('workspace_id', CHARISSA_WORKSPACE_ID);

  if (updateError) {
    console.log(`❌ Error updating config: ${updateError.message}`);
  } else {
    console.log(`✅ Updated reply guidelines with SAM Demo booking link`);
  }
} else {
  console.log(`❌ No config found: ${configError?.message}`);
}

// Check draft status
const { data: draft } = await supabase
  .from('reply_agent_drafts')
  .select('*')
  .eq('id', SARA_DRAFT_ID)
  .single();

console.log(`\n📋 Sara's draft status: ${draft?.status}`);
console.log(`   Message: ${draft?.inbound_message_text}`);

console.log('\n' + '='.repeat(70));
