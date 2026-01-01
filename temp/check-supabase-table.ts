import { createClient } from '@supabase/supabase-js';

async function check() {
  console.log('🔍 Checking workspace_prospects table...\n');

  // 1. Check if table exists and get structure
  const { data: tableInfo, error: tableError } = await supabase
    .from('workspace_prospects')
    .select('*')
    .limit(1);

  if (tableError) {
    console.error('❌ Table query error:', tableError);
    return;
  }

  console.log('✅ Table exists and is accessible\n');

  // 2. Try a test insert with minimal data
  const testProspect = {
    workspace_id: 'babdcab8-1a78-4b2f-913e-6e9fd9821009',
    first_name: 'Test',
    last_name: 'Prospect',
    linkedin_profile_url: `https://www.linkedin.com/in/test-${Date.now()}`
  };

  console.log('🧪 Testing insert with minimal data:', testProspect);

  const { data: inserted, error: insertError } = await supabase
    .from('workspace_prospects')
    .insert(testProspect)
    .select();

  if (insertError) {
    console.error('\n❌ INSERT FAILED:', insertError);
    console.error('Error details:', JSON.stringify(insertError, null, 2));
  } else {
    console.log('\n✅ INSERT SUCCESSFUL!');
    console.log('Inserted prospect:', inserted);

    // Clean up test data
    if (inserted && inserted[0]) {
      await supabase
        .from('workspace_prospects')
        .delete()
        .eq('id', inserted[0].id);
      console.log('🧹 Cleaned up test prospect');
    }
  }

  // 3. Check for any existing prospects
  const { count } = await supabase
    .from('workspace_prospects')
    .select('*', { count: 'exact', head: true });

  console.log(`\n📊 Total prospects in table: ${count}`);
}

check();
