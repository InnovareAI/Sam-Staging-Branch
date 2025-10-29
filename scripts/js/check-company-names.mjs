#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking company_name data\n');

// Check workspace_prospects
console.log('📋 workspace_prospects - Blue Label Labs:');
const { data: wpProspects } = await supabase
  .from('workspace_prospects')
  .select('id, first_name, last_name, company_name')
  .eq('workspace_id', '014509ba-226e-43ee-ba58-ab5f20d2ed08')
  .limit(10);

if (wpProspects && wpProspects.length > 0) {
  const withCompany = wpProspects.filter(p => p.company_name).length;
  const withoutCompany = wpProspects.filter(p => !p.company_name).length;
  
  console.log(`   Total prospects checked: ${wpProspects.length}`);
  console.log(`   With company_name: ${withCompany}`);
  console.log(`   WITHOUT company_name: ${withoutCompany}`);
  
  console.log('\n   Sample prospects:');
  wpProspects.slice(0, 5).forEach(p => {
    console.log(`   - ${p.first_name} ${p.last_name}: "${p.company_name || 'NULL'}"`);
  });
}

// Check campaign_prospects
console.log('\n📋 campaign_prospects - Sample from all campaigns:');
const { data: cpProspects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, company_name, campaign_id')
  .limit(20);

if (cpProspects && cpProspects.length > 0) {
  const withCompany = cpProspects.filter(p => p.company_name).length;
  const withoutCompany = cpProspects.filter(p => !p.company_name).length;
  
  console.log(`   Total prospects checked: ${cpProspects.length}`);
  console.log(`   With company_name: ${withCompany}`);
  console.log(`   WITHOUT company_name: ${withoutCompany}`);
  
  console.log('\n   Sample prospects:');
  cpProspects.slice(0, 5).forEach(p => {
    console.log(`   - ${p.first_name} ${p.last_name}: "${p.company_name || 'NULL'}"`);
  });
}

console.log('\n✅ Check complete');
