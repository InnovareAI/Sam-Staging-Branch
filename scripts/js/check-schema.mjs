#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking Database Schemas\n');

// Check workspace_prospects schema
console.log('📋 workspace_prospects columns:');
const { data: wpData } = await supabase
  .from('workspace_prospects')
  .select('*')
  .limit(1);

if (wpData && wpData.length > 0) {
  console.log(Object.keys(wpData[0]).sort().join(', '));
} else {
  console.log('   No data to check columns');
}

// Check campaign_prospects schema
console.log('\n📋 campaign_prospects columns:');
const { data: cpData } = await supabase
  .from('campaign_prospects')
  .select('*')
  .limit(1);

if (cpData && cpData.length > 0) {
  console.log(Object.keys(cpData[0]).sort().join(', '));
} else {
  console.log('   No data to check columns');
}

console.log('\n✅ Schema check complete');
