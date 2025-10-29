#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking for approved prospects\n');

// Get workspace from latest campaign
const { data: campaign } = await supabase
  .from('campaigns')
  .select('workspace_id, id, name')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

console.log(`📊 Latest campaign: ${campaign.name}`);
console.log(`   ID: ${campaign.id.substring(0, 8)}...\n`);

// Check for recently approved prospects in prospect_approval_data
const { data: approvedProspects } = await supabase
  .from('prospect_approval_data')
  .select('id, name, title, company, contact, created_at')
  .eq('workspace_id', campaign.workspace_id)
  .order('created_at', { ascending: false })
  .limit(5);

console.log(`✅ Found ${approvedProspects?.length || 0} approved prospects:\n`);

approvedProspects?.forEach((p, i) => {
  console.log(`${i + 1}. ${p.name}`);
  console.log(`   Company: ${p.company?.name || 'Unknown'}`);
  console.log(`   LinkedIn: ${p.contact?.linkedin_url ? 'YES' : 'NO'}`);
  console.log(`   Created: ${p.created_at}\n`);
});

if (approvedProspects && approvedProspects.length >= 2) {
  console.log('\n💡 Ready to add to campaign!');
  console.log(`   Campaign ID: ${campaign.id}`);
  console.log(`   Use: POST /api/campaigns/add-approved-prospects`);
}
