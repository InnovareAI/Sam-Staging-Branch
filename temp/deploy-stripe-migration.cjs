const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function deployStripeMigration() {
  console.log('🚀 Deploying Stripe Integration Migration\n');

  // Read the migration SQL
  const migrationSQL = fs.readFileSync(
    'supabase/migrations/20251006000000_add_tenant_and_stripe_tables.sql',
    'utf8'
  );

  console.log('📄 Migration file loaded');
  console.log(`   Size: ${migrationSQL.length} characters\n`);

  try {
    // Execute the migration using the REST API
    console.log('⚙️  Executing migration...');

    // Split into individual statements and execute
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let executed = 0;
    let failed = 0;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i] + ';';

      // Skip comments-only statements
      if (stmt.trim().startsWith('COMMENT')) {
        console.log(`   ℹ️  Skipping: ${stmt.substring(0, 60)}...`);
        continue;
      }

      try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: stmt });

        if (error) {
          console.log(`   ⚠️  ${error.message}`);
          failed++;
        } else {
          console.log(`   ✅ Statement ${i + 1} executed`);
          executed++;
        }
      } catch (err) {
        console.log(`   ⚠️  ${err.message}`);
        failed++;
      }
    }

    console.log(`\n📊 Migration Summary:`);
    console.log(`   Executed: ${executed}`);
    console.log(`   Failed/Skipped: ${failed}`);

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }

  // Verify the tables were created
  console.log('\n🔍 Verifying tables...');

  const tables = ['workspace_stripe_customers', 'workspace_subscriptions'];

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);

    if (error) {
      console.log(`   ❌ ${table}: ${error.message}`);
    } else {
      console.log(`   ✅ ${table}: Table exists`);
    }
  }

  console.log('\n✅ Stripe migration deployment complete!');
}

deployStripeMigration().catch(console.error);
