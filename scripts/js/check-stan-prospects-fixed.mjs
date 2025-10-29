#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Stan's workspace
const workspaceId = '3e86e7b9-05a9-4b76-8336-01f1e12c1f8f';

console.log('🔍 Checking Stan Bounev prospects after company extraction\n');

// Get total count
const { count: total } = await supabase
  .from('campaign_prospects')
  .select('*', { count: 'exact', head: true })
  .eq('workspace_id', workspaceId);

// Get count with company names
const { count: withCompany } = await supabase
  .from('campaign_prospects')
  .select('*', { count: 'exact', head: true })
  .eq('workspace_id', workspaceId)
  .not('company_name', 'is', null)
  .neq('company_name', '')
  .neq('company_name', 'Unknown Company');

console.log(`📊 Prospects Status:`);
console.log(`   Total prospects: ${total}`);
console.log(`   With company names: ${withCompany}`);
console.log(`   Still missing: ${total - withCompany}`);
console.log(`   Success rate: ${Math.round((withCompany / total) * 100)}%\n`);

// Show sample of fixed prospects
const { data: samples } = await supabase
  .from('campaign_prospects')
  .select('first_name, last_name, company_name, title')
  .eq('workspace_id', workspaceId)
  .not('company_name', 'is', null)
  .neq('company_name', '')
  .neq('company_name', 'Unknown Company')
  .limit(10);

console.log('✅ Sample of prospects WITH company names:\n');
samples.forEach((p, i) => {
  console.log(`${i + 1}. ${p.first_name || '(no name)'} ${p.last_name || ''} → ${p.company_name}`);
});

// Show sample still missing
const { data: missing } = await supabase
  .from('campaign_prospects')
  .select('first_name, last_name, company_name, title')
  .eq('workspace_id', workspaceId)
  .or('company_name.is.null,company_name.eq.,company_name.eq.Unknown Company')
  .limit(10);

console.log('\n⚠️  Sample of prospects still missing company names:\n');
missing.forEach((p, i) => {
  console.log(`${i + 1}. ${p.first_name || '(no name)'} ${p.last_name || ''}`);
  console.log(`   Title: "${p.title}"`);
});

