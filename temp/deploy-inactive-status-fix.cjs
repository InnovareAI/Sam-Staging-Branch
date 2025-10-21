const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing environment variables!');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

const migrationPath = path.join(__dirname, '../supabase/migrations/20251021000000_add_inactive_status.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

console.log('🚀 Deploying migration to add "inactive" status...');
console.log(`📄 SQL length: ${sql.length} chars`);
console.log('');

async function runMigration() {
  try {
    // Execute the migration SQL directly
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: sql
    });

    if (error) {
      // If exec_sql doesn't exist, try direct query
      console.log('⚠️  exec_sql RPC not available, trying direct execution...');

      // Split into statements and execute one by one
      const statements = sql.split(';').filter(s => s.trim());

      for (const statement of statements) {
        if (statement.trim()) {
          const { error: stmtError } = await supabase.rpc('exec', {
            sql: statement.trim() + ';'
          });

          if (stmtError) {
            console.error('❌ Error executing statement:', stmtError);
            throw stmtError;
          }
        }
      }

      console.log('✅ Migration executed successfully via direct execution!');
    } else {
      console.log('✅ Migration executed successfully!');
      console.log('Result:', data);
    }

    console.log('');
    console.log('🎉 Database now accepts "inactive" status for campaigns!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Test changing campaign status in the UI');
    console.log('2. Verify no errors when saving campaigns');

  } catch (err) {
    console.error('❌ Migration failed:', err);
    console.error('');
    console.error('Manual fix required:');
    console.error('1. Go to Supabase Dashboard > SQL Editor');
    console.error('2. Paste and run this SQL:');
    console.error('');
    console.error(sql);
    process.exit(1);
  }
}

runMigration();
