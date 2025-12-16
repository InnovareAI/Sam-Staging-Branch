#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SARA_DRAFT_ID = '9301679d-5c5d-48b3-9fb2-90246f1078cf';
const SAM_DEMO_LINK = 'https://calendar.app.google/X9GUQuzqJEJmLvgD9';

// Update the draft with the real booking link
const newDraftText = `Here's a link to grab time: ${SAM_DEMO_LINK}

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
  console.log(`✅ Draft updated with SAM Demo link`);
  console.log(`\n📤 NEW DRAFT:`);
  console.log(`"${newDraftText}"`);
}
