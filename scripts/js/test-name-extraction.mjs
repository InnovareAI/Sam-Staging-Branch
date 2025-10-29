#!/usr/bin/env node
/**
 * Test name extraction from prospect_approval_data
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('🧪 Testing name extraction from prospect_approval_data\n');

  // Get one prospect from prospect_approval_data
  const { data: prospects, error } = await supabase
    .from('prospect_approval_data')
    .select(`
      *,
      prospect_approval_sessions(
        workspace_id,
        campaign_name,
        campaign_tag
      )
    `)
    .ilike('contact->>linkedin_url', '%miklos-szegedi%')
    .limit(1);

  if (error) {
    console.error('❌ Query error:', error.message);
    process.exit(1);
  }

  if (!prospects || prospects.length === 0) {
    console.log('❌ No prospects found');
    process.exit(1);
  }

  const prospect = prospects[0];

  console.log('📊 RAW PROSPECT DATA:');
  console.log(JSON.stringify(prospect, null, 2));
  console.log('\n' + '='.repeat(60));

  // Simulate the extraction logic from add-approved-prospects/route.ts
  console.log('\n🔍 NAME EXTRACTION TEST:');
  console.log(`prospect.name = "${prospect.name}"`);
  console.log(`Type: ${typeof prospect.name}`);

  const nameParts = (prospect.name || '').split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  console.log(`\nExtracted firstName: "${firstName}"`);
  console.log(`Extracted lastName: "${lastName}"`);

  if (!firstName || !lastName) {
    console.log('\n⚠️ WARNING: Name extraction failed!');
    console.log('This is why names are empty in campaign_prospects');
  } else {
    console.log('\n✅ Name extraction successful!');
  }
}

main().catch(console.error);
