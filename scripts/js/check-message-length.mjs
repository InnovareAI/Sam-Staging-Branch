#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: campaign } = await supabase
  .from('campaigns')
  .select('*')
  .eq('id', 'a06abf27-4d2b-4f1b-b766-fbf3345f14fc')
  .single();

const msg = campaign.message_templates.connection_request;

console.log('Original Message:');
console.log(msg);
console.log();
console.log('Length:', msg.length);
console.log('With \\n chars:', msg.replace(/\n/g, '\\n').length);
console.log();

// Test personalization
const personalized = msg
  .replace(/\{first_name\}/gi, 'Seema')
  .replace(/\{company\}/gi, 'Cross-border expansion. Bridging India and Canada through partnerships that connect startups, innovation, education, and impact. Ex-TBDC, Dentsu, Perfect Relations');

console.log('Personalized:');
console.log(personalized);
console.log();
console.log('Length:', personalized.length);
console.log();

console.log('ISSUE: Newline characters (\\n) count in the length!');
console.log('Need to remove or replace newlines with spaces');
