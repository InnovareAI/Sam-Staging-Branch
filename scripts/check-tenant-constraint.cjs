#!/usr/bin/env node

require('dotenv').config({ path: '.env.local', override: true });
const { createClient } = require('@supabase/supabase-js');

async function checkConstraint() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Query the constraint
  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT
        con.conname AS constraint_name,
        pg_get_constraintdef(con.oid) AS constraint_definition
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'workspaces'
        AND con.conname LIKE '%tenant%';
    `
  });

  if (error) {
    console.log('⚠️ Cannot query constraint directly\n');
    console.log('The tenant field has a CHECK constraint that only allows specific values.');
    console.log('Let me try updating to "3cubed" instead of "3cubed.ai"...\n');
  } else {
    console.log('Constraint definition:', data);
  }
}

checkConstraint().then(() => process.exit(0));
