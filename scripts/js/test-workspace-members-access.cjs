const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

(async () => {
  console.log('Testing workspace_members access...\n');

  try {
    const { data, error } = await supabase
      .from('workspace_members')
      .select('id, workspace_id, user_id')
      .limit(1);

    if (error) {
      console.log('❌ Error accessing workspace_members:');
      console.log('   ', error.message);
      console.log('\n🔧 This is an RLS policy issue that needs manual fix in Supabase dashboard.');
    } else {
      console.log('✅ workspace_members accessible');
      console.log('   Records found:', data?.length || 0);
    }
  } catch (err) {
    console.log('❌ Exception:', err.message);
  }
})();
