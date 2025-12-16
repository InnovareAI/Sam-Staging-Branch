#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CHARISSA_WORKSPACE_ID = '7f0341da-88db-476b-ae0a-fc0da5b70861';
const SAM_DEMO_LINK = 'https://calendar.app.google/X9GUQuzqJEJmLvgD9';
const GENERAL_AI_LINK = 'https://calendar.app.google/R9jsMVbnBzjFjqc28';

const updatedGuidelines = `## BOOKING LINKS

**DEFAULT: General AI Consultation**
${GENERAL_AI_LINK}

**SAM Demo** (ONLY use when):
- Prospect came from a SAM campaign
- Prospect specifically asks about lead gen automation
- Prospect specifically asks about LinkedIn marketing/outreach
${SAM_DEMO_LINK}

Everyone else gets the General AI link.`;

const { error } = await supabase
  .from('workspace_reply_agent_config')
  .update({
    reply_guidelines: updatedGuidelines,
    updated_at: new Date().toISOString()
  })
  .eq('workspace_id', CHARISSA_WORKSPACE_ID);

if (error) {
  console.log(`❌ Error: ${error.message}`);
} else {
  console.log(`✅ Updated Charissa's booking link instructions`);
  console.log(`\n${updatedGuidelines}`);
}
