
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
    console.log('🔍 Listing all tables in public schema...');

    // We can't query information_schema or pg_tables directly via the generic PostgREST client
    // unless we've created a view for it.
    // But we can try to guess common tables or use rpc if there's a helper.

    // Try common table names to see which ones return something vs 404
    const testTables = [
        'users',
        'workspaces',
        'workspace_members',
        'workspace_accounts',
        'prospects',
        'campaigns',
        'linkedin_searches',
        'linkedin_search_history',
        'searches'
    ];

    for (const table of testTables) {
        const { error } = await supabase.from(table).select('*').limit(0);
        if (!error) {
            console.log(`✅ Table exists: ${table}`);
        } else {
            console.log(`❌ Table missing or error: ${table} (${error.message})`);
        }
    }
}

listTables();
