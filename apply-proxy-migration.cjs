#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('🔧 Applying LinkedIn proxy RLS migration...');
  
  const migrationSQL = `
-- Fix LinkedIn proxy assignments RLS policy to work with Supabase auth
-- This ensures users can see their LinkedIn proxy assignments

-- Drop old policies that reference clerk_id or users table
DROP POLICY IF EXISTS "Users can access own linkedin proxy assignments" ON linkedin_proxy_assignments;
DROP POLICY IF EXISTS "linkedin_proxy_assignments_user_access" ON linkedin_proxy_assignments;

-- Create new policy using direct Supabase auth
CREATE POLICY "linkedin_proxy_assignments_user_access" ON linkedin_proxy_assignments
    FOR ALL USING (user_id = auth.uid());

-- Also add service role policy for API access
DROP POLICY IF EXISTS "service_role_access_linkedin_proxy_assignments" ON linkedin_proxy_assignments;
CREATE POLICY "service_role_access_linkedin_proxy_assignments" ON linkedin_proxy_assignments
    FOR ALL USING (auth.role() = 'service_role');

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON linkedin_proxy_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON linkedin_proxy_assignments TO service_role;
  `;

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL }).catch(() => {
      // If exec_sql doesn't exist, try direct query
      return supabase.from('_supabase_migrations').select('*').limit(1);
    });

    // Try alternative approach - use the REST API directly
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ query: migrationSQL })
    }).catch(() => null);

    if (!response || !response.ok) {
      // Last resort - use Supabase SQL Editor API
      console.log('⚠️  Standard RPC failed, attempting direct SQL execution...');
      console.log('📝 Please run this SQL manually in Supabase SQL Editor:\n');
      console.log(migrationSQL);
      console.log('\n💡 Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql/new');
      return false;
    }

    console.log('✅ Migration applied successfully!');
    return true;
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    console.log('\n📝 Please run this SQL manually in Supabase SQL Editor:\n');
    console.log(migrationSQL);
    console.log('\n💡 Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql/new');
    return false;
  }
}

applyMigration().then(success => {
  process.exit(success ? 0 : 1);
});
