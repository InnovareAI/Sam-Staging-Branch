// Fix workspace_members RLS policy
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixRLSPolicy() {
  console.log('🔧 Fixing workspace_members RLS policy...\n');

  // Create the policy to allow users to read their own memberships
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE POLICY IF NOT EXISTS "Users can read their own workspace memberships"
      ON workspace_members
      FOR SELECT
      USING (user_id = auth.uid());
    `
  });

  if (error) {
    console.error('❌ Failed to create policy via RPC. Trying direct approach...');

    // Try using the SQL directly (requires postgrest)
    const { error: directError } = await supabase
      .from('workspace_members')
      .select('*')
      .limit(0); // Just to test connection

    console.log('\n⚠️  You need to run this SQL manually in Supabase SQL Editor:');
    console.log('');
    console.log('```sql');
    console.log(`CREATE POLICY "Users can read their own workspace memberships"`);
    console.log(`ON workspace_members`);
    console.log(`FOR SELECT`);
    console.log(`USING (user_id = auth.uid());`);
    console.log('```');
    console.log('');
    console.log('Go to: https://supabase.com/dashboard → Your Project → SQL Editor');
    console.log('');
    return;
  }

  console.log('✅ RLS policy created successfully!');
  console.log('');
  console.log('Now users can read their own workspace memberships.');
  console.log('');
  console.log('Test it by refreshing the browser page.');
}

fixRLSPolicy().catch(console.error);
