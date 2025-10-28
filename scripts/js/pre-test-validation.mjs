import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 PRE-TEST VALIDATION - COMPREHENSIVE CHECK\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

let errors = [];
let warnings = [];
let passed = 0;
let total = 0;

// Test 1: Check for prospects without names in executable statuses
console.log('1️⃣  Checking for prospects without names...');
total++;

const { data: missingNames } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, status, linkedin_url')
  .or('first_name.is.null,last_name.is.null,first_name.eq.,last_name.eq.')
  .in('status', ['pending', 'approved', 'ready_to_message'])
  .not('linkedin_url', 'is', null);

if (missingNames && missingNames.length > 0) {
  errors.push(`❌ CRITICAL: ${missingNames.length} prospects without names in executable statuses`);
  console.log(`   ❌ FAIL: ${missingNames.length} prospects missing names`);
  for (const p of missingNames.slice(0, 5)) {
    console.log(`      - ${p.linkedin_url} (status: ${p.status})`);
  }
  if (missingNames.length > 5) {
    console.log(`      ... and ${missingNames.length - 5} more`);
  }
} else {
  passed++;
  console.log('   ✅ PASS: All executable prospects have names');
}

// Test 2: Verify LinkedIn accounts are connected
console.log('\n2️⃣  Checking LinkedIn account connectivity...');
total++;

const { data: linkedinAccounts } = await supabase
  .from('workspace_accounts')
  .select('account_name, connection_status, workspace_id')
  .eq('account_type', 'linkedin');

const disconnected = linkedinAccounts?.filter(a => a.connection_status !== 'connected') || [];
if (disconnected.length > 0) {
  errors.push(`❌ CRITICAL: ${disconnected.length} LinkedIn accounts not connected`);
  console.log(`   ❌ FAIL: ${disconnected.length} accounts disconnected`);
  for (const acc of disconnected) {
    console.log(`      - ${acc.account_name}: ${acc.connection_status}`);
  }
} else {
  passed++;
  console.log(`   ✅ PASS: All ${linkedinAccounts?.length || 0} LinkedIn accounts connected`);
}

// Test 3: Verify active campaigns have message templates
console.log('\n3️⃣  Checking campaign message templates...');
total++;

const { data: activeCampaigns } = await supabase
  .from('campaigns')
  .select('id, name, connection_message, alternative_message, follow_up_messages')
  .eq('status', 'active');

let campaignsWithoutMessages = [];
for (const camp of activeCampaigns || []) {
  const hasMessage = camp.connection_message || camp.alternative_message;
  if (!hasMessage) {
    campaignsWithoutMessages.push(camp.name);
  }
}

if (campaignsWithoutMessages.length > 0) {
  errors.push(`❌ CRITICAL: ${campaignsWithoutMessages.length} active campaigns without message templates`);
  console.log(`   ❌ FAIL: Campaigns without messages`);
  for (const name of campaignsWithoutMessages) {
    console.log(`      - ${name}`);
  }
} else {
  passed++;
  console.log(`   ✅ PASS: All ${activeCampaigns?.length || 0} active campaigns have message templates`);
}

// Test 4: Verify environment variables
console.log('\n4️⃣  Checking environment variables...');
total++;

const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'UNIPILE_DSN',
  'UNIPILE_API_KEY'
];

let missingEnvVars = [];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    missingEnvVars.push(envVar);
  }
}

if (missingEnvVars.length > 0) {
  errors.push(`❌ CRITICAL: Missing environment variables: ${missingEnvVars.join(', ')}`);
  console.log('   ❌ FAIL: Missing environment variables');
  for (const envVar of missingEnvVars) {
    console.log(`      - ${envVar}`);
  }
} else {
  passed++;
  console.log('   ✅ PASS: All required environment variables present');
}

// Test 5: Check for prospects with LinkedIn URLs
console.log('\n5️⃣  Checking prospects have LinkedIn URLs...');
total++;

const { data: prospectsNoUrl } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, status')
  .in('status', ['pending', 'approved', 'ready_to_message'])
  .or('linkedin_url.is.null,linkedin_url.eq.');

if (prospectsNoUrl && prospectsNoUrl.length > 0) {
  warnings.push(`⚠️  ${prospectsNoUrl.length} prospects without LinkedIn URLs (will be skipped)`);
  console.log(`   ⚠️  WARNING: ${prospectsNoUrl.length} prospects without LinkedIn URLs`);
} else {
  passed++;
  console.log('   ✅ PASS: All prospects have LinkedIn URLs');
}

// Test 6: Verify safeguards are in place
console.log('\n6️⃣  Verifying safeguards code is deployed...');
total++;

try {
  const routeContent = await import('fs').then(fs =>
    fs.promises.readFile('app/api/campaigns/linkedin/execute-live/route.ts', 'utf-8')
  );

  const hasSafeguard = routeContent.includes('🚨 CRITICAL VALIDATION: NEVER send without names');
  const hasFirstNameCheck = routeContent.includes('if (!prospect.first_name || prospect.first_name.trim() === \'\')');
  const hasLastNameCheck = routeContent.includes('if (!prospect.last_name || prospect.last_name.trim() === \'\')');

  if (hasSafeguard && hasFirstNameCheck && hasLastNameCheck) {
    passed++;
    console.log('   ✅ PASS: Name validation safeguards are deployed');
  } else {
    errors.push('❌ CRITICAL: Name validation safeguards missing from code');
    console.log('   ❌ FAIL: Safeguards not found in execute-live route');
  }
} catch (error) {
  warnings.push('⚠️  Could not verify safeguards in code');
  console.log('   ⚠️  WARNING: Could not read route file');
}

// Test 7: Check for duplicate campaigns
console.log('\n7️⃣  Checking for duplicate campaigns...');
total++;

const { data: allCampaigns } = await supabase
  .from('campaigns')
  .select('name');

const nameCount = new Map();
for (const camp of allCampaigns || []) {
  const count = nameCount.get(camp.name) || 0;
  nameCount.set(camp.name, count + 1);
}

const duplicates = [...nameCount.entries()].filter(([name, count]) => count > 1);
if (duplicates.length > 0) {
  warnings.push(`⚠️  ${duplicates.length} duplicate campaign names found`);
  console.log(`   ⚠️  WARNING: ${duplicates.length} duplicate campaign names`);
  for (const [name, count] of duplicates) {
    console.log(`      - "${name}" (${count} times)`);
  }
} else {
  passed++;
  console.log('   ✅ PASS: No duplicate campaigns');
}

// Test 8: Verify campaigns have pending prospects
console.log('\n8️⃣  Checking active campaigns have prospects to process...');
total++;

let campaignsWithNoProspects = [];
for (const camp of activeCampaigns || []) {
  const { data: pending } = await supabase
    .from('campaign_prospects')
    .select('id')
    .eq('campaign_id', camp.id)
    .in('status', ['pending', 'approved', 'ready_to_message'])
    .limit(1);

  if (!pending || pending.length === 0) {
    campaignsWithNoProspects.push(camp.name);
  }
}

if (campaignsWithNoProspects.length > 0) {
  warnings.push(`⚠️  ${campaignsWithNoProspects.length} active campaigns have no prospects to process`);
  console.log(`   ⚠️  WARNING: ${campaignsWithNoProspects.length} campaigns have no pending prospects`);
  for (const name of campaignsWithNoProspects) {
    console.log(`      - ${name}`);
  }
} else {
  passed++;
  console.log('   ✅ PASS: All active campaigns have prospects to process');
}

// Final Summary
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 VALIDATION SUMMARY\n');

console.log(`Tests passed: ${passed}/${total}`);
console.log(`Tests failed: ${total - passed}/${total}\n`);

if (errors.length > 0) {
  console.log('❌ CRITICAL ERRORS:\n');
  for (const error of errors) {
    console.log(`   ${error}`);
  }
  console.log('');
}

if (warnings.length > 0) {
  console.log('⚠️  WARNINGS:\n');
  for (const warning of warnings) {
    console.log(`   ${warning}`);
  }
  console.log('');
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (errors.length > 0) {
  console.log('\n🚨 TEST READINESS: FAILED');
  console.log('🚨 DO NOT RUN TEST - Fix critical errors first\n');
  process.exit(1);
} else if (warnings.length > 0) {
  console.log('\n✅ TEST READINESS: READY (with warnings)');
  console.log('✅ Safe to run test, but review warnings\n');
  process.exit(0);
} else {
  console.log('\n✅ TEST READINESS: PERFECT');
  console.log('✅ All checks passed - safe to run test\n');
  process.exit(0);
}
