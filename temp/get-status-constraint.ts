import { createClient } from '@supabase/supabase-js';

async function getConstraint() {
  console.log('\n🔍 Querying status check constraint...\n');

  // Query pg_constraint to get the check constraint definition
  const { data, error } = await supabase
    .rpc('get_constraint_definition', {
      table_name: 'prospect_approval_sessions',
      constraint_name: 'prospect_approval_sessions_status_check'
    });

  if (error) {
    console.error('RPC not available, trying direct query...');

    // Try a simpler approach - just insert test rows with different status values
    const statusValues = ['pending', 'in_progress', 'active', 'completed', 'cancelled', 'failed'];

    for (const status of statusValues) {
      const testId = crypto.randomUUID();
      const { error: insertError } = await supabase
        .from('prospect_approval_sessions')
        .insert({
          id: testId,
          batch_number: 999,
          user_id: 'f6885ff3-deef-4781-8721-93011c990b1b',
          workspace_id: 'babdcab8-1a78-4b2f-913e-6e9fd9821009',
          prospect_source: 'test',
          total_prospects: 0,
          pending_count: 0,
          approved_count: 0,
          rejected_count: 0,
          status: status,
          icp_criteria: {},
          learning_insights: {},
          created_at: new Date().toISOString()
        });

      if (insertError) {
        console.log(`❌ '${status}': ${insertError.message}`);
      } else {
        console.log(`✅ '${status}': VALID`);
        // Clean up
        await supabase
          .from('prospect_approval_sessions')
          .delete()
          .eq('id', testId);
      }
    }
  } else {
    console.log('Constraint definition:', data);
  }
}

getConstraint();
