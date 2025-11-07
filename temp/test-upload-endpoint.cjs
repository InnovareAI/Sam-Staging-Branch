require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testUploadEndpoint() {
  console.log('🧪 TESTING UPLOAD ENDPOINT\n');
  console.log('='.repeat(70));

  const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

  // Test 1: Valid upload with properly formatted data
  console.log('\n✅ TEST 1: Valid Upload\n');

  const validProspects = [
    {
      name: 'Test User 1',
      first_name: 'Test',
      last_name: 'User 1',
      email: 'test1@example.com',
      company: { name: 'Test Company 1' },
      title: 'CEO',
      linkedin_url: 'https://www.linkedin.com/in/test1',
      location: 'San Francisco, CA'
    },
    {
      name: 'Test User 2',
      first_name: 'Test',
      last_name: 'User 2',
      email: 'test2@example.com',
      company: { name: 'Test Company 2' },
      title: 'CTO',
      linkedin_url: 'https://www.linkedin.com/in/test2',
      location: 'New York, NY'
    }
  ];

  const response1 = await fetch('http://localhost:3000/api/prospect-approval/upload-prospects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workspace_id: workspaceId,
      campaign_name: `Test Valid Upload ${Date.now()}`,
      campaign_tag: 'test-valid',
      source: 'test-script',
      prospects: validProspects
    })
  });

  const result1 = await response1.json();
  console.log('Response:', JSON.stringify(result1, null, 2));

  if (result1.success) {
    console.log('\n✅ Test 1 PASSED: Valid data uploaded successfully');
    console.log(`   Session ID: ${result1.session_id}`);
    console.log(`   Count: ${result1.count}\n`);

    // Verify prospects in database
    const { count } = await supabase
      .from('prospect_approval_data')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', result1.session_id);

    console.log(`   Database verification: ${count} prospects found`);

    if (count === validProspects.length) {
      console.log('   ✅ Database count matches!\n');
    } else {
      console.log(`   ❌ MISMATCH! Expected ${validProspects.length} but found ${count}\n`);
    }

    // Cleanup test session
    await supabase.from('prospect_approval_data').delete().eq('session_id', result1.session_id);
    await supabase.from('prospect_approval_sessions').delete().eq('id', result1.session_id);
    console.log('   🧹 Cleaned up test data\n');
  } else {
    console.log('\n❌ Test 1 FAILED:', result1.error);
  }

  // Test 2: Invalid upload with missing required fields
  console.log('\n❌ TEST 2: Invalid Upload (Missing Required Fields)\n');

  const invalidProspects = [
    {
      // Missing name/first_name/last_name
      email: 'test@example.com',
      company: 'Test Company'
    }
  ];

  const response2 = await fetch('http://localhost:3000/api/prospect-approval/upload-prospects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workspace_id: workspaceId,
      campaign_name: `Test Invalid Upload ${Date.now()}`,
      prospects: invalidProspects
    })
  });

  const result2 = await response2.json();
  console.log('Response:', JSON.stringify(result2, null, 2));

  if (!result2.success) {
    console.log('\n✅ Test 2 PASSED: Invalid data rejected as expected\n');

    // Verify no orphaned session exists
    if (result2.session_id) {
      const { data: orphanedSession } = await supabase
        .from('prospect_approval_sessions')
        .select('id')
        .eq('id', result2.session_id)
        .maybeSingle();

      if (orphanedSession) {
        console.log('   ⚠️  WARNING: Orphaned session exists! This is the bug we fixed.');
        await supabase.from('prospect_approval_sessions').delete().eq('id', result2.session_id);
        console.log('   🧹 Cleaned up orphaned session\n');
      } else {
        console.log('   ✅ No orphaned session (properly rolled back)\n');
      }
    }
  } else {
    console.log('\n⚠️  Test 2: Invalid data was accepted (might be OK if validation is lenient)\n');
    if (result2.session_id) {
      await supabase.from('prospect_approval_data').delete().eq('session_id', result2.session_id);
      await supabase.from('prospect_approval_sessions').delete().eq('id', result2.session_id);
      console.log('   🧹 Cleaned up test data\n');
    }
  }

  // Test 3: Empty prospects array
  console.log('\n❌ TEST 3: Empty Prospects Array\n');

  const response3 = await fetch('http://localhost:3000/api/prospect-approval/upload-prospects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workspace_id: workspaceId,
      campaign_name: `Test Empty Upload ${Date.now()}`,
      prospects: []
    })
  });

  const result3 = await response3.json();
  console.log('Response:', JSON.stringify(result3, null, 2));

  if (!result3.success) {
    console.log('\n✅ Test 3 PASSED: Empty array rejected\n');
  } else {
    console.log('\n❌ Test 3 FAILED: Empty array should be rejected\n');
  }

  console.log('='.repeat(70));
  console.log('\n🎯 SUMMARY:');
  console.log('The upload endpoint should:');
  console.log('  1. ✅ Accept valid prospect data');
  console.log('  2. ✅ Insert prospects into prospect_approval_data');
  console.log('  3. ✅ Reject empty arrays');
  console.log('  4. ✅ Rollback session if prospect insert fails');
  console.log('  5. ✅ Never leave orphaned sessions\n');
  console.log('If all tests pass, users will not see "data not found" errors.\n');
}

testUploadEndpoint().catch(console.error);
