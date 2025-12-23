
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function listRpcs() {
    console.log('🔍 Listing available functions...');

    // We can try to query pg_proc via a view if it exists, 
    // but usually we can't do that via PostgREST.
    // Instead, let's try to query 'workspace_members' with a weird RPC to see if it lets us.

    const { data, error } = await supabase.from('workspace_members').select('*').limit(1);
    console.log('User data check:', !!data);

    // Try to find any existing RPCs by checking the schema cache indirectly
    // Actually, let's just create a list of potential migration helpers we've seen in other projects
    const potentials = ['exec_sql', 'run_sql', 'execute_sql', 'apply_migration', 'migrate'];

    for (const p of potentials) {
        const { error: e } = await supabase.rpc(p, { sql: 'SELECT 1' });
        if (e && e.message.includes('Could not find')) {
            console.log(`❌ ${p} - Not found`);
        } else if (e) {
            console.log(`? ${p} - Found but error: ${e.message}`);
        } else {
            console.log(`✅ ${p} - FOUND!`);
        }
    }
}

listRpcs();
