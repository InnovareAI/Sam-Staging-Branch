#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// First get the schema
const { data: sample } = await supabase
  .from('campaign_prospects')
  .select('*')
  .limit(1);

console.log('campaign_prospects columns:', Object.keys(sample[0]));
