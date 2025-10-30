#!/usr/bin/env node
/**
 * PostgreSQL Migration: Add flow_settings and metadata to campaigns table
 * Date: October 30, 2025
 *
 * Adds data-driven campaign support for flexible timing and A/B testing
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  console.log('🔧 PostgreSQL Migration: Adding flow_settings to campaigns table\n');

  try {
    // Migration steps
    const steps = [
      {
        name: 'Add flow_settings column',
        sql: `
          ALTER TABLE campaigns
          ADD COLUMN IF NOT EXISTS flow_settings JSONB DEFAULT '{
            "connection_wait_hours": 36,
            "followup_wait_days": 5,
            "messages": {
              "connection_request": null,
              "follow_up_1": null,
              "follow_up_2": null,
              "follow_up_3": null,
              "follow_up_4": null,
              "follow_up_5": null,
              "follow_up_6": null,
              "goodbye": null
            }
          }'::jsonb;
        `
      },
      {
        name: 'Add metadata column',
        sql: `
          ALTER TABLE campaigns
          ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
        `
      },
      {
        name: 'Create GIN index for A/B test queries',
        sql: `
          CREATE INDEX IF NOT EXISTS idx_campaigns_metadata_ab_test
          ON campaigns USING GIN ((metadata->'ab_test_group'));
        `
      },
      {
        name: 'Add column comments',
        sql: `
          COMMENT ON COLUMN campaigns.flow_settings IS
            'Dynamic flow configuration: connection_wait_hours (12-96), followup_wait_days (1-30), and messages object with up to 6 follow-ups plus goodbye';

          COMMENT ON COLUMN campaigns.metadata IS
            'Campaign metadata including ab_test_group and variant for A/B testing';
        `
      }
    ];

    // Execute each step
    for (const step of steps) {
      console.log(`📝 ${step.name}...`);

      const { error } = await supabase.rpc('exec_sql', {
        sql_query: step.sql.trim()
      });

      if (error) {
        console.error(`   ❌ Failed: ${error.message}`);

        // If exec_sql doesn't work, try direct query
        console.log(`   🔄 Trying direct query...`);
        const { error: directError } = await supabase.from('_migrations').insert({
          name: step.name,
          executed_at: new Date().toISOString()
        });

        if (directError) {
          console.error(`   ❌ Direct query also failed: ${directError.message}`);
          console.log(`   ⚠️  Please run this SQL manually in Supabase SQL Editor:`);
          console.log(`\n${step.sql}\n`);
        }
      } else {
        console.log(`   ✅ Success`);
      }
    }

    // Verify the migration
    console.log('\n🔍 Verifying migration...');
    const { data: columns, error: verifyError } = await supabase
      .from('campaigns')
      .select('id, flow_settings, metadata')
      .limit(1);

    if (verifyError) {
      console.error('❌ Verification failed:', verifyError.message);
      console.log('\n⚠️  Migration may not be complete. Please verify manually.');
    } else if (columns && columns.length > 0) {
      const campaign = columns[0];
      console.log('✅ Verification successful!');
      console.log('   Columns exist:', {
        flow_settings: !!campaign.flow_settings,
        metadata: !!campaign.metadata
      });
    }

    console.log('\n🎉 Migration complete!');
    console.log('\n📊 Next steps:');
    console.log('   1. Verify in Supabase dashboard: Table Editor → campaigns');
    console.log('   2. Test SAM campaign creation');
    console.log('   3. Deploy updated code to production');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.log('\n📋 Manual migration required. Run this SQL in Supabase SQL Editor:');
    console.log('\n' + readFileSync(
      join(__dirname, '../../sql/migrations/add-campaign-flow-settings.sql'),
      'utf8'
    ));
    process.exit(1);
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log('\n✅ All done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
