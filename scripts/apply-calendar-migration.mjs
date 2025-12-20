import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const MIGRATION_FILE = 'supabase/migrations/20251220000000_crm_enhancements.sql';

async function runMigration() {
    console.log(`🔄 Applying migration: ${MIGRATION_FILE}...`);

    try {
        const sql = readFileSync(MIGRATION_FILE, 'utf-8');

        // Split SQL into logical parts if necessary, or run as one block
        // Note: exec_sql must be defined in your Supabase database
        const { data, error } = await supabase.rpc('exec_sql', { query: sql });

        if (error) {
            console.error('❌ Migration failed:', error);
            process.exit(1);
        }

        console.log('✅ Migration successful!');
    } catch (err) {
        console.error('❌ Error reading or running migration:', err);
        process.exit(1);
    }
}

runMigration();
