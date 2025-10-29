#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking ALL prospects in database\n');

// Get total counts
const { count: total } = await supabase
  .from('campaign_prospects')
  .select('*', { count: 'exact', head: true });

const { count: withCompany } = await supabase
  .from('campaign_prospects')
  .select('*', { count: 'exact', head: true })
  .not('company_name', 'is', null)
  .neq('company_name', '')
  .neq('company_name', 'Unknown Company');

const { count: missingCompany } = await supabase
  .from('campaign_prospects')
  .select('*', { count: 'exact', head: true })
  .or('company_name.is.null,company_name.eq.,company_name.eq.Unknown Company');

console.log('📊 Database-wide Status:');
console.log(`   Total prospects: ${total}`);
console.log(`   With company names: ${withCompany} (${Math.round((withCompany / total) * 100)}%)`);
console.log(`   Missing company: ${missingCompany} (${Math.round((missingCompany / total) * 100)}%)\n`);

// Get sample with company names
const { data: withCompanySample } = await supabase
  .from('campaign_prospects')
  .select('first_name, last_name, company_name, linkedin_url')
  .not('company_name', 'is', null)
  .neq('company_name', '')
  .neq('company_name', 'Unknown Company')
  .limit(5);

console.log('✅ Sample prospects WITH company names:');
withCompanySample?.forEach((p, i) => {
  console.log(`   ${i + 1}. ${p.first_name} ${p.last_name} → ${p.company_name}`);
});

// Get sample missing company
const { data: missingSample } = await supabase
  .from('campaign_prospects')
  .select('first_name, last_name, company_name, linkedin_url')
  .or('company_name.is.null,company_name.eq.,company_name.eq.Unknown Company')
  .limit(5);

console.log('\n⚠️  Sample prospects MISSING company names:');
missingSample?.forEach((p, i) => {
  console.log(`   ${i + 1}. ${p.first_name || '(no name)'} ${p.last_name || ''} → ${p.company_name || 'NULL'}`);
  console.log(`      LinkedIn: ${p.linkedin_url || 'N/A'}`);
});
