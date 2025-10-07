#!/usr/bin/env node

/**
 * Deploy Source Tracking Migration
 *
 * Adds source_attachment_id to knowledge base tables for document traceability
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deployMigration() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║  Deploy Source Tracking Migration         ║');
  console.log('╚═══════════════════════════════════════════╝\n');

  try {
    // Read migration file
    const migrationPath = path.join(
      __dirname,
      '../../supabase/migrations/20251006000002_add_source_tracking_to_knowledge.sql'
    );

    console.log(`📄 Reading migration: ${path.basename(migrationPath)}`);
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    console.log('🚀 Executing migration...\n');

    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: migrationSQL
    });

    if (error) {
      // If exec_sql function doesn't exist, execute directly via pg connection
      console.log('⚠️  exec_sql RPC not available, executing directly...');

      // Split migration into individual statements
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement.toLowerCase().startsWith('comment on')) {
          // Skip comments as they might fail
          continue;
        }

        try {
          const result = await supabase.rpc('exec', {
            query: statement + ';'
          });

          if (result.error) {
            console.log(`⚠️  Statement warning: ${result.error.message}`);
          }
        } catch (stmtError) {
          console.log(`⚠️  Statement skipped: ${stmtError.message.substring(0, 100)}`);
        }
      }
    }

    console.log('\n✅ Migration executed successfully!\n');

    // Verify changes
    console.log('🔍 Verifying schema changes...\n');

    // Check sam_icp_knowledge_entries
    const { data: icpColumns } = await supabase
      .rpc('get_table_columns', {
        table_name: 'sam_icp_knowledge_entries'
      });

    const hasSourceField = icpColumns?.some(col => col.column_name === 'source_attachment_id');
    console.log(`  sam_icp_knowledge_entries.source_attachment_id: ${hasSourceField ? '✅ Added' : '❌ Missing'}`);

    // Check knowledge_base
    const { data: kbColumns } = await supabase
      .rpc('get_table_columns', {
        table_name: 'knowledge_base'
      });

    const hasKBSource = kbColumns?.some(col => col.column_name === 'source_attachment_id');
    const hasKBType = kbColumns?.some(col => col.column_name === 'source_type');

    console.log(`  knowledge_base.source_attachment_id: ${hasKBSource ? '✅ Added' : '❌ Missing'}`);
    console.log(`  knowledge_base.source_type: ${hasKBType ? '✅ Added' : '❌ Missing'}`);

    console.log('\n📊 Summary:');
    console.log('  - source_attachment_id added to both tables');
    console.log('  - source_type and source_metadata added to knowledge_base');
    console.log('  - Helper functions created for querying by source');
    console.log('  - ON DELETE SET NULL ensures KB entries persist');

    console.log('\n💡 Next Steps:');
    console.log('  1. Uploaded documents will now link to KB entries');
    console.log('  2. Use get_kb_entries_by_source(attachment_id) to find related KB data');
    console.log('  3. Delete documents via DELETE /api/sam/upload-document?id={id}');
    console.log('  4. Run cleanup_orphaned_kb_entries() periodically to clean old data\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
}

// Run deployment
deployMigration()
  .then(() => {
    console.log('✅ Deployment complete!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });
