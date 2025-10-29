#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking where prospects come from\n');

const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name')
  .order('created_at', { ascending: false })
  .limit(5);

for (const campaign of campaigns || []) {
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('personalization_data')
    .eq('campaign_id', campaign.id)
    .limit(1);
  
  if (prospects && prospects.length > 0) {
    const source = prospects[0].personalization_data?.source || 'unknown';
    console.log(`📊 ${campaign.name}`);
    console.log(`   Source: ${source}\n`);
  }
}

console.log('\n💡 How to add prospects:');
console.log('   1. LinkedIn Search → Approve → Add to campaign');
console.log('   2. Upload CSV → campaign prospects page');
console.log('   3. API: POST /api/campaigns/upload-prospects');
