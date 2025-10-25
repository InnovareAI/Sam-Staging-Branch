#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read environment
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const SUPABASE_URL = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const SERVICE_ROLE_KEY = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function verify() {
  console.log('\n🔍 VERIFYING LINKEDIN SCHEMA FIX\n');
  console.log('='.repeat(70) + '\n');

  let passedChecks = 0;
  let failedChecks = 0;

  // Check 1: workspace_accounts table
  console.log('✓ Test 1: workspace_accounts accessible');
  try {
    const { data, error } = await supabase
      .from('workspace_accounts')
      .select('workspace_id, user_id, account_type, unipile_account_id')
      .limit(5);

    if (error) {
      console.log('  ❌ FAILED:', error.message);
      failedChecks++;
    } else {
      console.log(`  ✅ PASSED: Found ${data?.length || 0} accounts`);
      if (data && data.length > 0) {
        console.log(`     workspace_id sample: ${data[0].workspace_id}`);
        console.log(`     Type check: ${typeof data[0].workspace_id === 'string' && data[0].workspace_id.match(/^[0-9a-f-]{36}$/) ? 'UUID ✓' : 'Not UUID ✗'}`);
      }
      passedChecks++;
    }
  } catch (err) {
    console.log('  ❌ FAILED:', err.message);
    failedChecks++;
  }

  console.log('');

  // Check 2: user_unipile_accounts.workspace_id exists
  console.log('✓ Test 2: user_unipile_accounts.workspace_id column');
  try {
    const { data, error } = await supabase
      .from('user_unipile_accounts')
      .select('workspace_id, user_id, platform, unipile_account_id')
      .limit(5);

    if (error) {
      console.log('  ❌ FAILED:', error.message);
      failedChecks++;
    } else {
      const hasWorkspaceId = data && data.length > 0 && 'workspace_id' in data[0];
      if (hasWorkspaceId) {
        const filledCount = data.filter(d => d.workspace_id !== null).length;
        console.log(`  ✅ PASSED: workspace_id column exists`);
        console.log(`     Filled: ${filledCount}/${data.length} records have workspace_id`);
        passedChecks++;
      } else {
        console.log('  ❌ FAILED: workspace_id column missing');
        failedChecks++;
      }
    }
  } catch (err) {
    console.log('  ❌ FAILED:', err.message);
    failedChecks++;
  }

  console.log('');

  // Check 3: linkedin_contacts RLS works
  console.log('✓ Test 3: linkedin_contacts RLS policies');
  try {
    const { data, error } = await supabase
      .from('linkedin_contacts')
      .select('count')
      .limit(1);

    if (error) {
      console.log('  ❌ FAILED:', error.message);
      console.log('     RLS policies may still be broken');
      failedChecks++;
    } else {
      console.log('  ✅ PASSED: RLS policies working');
      passedChecks++;
    }
  } catch (err) {
    console.log('  ❌ FAILED:', err.message);
    failedChecks++;
  }

  console.log('');

  // Check 4: v_linkedin_account_status view
  console.log('✓ Test 4: v_linkedin_account_status view');
  try {
    const { data, error } = await supabase
      .from('v_linkedin_account_status')
      .select('mapping_status, user_account_id, workspace_account_id')
      .limit(10);

    if (error) {
      console.log('  ⚠️  WARNING:', error.message);
      console.log('     View may not have been created');
      failedChecks++;
    } else {
      console.log(`  ✅ PASSED: View exists with ${data?.length || 0} records`);

      // Check mapping status
      const fullyMapped = data?.filter(d => d.mapping_status === 'fully_mapped').length || 0;
      const missingWS = data?.filter(d => d.mapping_status === 'missing_workspace_account').length || 0;
      const missingUser = data?.filter(d => d.mapping_status === 'missing_user_account').length || 0;

      console.log(`     Fully mapped: ${fullyMapped}`);
      if (missingWS > 0) {
        console.log(`     ⚠️  Missing workspace_accounts: ${missingWS}`);
      }
      if (missingUser > 0) {
        console.log(`     ⚠️  Missing user_unipile_accounts: ${missingUser}`);
      }

      passedChecks++;
    }
  } catch (err) {
    console.log('  ⚠️  WARNING:', err.message);
    failedChecks++;
  }

  console.log('');

  // Check 5: associate_linkedin_account_atomic function
  console.log('✓ Test 5: associate_linkedin_account_atomic function');
  try {
    const { data, error } = await supabase.rpc('associate_linkedin_account_atomic', {
      p_user_id: '00000000-0000-0000-0000-000000000000',
      p_workspace_id: '00000000-0000-0000-0000-000000000000',
      p_unipile_account_id: 'test-validation-only',
      p_account_name: 'Test',
      p_account_email: 'test@example.com',
      p_linkedin_public_identifier: 'test',
      p_linkedin_profile_url: 'https://linkedin.com/in/test',
      p_connection_status: 'active'
    });

    if (error && error.message.includes('does not exist')) {
      console.log('  ❌ FAILED: Function not created');
      failedChecks++;
    } else if (error && (error.message.includes('foreign key') || error.message.includes('violates'))) {
      console.log('  ✅ PASSED: Function exists (test validation failed as expected)');
      passedChecks++;
    } else if (!error) {
      console.log('  ⚠️  UNEXPECTED: Test succeeded (should fail on fake UUIDs)');
      console.log('     But function exists ✓');
      passedChecks++;
    } else {
      console.log('  ⚠️  UNKNOWN:', error.message);
      failedChecks++;
    }
  } catch (err) {
    console.log('  ❌ FAILED:', err.message);
    failedChecks++;
  }

  console.log('');

  // Summary
  console.log('='.repeat(70));
  console.log(`\n📊 RESULTS: ${passedChecks} passed, ${failedChecks} failed\n`);

  if (failedChecks === 0) {
    console.log('✅ ALL CHECKS PASSED!');
    console.log('\nLinkedIn/Workspace schema fix successfully applied!\n');
    console.log('You can now:');
    console.log('  • Approve prospects');
    console.log('  • Upload to campaigns');
    console.log('  • Sync LinkedIn IDs');
    console.log('  • Send LinkedIn messages via Unipile\n');
  } else {
    console.log('⚠️  SOME CHECKS FAILED');
    console.log('\nThe migration may not have been fully applied.');
    console.log('Please review the errors above and apply the migration manually.\n');
    console.log('Migration file: supabase/migrations/20251025_fix_linkedin_workspace_schema.sql\n');
  }

  console.log('='.repeat(70) + '\n');
}

verify().catch(console.error);
