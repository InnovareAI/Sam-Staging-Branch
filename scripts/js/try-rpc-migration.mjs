
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function tryApplyViaRpc() {
    console.log('🧪 Testing for exec_sql RPC function...');

    const sql = fs.readFileSync('sql/migrations/065-create-linkedin-searches-table.sql', 'utf8');

    // Try common RPC names for running SQL
    const rpcNames = ['exec_sql', 'run_sql', 'execute_sql'];

    for (const name of rpcNames) {
        console.log(`Trying ${name}...`);
        const { data, error } = await supabase.rpc(name, { query: sql });
        if (!error) {
            console.log(`✅ Success with ${name}!`);
            return;
        } else {
            console.log(`❌ ${name} failed: ${error.message}`);
        }
    }

    console.log('❌ No SQL execution RPC found.');
}

tryApplyViaRpc();
