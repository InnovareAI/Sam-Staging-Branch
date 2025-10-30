#!/usr/bin/env node
/**
 * Campaign Tracking Migration Runner
 * Applies database enhancements for LinkedIn campaign execution via N8N
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  console.log('🚀 Campaign Tracking Migration\n');
  console.log('='.repeat(60));

  try {
    // Read the SQL migration file
    const sqlPath = join(__dirname, '../../sql/migrations/20251030_campaign_tracking_enhancements.sql');
    const sql = readFileSync(sqlPath, 'utf8');

    console.log('\n📄 Migration File: 20251030_campaign_tracking_enhancements.sql');
    console.log('   Location:', sqlPath);
    console.log('   Size:', sql.length, 'bytes\n');

    // Execute the migration
    console.log('⏳ Executing migration...\n');

    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // If exec_sql function doesn't exist, try direct SQL execution
      if (error.message.includes('function') || error.message.includes('does not exist')) {
        console.log('⚠️  exec_sql function not available');
        console.log('📋 Please run this SQL manually in Supabase SQL Editor:\n');
        console.log('   1. Go to: https://supabase.com/dashboard/project/[your-project]/sql');
        console.log('   2. Copy the SQL from: sql/migrations/20251030_campaign_tracking_enhancements.sql');
        console.log('   3. Paste and execute in the SQL editor\n');
        console.log('   Or use the Supabase CLI:');
        console.log('   supabase db push\n');

        // Show the SQL content
        console.log('='.repeat(60));
        console.log('SQL TO EXECUTE:');
        console.log('='.repeat(60));
        console.log(sql);
        console.log('='.repeat(60));

        process.exit(1);
      }

      throw error;
    }

    console.log('✅ Migration executed successfully!\n');

    // Show summary
    console.log('='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log('\n✅ What was created/updated:\n');
    console.log('   1. Verified campaign_prospects columns:');
    console.log('      - contacted_at (TIMESTAMPTZ)');
    console.log('      - status (TEXT with check constraint)');
    console.log('      - personalization_data (JSONB)');
    console.log('\n   2. Indexes for performance:');
    console.log('      - idx_campaign_prospects_status');
    console.log('      - idx_campaign_prospects_contacted_at');
    console.log('      - idx_campaign_prospects_campaign_status');
    console.log('      - idx_campaign_prospects_ready_to_contact');
    console.log('\n   3. Database functions:');
    console.log('      - update_prospect_contacted(prospect_id, unipile_message_id)');
    console.log('      - get_prospects_ready_for_messaging(campaign_id, limit)');
    console.log('\n✅ Ready for N8N integration!\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

runMigration();
