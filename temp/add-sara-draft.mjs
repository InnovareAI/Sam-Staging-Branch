#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Check reply_agent_drafts schema
const { data: draftSample } = await supabase
  .from('reply_agent_drafts')
  .select('*')
  .limit(1);

console.log('reply_agent_drafts columns:', Object.keys(draftSample?.[0] || {}));

// Check campaign_messages schema
const { data: msgSample } = await supabase
  .from('campaign_messages')
  .select('*')
  .limit(1);

console.log('campaign_messages columns:', Object.keys(msgSample?.[0] || {}));
