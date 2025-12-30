import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const SUPABASE_URL = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const SERVICE_ROLE_KEY = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function listAllTables() {
    console.log('Listing all tables in public schema...');
    const { data, error } = await supabase.rpc('exec_sql', {
        sql: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;`
    });

    if (error) {
        console.error('RPC Error:', error);
        // Try fallback to standard information_schema query if exec_sql fails
        const { data: tables, error: tableError } = await supabase
            .from('workspaces') // dummy to get a connection
            .select('table_name')
            .neq('table_name', '');
        // This won't work easily with standard Supabase JS client for arbitrary tables
        return;
    }

    console.log(JSON.stringify(data, null, 2));
}

listAllTables();
