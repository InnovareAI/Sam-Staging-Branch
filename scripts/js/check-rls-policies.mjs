#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRLS() {
  console.log('\n🔒 CHECKING RLS POLICIES ON CAMPAIGNS TABLE\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Query the pg_policies table to see RLS policies
  const { data: policies, error } = await supabase
    .rpc('exec_sql', {
      sql: `
        SELECT 
          schemaname,
          tablename,
          policyname,
          permissive,
          roles,
          cmd,
          qual,
          with_check
        FROM pg_policies 
        WHERE tablename = 'campaigns'
        ORDER BY policyname;
      `
    });

  if (error) {
    // Try alternative method
    console.log('Using service role to check policies...\n');
    
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id, name, workspace_id')
      .eq('workspace_id', '96c03b38-a2f4-40de-9e16-43098599e1d4')
      .limit(5);

    console.log(`✅ Service role can see ${campaigns?.length || 0} campaigns\n`);
    
    if (campaigns && campaigns.length > 0) {
      campaigns.forEach((c, i) => {
        console.log(`${i + 1}. ${c.name}`);
      });
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('💡 DIAGNOSIS:');
  console.log('   If service role sees campaigns but user does not,');
  console.log('   then RLS policies are blocking user access.');
  console.log('\n   Most likely causes:');
  console.log('   1. User not in workspace_members table');
  console.log('   2. RLS policy checking wrong user_id column');
  console.log('   3. Policy recursion causing infinite loop');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

checkRLS();
