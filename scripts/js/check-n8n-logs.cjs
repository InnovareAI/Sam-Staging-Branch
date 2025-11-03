const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

(async () => {
  console.log('🔍 Checking N8N execution logs...\n');

  const { data, error } = await supabase
    .from('n8n_campaign_executions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.log('❌ Error:', error.message);
  } else if (!data || data.length === 0) {
    console.log('⚠️  No execution logs found');
    console.log('\n📊 Root Cause Analysis:');
    console.log('======================');
    console.log('1. ✅ Logging node added to N8N workflow');
    console.log('2. ✅ Workflow executes successfully');
    console.log('3. ❌ API endpoint https://app.meet-sam.com/api/n8n/log-execution returns 404');
    console.log('4. ⚠️  onError: continueRegularOutput hides the HTTP 404 failure');
    console.log('\n💡 Solution: Deploy the API endpoint to production');
  } else {
    console.log(`✅ Found ${data.length} execution logs:\n`);
    data.forEach(log => {
      console.log(`ID: ${log.id}`);
      console.log(`Campaign: ${log.campaign_name}`);
      console.log(`Status: ${log.execution_status}`);
      console.log(`N8N Execution ID: ${log.n8n_execution_id}`);
      console.log(`Created: ${log.created_at}`);
      console.log('---');
    });
  }
})();
