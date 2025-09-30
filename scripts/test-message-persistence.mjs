/**
 * Test script to verify message persistence in sam_conversation_messages table
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMessagePersistence() {
  console.log('🔍 Testing message persistence...\n');

  // 1. Check if table exists and has RLS
  console.log('1. Checking sam_conversation_messages table...');
  const { data: tables, error: tableError } = await supabase
    .from('sam_conversation_messages')
    .select('*')
    .limit(1);

  if (tableError) {
    console.error('❌ Table check failed:', tableError.message);
    return;
  }
  console.log('✅ Table exists and is accessible\n');

  // 2. Check recent threads
  console.log('2. Checking recent threads...');
  const { data: threads, error: threadError } = await supabase
    .from('sam_conversation_threads')
    .select('id, title, created_at, user_id')
    .order('created_at', { ascending: false })
    .limit(5);

  if (threadError) {
    console.error('❌ Thread check failed:', threadError.message);
    return;
  }
  
  console.log(`✅ Found ${threads?.length || 0} recent threads\n`);
  
  if (threads && threads.length > 0) {
    // 3. Check messages for most recent thread
    const recentThread = threads[0];
    console.log(`3. Checking messages for thread: ${recentThread.title}`);
    console.log(`   Thread ID: ${recentThread.id}`);
    console.log(`   User ID: ${recentThread.user_id}\n`);
    
    const { data: messages, error: msgError } = await supabase
      .from('sam_conversation_messages')
      .select('*')
      .eq('thread_id', recentThread.id)
      .order('message_order', { ascending: true });

    if (msgError) {
      console.error('❌ Message check failed:', msgError.message);
      return;
    }

    console.log(`✅ Found ${messages?.length || 0} messages in this thread`);
    
    if (messages && messages.length > 0) {
      console.log('\n📝 Recent messages:');
      messages.slice(-3).forEach((msg, idx) => {
        console.log(`   ${idx + 1}. [${msg.role}] ${msg.content.substring(0, 60)}...`);
      });
    }
  }

  // 4. Check RLS policies
  console.log('\n4. Checking RLS policies...');
  const { data: policies, error: policyError } = await supabase
    .rpc('get_policies_for_table', { table_name: 'sam_conversation_messages' })
    .catch(() => ({ data: null, error: null }));

  if (policies && policies.length > 0) {
    console.log(`✅ Found ${policies.length} RLS policies`);
  } else {
    console.log('⚠️  Could not verify RLS policies (this might be expected)');
  }

  console.log('\n✅ Diagnostic complete!');
}

testMessagePersistence().catch(console.error);