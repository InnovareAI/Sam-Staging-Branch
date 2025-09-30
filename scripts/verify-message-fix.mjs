import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyFix() {
  console.log('🔍 Verifying message persistence fix...\n');

  // 1. Check if new columns exist
  console.log('1. Checking for new columns...');
  const { data: columns, error } = await supabase
    .from('sam_conversation_messages')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  const requiredColumns = ['user_id', 'message_order', 'has_prospect_intelligence', 'prospect_intelligence_data', 'message_metadata'];
  const hasColumns = columns && columns.length > 0;
  
  if (hasColumns) {
    const existingColumns = Object.keys(columns[0]);
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    
    if (missingColumns.length === 0) {
      console.log('✅ All required columns are present!\n');
    } else {
      console.log('⚠️  Missing columns:', missingColumns.join(', '), '\n');
    }
  } else {
    console.log('⚠️  No data to verify columns\n');
  }

  // 2. Check recent threads
  console.log('2. Checking for recent threads...');
  const { data: threads } = await supabase
    .from('sam_conversation_threads')
    .select('id, title, user_id')
    .order('created_at', { ascending: false })
    .limit(3);

  if (threads && threads.length > 0) {
    console.log(`✅ Found ${threads.length} recent threads\n`);
    
    // 3. Check messages in most recent thread
    const thread = threads[0];
    console.log(`3. Checking messages in: "${thread.title}"`);
    const { data: messages } = await supabase
      .from('sam_conversation_messages')
      .select('id, role, content, message_order, user_id')
      .eq('thread_id', thread.id)
      .order('message_order', { ascending: true });

    if (messages && messages.length > 0) {
      console.log(`✅ Found ${messages.length} messages in this thread\n`);
      console.log('📝 Last 3 messages:');
      messages.slice(-3).forEach((msg, idx) => {
        console.log(`   ${idx + 1}. [${msg.role}] Order: ${msg.message_order} - ${msg.content.substring(0, 50)}...`);
      });
    } else {
      console.log('⚠️  No messages found in this thread yet\n');
    }
  } else {
    console.log('⚠️  No threads found\n');
  }

  console.log('\n✅ Verification complete!');
  console.log('\n💡 Try sending a message in the app to test persistence.');
}

verifyFix().catch(console.error);
