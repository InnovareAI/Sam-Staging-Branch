require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function listTables() {
    const { data, error } = await supabase
        .from('pg_catalog.pg_tables')
        .select('tablename')
        .eq('schemaname', 'public');

    if (error) {
        console.error('Error fetching tables:', error);
        return;
    }

    console.log('--- Public Tables ---');
    console.log(data.map(t => t.tablename).join('\n'));
}

listTables();
