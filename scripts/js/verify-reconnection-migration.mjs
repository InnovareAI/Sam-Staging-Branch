import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

console.log('🔍 Checking if LinkedIn reconnection migration is applied...\n');

// Test the RPC function exists and works
try {
  const testData = {
    name: 'Test Account',
    type: 'LINKEDIN',
    connection_params: {
      im: {
        email: 'test@example.com'
      }
    }
  };

  // Try calling the function with fake data (will fail but shows if function exists)
  const { data, error } = await supabase.rpc('associate_linkedin_account_atomic', {
    p_user_id: '00000000-0000-0000-0000-000000000000', // Fake UUID
    p_workspace_id: '00000000-0000-0000-0000-000000000000', // Fake UUID
    p_unipile_account_id: 'test_account_id',
    p_account_data: testData
  });

  if (error) {
    if (error.message.includes('does not exist') || error.message.includes('not found')) {
      console.log('❌ MIGRATION NOT APPLIED!');
      console.log('   RPC function associate_linkedin_account_atomic does not exist');
      console.log('\n📋 TO FIX:');
      console.log('   1. Go to Supabase Dashboard → SQL Editor');
      console.log('   2. Run migration: supabase/migrations/20251022_create_atomic_account_association.sql');
      console.log('');
    } else if (error.message.includes('Foreign key') || error.message.includes('violates')) {
      console.log('✅ MIGRATION APPLIED!');
      console.log('   RPC function exists (got expected foreign key error with test data)');
      console.log('   Error:', error.message);
    } else {
      console.log('✅ MIGRATION LIKELY APPLIED');
      console.log('   Got error:', error.message);
    }
  } else {
    console.log('✅ MIGRATION APPLIED AND WORKING!');
    console.log('   Result:', data);
  }
} catch (err) {
  console.error('Error testing migration:', err);
}

// Check if workspace_accounts table has the right structure
console.log('\n🔍 Checking workspace_accounts table structure...\n');

const { data: tableInfo, error: tableError } = await supabase
  .from('workspace_accounts')
  .select('*')
  .limit(1);

if (tableError) {
  console.error('❌ Error querying workspace_accounts:', tableError);
} else {
  console.log('✅ workspace_accounts table accessible');
  if (tableInfo && tableInfo.length > 0) {
    console.log('   Sample columns:', Object.keys(tableInfo[0]).join(', '));

    // Check if unipile_account_id column exists
    if ('unipile_account_id' in tableInfo[0]) {
      console.log('   ✅ unipile_account_id column exists');
    } else {
      console.log('   ❌ unipile_account_id column MISSING!');
    }

    // Check if account_identifier column exists
    if ('account_identifier' in tableInfo[0]) {
      console.log('   ✅ account_identifier column exists');
    } else {
      console.log('   ❌ account_identifier column MISSING!');
    }
  }
}

console.log('\n✅ Verification complete!');
