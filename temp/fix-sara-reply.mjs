#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SARA_DRAFT_ID = '9301679d-5c5d-48b3-9fb2-90246f1078cf';
const GENERAL_AI_LINK = 'https://calendar.app.google/R9jsMVbnBzjFjqc28';

// Better reply that acknowledges her role
const betterReply = `Absolutely! Here's my calendar: ${GENERAL_AI_LINK}

I saw you're a Fractional COO working with dental practices — would love to hear how you're thinking about AI for operations and client delivery.`;

const { error } = await supabase
  .from('reply_agent_drafts')
  .update({
    draft_text: betterReply,
    updated_at: new Date().toISOString()
  })
  .eq('id', SARA_DRAFT_ID);

if (error) {
  console.log(`❌ Error: ${error.message}`);
} else {
  console.log(`✅ Draft updated with personalized reply`);
  console.log(`\n📤 NEW DRAFT:`);
  console.log(`"${betterReply}"`);
}
