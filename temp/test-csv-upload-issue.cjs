require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testCSVUploadIssue() {
  console.log('🔍 TESTING CSV UPLOAD ISSUE - Data Disappearing\n');
  console.log('='.repeat(70));

  const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

  // Get a recent user for this workspace
  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .limit(1);

  if (!members || members.length === 0) {
    console.log('❌ No workspace members found');
    return;
  }

  const userId = members[0].user_id;

  // Create a test session
  console.log('\n1️⃣ Creating test approval session...');

  const { data: session, error: sessionError } = await supabase
    .from('prospect_approval_sessions')
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      campaign_name: 'CSV Upload Test',
      campaign_tag: 'csv-test',
      prospect_source: 'test',
      total_prospects: 2,
      pending_count: 2,
      approved_count: 0,
      rejected_count: 0,
      status: 'active'
    })
    .select()
    .single();

  if (sessionError) {
    console.log('❌ Error creating session:', sessionError.message);
    return;
  }

  console.log(`✅ Session created: ${session.id}`);

  // Insert test prospects
  console.log('\n2️⃣ Inserting test prospects...');

  const testProspects = [
    {
      session_id: session.id,
      prospect_id: `test_${Date.now()}_1`,
      workspace_id: workspaceId,
      name: 'Test User 1',
      title: 'CEO',
      company: { name: 'Test Company 1' },
      location: 'San Francisco',
      contact: {
        email: 'test1@example.com',
        linkedin_url: 'https://linkedin.com/in/test1',
        phone: ''
      },
      source: 'test',
      enrichment_score: 70,
      approval_status: 'pending'
    },
    {
      session_id: session.id,
      prospect_id: `test_${Date.now()}_2`,
      workspace_id: workspaceId,
      name: 'Test User 2',
      title: 'CTO',
      company: { name: 'Test Company 2' },
      location: 'New York',
      contact: {
        email: 'test2@example.com',
        linkedin_url: 'https://linkedin.com/in/test2',
        phone: ''
      },
      source: 'test',
      enrichment_score: 70,
      approval_status: 'pending'
    }
  ];

  const { data: insertedData, error: insertError } = await supabase
    .from('prospect_approval_data')
    .insert(testProspects)
    .select();

  if (insertError) {
    console.log('❌ Error inserting prospects:', insertError.message);
    console.log('   Details:', insertError.details);

    // Cleanup
    await supabase.from('prospect_approval_sessions').delete().eq('id', session.id);
    return;
  }

  console.log('✅ Insert completed');
  console.log('   Expected to insert:', testProspects.length);
  console.log('   Actually returned:', insertedData?.length || 0);

  if (!insertedData || insertedData.length === 0) {
    console.log('\n⚠️  WARNING: No data returned from insert!');
    console.log('   This is likely an RLS policy blocking the SELECT');
    console.log('   The data WAS inserted but .select() cannot see it');
  }

  // Check if data exists in database
  console.log('\n3️⃣ Verifying data in database...');

  const { data: dbData, count } = await supabase
    .from('prospect_approval_data')
    .select('*', { count: 'exact' })
    .eq('session_id', session.id);

  console.log(`   Found ${count} records in database`);

  if (count !== testProspects.length) {
    console.log(`   ❌ MISMATCH! Expected ${testProspects.length}, found ${count}`);
    console.log('   This would trigger the rollback in upload-csv route!');
  } else {
    console.log('   ✅ Count matches!');
  }

  // Wait a moment
  console.log('\n4️⃣ Waiting 3 seconds...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Check if data still exists
  console.log('\n5️⃣ Re-checking data after delay...');

  const { count: count2 } = await supabase
    .from('prospect_approval_data')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', session.id);

  console.log(`   Found ${count2} records`);

  if (count2 === 0) {
    console.log('   ❌ DATA DISAPPEARED! Something deleted it!');
  } else if (count2 !== count) {
    console.log(`   ⚠️  Count changed from ${count} to ${count2}`);
  } else {
    console.log('   ✅ Data still there!');
  }

  // Cleanup
  console.log('\n6️⃣ Cleaning up test data...');
  await supabase.from('prospect_approval_data').delete().eq('session_id', session.id);
  await supabase.from('prospect_approval_sessions').delete().eq('id', session.id);

  console.log('\n' + '='.repeat(70));
  console.log('\n🎯 DIAGNOSIS:');

  if (!insertedData || insertedData.length === 0) {
    console.log('❌ PROBLEM FOUND: .select() returns empty even though insert succeeds');
    console.log('   This causes insertedCount !== expectedCount');
    console.log('   Which triggers the rollback that deletes all data');
    console.log('\n💡 SOLUTION: Remove .select() or fix RLS policy');
  } else if (count2 === 0) {
    console.log('❌ PROBLEM FOUND: Data is being deleted by something else');
    console.log('   Not the rollback logic - external cleanup?');
  } else {
    console.log('✅ No issue detected in this test');
    console.log('   The problem may be specific to user uploads');
  }

  console.log('');
}

testCSVUploadIssue().catch(console.error);
