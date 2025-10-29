#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Verifying Schema Standardization\n');

// Check workspace_prospects columns
console.log('📋 workspace_prospects columns:');
const { data: wpData, error: wpError } = await supabase
  .from('workspace_prospects')
  .select('*')
  .limit(1);

if (wpError) {
  console.log('❌ Error querying workspace_prospects:', wpError.message);
} else if (wpData && wpData.length > 0) {
  const columns = Object.keys(wpData[0]).sort();
  console.log('   ' + columns.join(', '));

  // Check for new columns
  const hasNewColumns = columns.includes('linkedin_url') &&
                        columns.includes('email') &&
                        columns.includes('title');

  const hasOldColumns = columns.includes('linkedin_profile_url') ||
                        columns.includes('email_address') ||
                        columns.includes('job_title');

  console.log('\n✅ New column names:');
  console.log(`   linkedin_url: ${columns.includes('linkedin_url') ? '✓' : '✗'}`);
  console.log(`   email: ${columns.includes('email') ? '✓' : '✗'}`);
  console.log(`   title: ${columns.includes('title') ? '✓' : '✗'}`);

  console.log('\n❌ Old column names (should NOT exist):');
  console.log(`   linkedin_profile_url: ${columns.includes('linkedin_profile_url') ? '✗ STILL EXISTS' : '✓ Removed'}`);
  console.log(`   email_address: ${columns.includes('email_address') ? '✗ STILL EXISTS' : '✓ Removed'}`);
  console.log(`   job_title: ${columns.includes('job_title') ? '✗ STILL EXISTS' : '✓ Removed'}`);

  if (hasNewColumns && !hasOldColumns) {
    console.log('\n✅ MIGRATION SUCCESSFUL! Schema is now standardized.');
  } else if (hasOldColumns && !hasNewColumns) {
    console.log('\n⚠️  MIGRATION NOT YET APPLIED - Old columns still exist.');
    console.log('   Run: node scripts/js/apply-schema-standardization.mjs');
  } else {
    console.log('\n⚠️  PARTIAL MIGRATION - Both old and new columns exist!');
    console.log('   This may indicate a migration error.');
  }
} else {
  console.log('   No data to check columns');
}

// Check campaign_prospects columns for comparison
console.log('\n📋 campaign_prospects columns (for comparison):');
const { data: cpData, error: cpError } = await supabase
  .from('campaign_prospects')
  .select('*')
  .limit(1);

if (cpError) {
  console.log('❌ Error querying campaign_prospects:', wpError.message);
} else if (cpData && cpData.length > 0) {
  const columns = Object.keys(cpData[0]).sort();
  console.log('   ' + columns.join(', '));

  console.log('\n✅ Campaign prospect column names:');
  console.log(`   linkedin_url: ${columns.includes('linkedin_url') ? '✓' : '✗'}`);
  console.log(`   email: ${columns.includes('email') ? '✓' : '✗'}`);
  console.log(`   title: ${columns.includes('title') ? '✓' : '✗'}`);
}

// Test data integrity
console.log('\n🔍 Testing data integrity...');
const { count: wpCount, error: countError } = await supabase
  .from('workspace_prospects')
  .select('*', { count: 'exact', head: true });

if (countError) {
  console.log('❌ Error counting workspace_prospects:', countError.message);
} else {
  console.log(`✅ workspace_prospects table accessible: ${wpCount || 0} total prospects`);
}

console.log('\n✅ Verification complete');
