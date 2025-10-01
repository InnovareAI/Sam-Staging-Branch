const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAndCreateTable() {
  try {
    console.log('🔍 Checking if linkedin_proxy_assignments table exists...\n');
    
    // Try to query the table
    const { data, error } = await supabase
      .from('linkedin_proxy_assignments')
      .select('id')
      .limit(1);
    
    if (error && error.message.includes('does not exist')) {
      console.log('❌ Table does not exist. Creating it now...\n');
      
      // Read the migration file
      const fs = require('fs');
      const path = require('path');
      const migrationPath = path.join(__dirname, 'supabase/migrations/20250918110000_linkedin_proxy_assignments.sql');
      
      if (!fs.existsSync(migrationPath)) {
        console.log('❌ Migration file not found at:', migrationPath);
        return;
      }
      
      const sql = fs.readFileSync(migrationPath, 'utf8');
      
      console.log('📝 Executing migration SQL...\n');
      
      // Execute the SQL
      const { error: execError } = await supabase.rpc('exec_sql', { sql });
      
      if (execError) {
        console.log('⚠️ Could not execute via RPC, trying direct approach...');
        console.log('Please run this SQL manually in Supabase SQL Editor:\n');
        console.log('='.repeat(80));
        console.log(sql);
        console.log('='.repeat(80));
      } else {
        console.log('✅ Table created successfully!');
      }
    } else if (error) {
      console.log('❌ Error checking table:', error.message);
    } else {
      console.log('✅ Table already exists!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAndCreateTable();
