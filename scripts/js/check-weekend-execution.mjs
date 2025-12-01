import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkWeekendExecution() {
  console.log('📊 CHECKING WEEKEND FUNCTION EXECUTION');
  console.log('=====================================\n');

  const weekendStart = '2025-11-29T00:00:00';
  const weekendEnd = '2025-12-01T23:59:59';

  // 1. Check send_queue for any activity
  console.log('1️⃣ SEND QUEUE ACTIVITY (Nov 29-Dec 1):');
  const { data: queueActivity, error: queueError } = await supabase
    .from('send_queue')
    .select('id, status, message_type, scheduled_for, created_at, updated_at')
    .or(`updated_at.gte.${weekendStart},created_at.gte.${weekendStart}`)
    .order('updated_at', { ascending: false })
    .limit(20);

  if (queueError) {
    console.log('   Error:', queueError.message);
  } else {
    const count = queueActivity ? queueActivity.length : 0;
    console.log(`   Found ${count} queue entries`);
    if (count > 0) {
      queueActivity.slice(0, 5).forEach(q => {
        console.log(`   - ${q.message_type}: ${q.status} (updated: ${q.updated_at})`);
      });
    }
  }

  // 2. Check system_health_checks table
  console.log('\n2️⃣ SYSTEM HEALTH CHECKS:');
  const { data: healthChecks, error: healthError } = await supabase
    .from('system_health_checks')
    .select('*')
    .gte('check_date', weekendStart)
    .order('check_date', { ascending: false })
    .limit(5);

  if (healthError) {
    console.log('   Table may not exist or error:', healthError.message);
  } else {
    const hcCount = healthChecks ? healthChecks.length : 0;
    console.log(`   Found ${hcCount} health checks`);
    if (healthChecks) {
      healthChecks.forEach(h => {
        console.log(`   - ${h.check_date}: ${h.overall_status}`);
      });
    }
  }

  // 3. Check campaign_prospects for recent updates
  console.log('\n3️⃣ CAMPAIGN PROSPECT UPDATES (indicates cron activity):');
  const { data: recentUpdates, count: prospectCount } = await supabase
    .from('campaign_prospects')
    .select('id, status, updated_at', { count: 'exact' })
    .gte('updated_at', weekendStart)
    .lte('updated_at', weekendEnd)
    .limit(5);

  console.log(`   Found ${prospectCount || 0} prospect updates during weekend`);

  // 4. Check for any messages sent
  console.log('\n4️⃣ MESSAGES SENT OVER WEEKEND:');
  const { data: sentMessages, count: sentCount } = await supabase
    .from('send_queue')
    .select('id, message_type, status, updated_at', { count: 'exact' })
    .eq('status', 'sent')
    .gte('updated_at', weekendStart)
    .lte('updated_at', weekendEnd);

  console.log(`   ${sentCount || 0} messages marked as sent`);

  // 5. Check for any failed messages (would indicate cron tried to run)
  console.log('\n5️⃣ FAILED/CANCELLED MESSAGES:');
  const { data: failedMessages, count: failedCount } = await supabase
    .from('send_queue')
    .select('id, message_type, status, error_message, updated_at', { count: 'exact' })
    .in('status', ['failed', 'cancelled'])
    .gte('updated_at', weekendStart)
    .lte('updated_at', weekendEnd);

  console.log(`   ${failedCount || 0} failed/cancelled messages`);
  if (failedMessages && failedMessages.length > 0) {
    failedMessages.slice(0, 3).forEach(f => {
      const errMsg = f.error_message ? f.error_message.substring(0, 50) : 'No error message';
      console.log(`   - ${f.message_type}: ${errMsg}...`);
    });
  }

  // 6. Check QA monitor results
  console.log('\n6️⃣ QA MONITOR CHECKS:');
  const { data: qaChecks, error: qaError } = await supabase
    .from('qa_monitor_results')
    .select('*')
    .gte('created_at', weekendStart)
    .order('created_at', { ascending: false })
    .limit(5);

  if (qaError) {
    console.log('   Table may not exist or error:', qaError.message);
  } else {
    const qaCount = qaChecks ? qaChecks.length : 0;
    console.log(`   Found ${qaCount} QA monitor results`);
  }

  // 7. Summary
  console.log('\n📋 SUMMARY:');
  const hasActivity = (prospectCount || 0) > 0 || (sentCount || 0) > 0 || (failedCount || 0) > 0;
  if (hasActivity) {
    console.log('   ✅ Evidence of scheduled function execution found');
  } else {
    console.log('   ⚠️ No messages processed over weekend');
    console.log('   Note: This is expected behavior - SAM does not send messages on weekends');
    console.log('   The cron functions run but skip weekend days (see scheduling-config.ts)');
  }
}

checkWeekendExecution().catch(console.error);
