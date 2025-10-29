#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking existing connection_requested prospects\n');

const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, contacted_at, personalization_data')
  .eq('status', 'connection_requested')
  .order('contacted_at', { ascending: false })
  .limit(10);

console.log(`Found ${prospects?.length || 0} connection_requested prospects\n`);

let withProviderId = 0;
let withoutProviderId = 0;

prospects?.forEach(p => {
  const hasProviderId = !!p.personalization_data?.provider_id;
  if (hasProviderId) withProviderId++;
  else withoutProviderId++;
  
  console.log(`${p.first_name || 'Unknown'} ${p.last_name || ''}`);
  console.log(`  Sent: ${p.contacted_at}`);
  console.log(`  Provider ID: ${hasProviderId ? '✅ Yes' : '❌ Missing'}`);
  console.log();
});

console.log('Summary:');
console.log(`  ✅ With provider_id: ${withProviderId} (can receive follow-ups)`);
console.log(`  ❌ Without provider_id: ${withoutProviderId} (detection only)`);
console.log();

if (withoutProviderId > 0) {
  console.log('⚠️  Prospects without provider_id:');
  console.log('   - CAN be detected when accepted');
  console.log('   - CANNOT receive follow-ups automatically');
  console.log('   - Were sent before enrichment fix');
}
