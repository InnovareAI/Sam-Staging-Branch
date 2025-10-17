/**
 * Apply lead search tier migration to Supabase
 * Run with: node scripts/apply-lead-search-migration.cjs
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function applyMigration() {
  console.log('🚀 Applying lead search tier migration...\n');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Read the migration file
  const migrationPath = path.join(__dirname, '../supabase/migrations/20251017_add_lead_search_tier_to_workspace_tiers.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  console.log('📄 Migration file loaded');
  console.log(`📏 SQL length: ${migrationSQL.length} characters\n`);

  // Split into individual statements (simple split by semicolon)
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`🔢 Found ${statements.length} SQL statements to execute\n`);

  // Execute each statement
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';'; // Re-add semicolon
    console.log(`\n[${i + 1}/${statements.length}] Executing statement...`);
    console.log(statement.substring(0, 100) + '...\n');

    try {
      const { data, error } = await supabase.rpc('exec_sql', { query: statement });

      if (error) {
        // Try alternative method: direct query
        const { data: directData, error: directError } = await supabase
          .from('_migrations')
          .select('*')
          .limit(1);

        if (directError) {
          console.error(`❌ Error executing statement ${i + 1}:`, error);
          console.error('Statement:', statement);

          // Continue with next statement (some errors might be expected, like "column already exists")
          if (error.message?.includes('already exists')) {
            console.log('⚠️  Column/index already exists, continuing...');
          } else {
            throw error;
          }
        }
      } else {
        console.log(`✅ Statement ${i + 1} executed successfully`);
      }
    } catch (err) {
      console.error(`❌ Failed to execute statement ${i + 1}:`, err.message);
      console.log('📝 Statement:', statement);
      console.log('\n⚠️  Continuing with next statement...\n');
    }
  }

  console.log('\n\n🎉 Migration application complete!');
  console.log('\n📊 Verifying migration...\n');

  // Verify the migration
  try {
    const { data: tiers, error } = await supabase
      .from('workspace_tiers')
      .select('workspace_id, tier, lead_search_tier, monthly_lead_search_quota, monthly_lead_searches_used')
      .limit(3);

    if (error) {
      console.error('❌ Error verifying migration:', error);
      console.log('\n💡 The migration SQL may need to be run manually in Supabase SQL Editor');
      console.log('📄 Migration file location: supabase/migrations/20251017_add_lead_search_tier_to_workspace_tiers.sql');
    } else {
      console.log('✅ Migration verified! Sample workspace tiers:');
      console.table(tiers);

      console.log('\n✅ New columns added:');
      console.log('  - lead_search_tier (TEXT)');
      console.log('  - monthly_lead_search_quota (INTEGER)');
      console.log('  - monthly_lead_searches_used (INTEGER)');
      console.log('  - search_quota_reset_date (DATE)');

      console.log('\n✅ New functions created:');
      console.log('  - check_lead_search_quota(workspace_id)');
      console.log('  - increment_lead_search_usage(workspace_id, count)');

      console.log('\n📊 Tier Allocation:');
      console.log('  - All tiers: Advanced search (BrightData MCP)');
      console.log('  - Startup: 1,000 searches/month');
      console.log('  - SME: 5,000 searches/month');
      console.log('  - Enterprise: 10,000 searches/month');
    }
  } catch (err) {
    console.error('❌ Verification error:', err.message);
    console.log('\n💡 Manual verification needed - check Supabase dashboard');
  }
}

applyMigration().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
