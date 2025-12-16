#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SARA_DRAFT_ID = '9301679d-5c5d-48b3-9fb2-90246f1078cf';
const GENERAL_AI_LINK = 'https://calendar.app.google/R9jsMVbnBzjFjqc28';

// Update the draft with General AI link (better fit for Fractional COO)
const newDraftText = `Here's a link to grab time: ${GENERAL_AI_LINK}

Before we chat — what's your business focused on? Want to make sure the call is actually useful for you.`;

const { error } = await supabase
  .from('reply_agent_drafts')
  .update({
    draft_text: newDraftText,
    updated_at: new Date().toISOString()
  })
  .eq('id', SARA_DRAFT_ID);

if (error) {
  console.log(`❌ Error: ${error.message}`);
} else {
  console.log(`✅ Draft updated with General AI link`);
  console.log(`\n📤 FINAL DRAFT FOR SARA:`);
  console.log(`"${newDraftText}"`);
}

// Also update Charissa's config with both links
const CHARISSA_WORKSPACE_ID = '7f0341da-88db-476b-ae0a-fc0da5b70861';
const SAM_DEMO_LINK = 'https://calendar.app.google/X9GUQuzqJEJmLvgD9';

const { data: config } = await supabase
  .from('workspace_reply_agent_config')
  .select('reply_guidelines')
  .eq('workspace_id', CHARISSA_WORKSPACE_ID)
  .single();

const updatedGuidelines = `## BOOKING LINKS
When a prospect wants to book a call, choose the appropriate link based on their intent:

1. **SAM Demo** (for prospects interested in SAM/sales automation/LinkedIn outreach):
   ${SAM_DEMO_LINK}

2. **General AI Consultation** (for prospects interested in AI solutions broadly/workflow automation):
   ${GENERAL_AI_LINK}

Choose based on context:
- Sales, outreach, LinkedIn automation, lead gen → SAM Demo
- General AI, workflow automation, business operations, consulting → General AI`;

await supabase
  .from('workspace_reply_agent_config')
  .update({
    reply_guidelines: updatedGuidelines,
    updated_at: new Date().toISOString()
  })
  .eq('workspace_id', CHARISSA_WORKSPACE_ID);

console.log(`\n✅ Charissa's config updated with both booking links`);
