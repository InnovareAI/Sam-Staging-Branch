import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'SET' : 'MISSING');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('\n🔗 Testing Supabase Connection...\n');
  console.log('URL:', supabaseUrl);

  // Test 1: List tables by querying workspaces
  console.log('\n📋 Fetching workspaces...');
  const { data: workspaces, error: workspacesError } = await supabase
    .from('workspaces')
    .select('id, name, created_at')
    .limit(5);

  if (workspacesError) {
    console.error('❌ Error fetching workspaces:', workspacesError.message);
  } else {
    console.log('✅ Workspaces:', workspaces);
  }

  // Test 2: List campaigns
  console.log('\n📋 Fetching campaigns...');
  const { data: campaigns, error: campaignsError } = await supabase
    .from('campaigns')
    .select('id, name, status, created_at')
    .limit(5);

  if (campaignsError) {
    console.error('❌ Error fetching campaigns:', campaignsError.message);
  } else {
    console.log('✅ Campaigns:', campaigns);
  }

  // Test 3: Count prospects
  console.log('\n📋 Counting prospects...');
  const { count, error: countError } = await supabase
    .from('campaign_prospects')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Error counting prospects:', countError.message);
  } else {
    console.log('✅ Total prospects:', count);
  }

  // Test 4: Show send_queue status
  console.log('\n📋 Send queue status...');
  const { data: queueStats, error: queueError } = await supabase
    .from('send_queue')
    .select('status')
    .limit(100);

  if (queueError) {
    console.error('❌ Error fetching queue:', queueError.message);
  } else {
    const stats = queueStats?.reduce((acc: Record<string, number>, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});
    console.log('✅ Queue stats:', stats);
  }

  console.log('\n✅ Supabase connection test complete!\n');
}

main().catch(console.error);
