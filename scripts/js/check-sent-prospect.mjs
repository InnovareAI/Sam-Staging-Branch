#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Check the prospect that was just sent
const { data: prospect } = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('linkedin_url', 'https://www.linkedin.com/in/hakima-mokrane-phd-956b6928')
  .single();

console.log('📊 Prospect Details After Send:\n');
console.log('Name:', prospect.first_name, prospect.last_name);
console.log('Status:', prospect.status);
console.log('Contacted At:', prospect.contacted_at);
console.log('LinkedIn URL:', prospect.linkedin_url);
console.log('\nPersonalization Data:');
console.log(JSON.stringify(prospect.personalization_data, null, 2));
