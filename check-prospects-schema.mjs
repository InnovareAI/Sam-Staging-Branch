import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
    const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'campaign_prospects' });

    if (error) {
        // If RPC doesn't exist, try getting one row
        const { data: row, error: rError } = await supabase.from('campaign_prospects').select('*').limit(1);
        if (rError) {
            console.error('Error fetching row:', rError);
            return;
        }
        console.log('Columns in campaign_prospects:', Object.keys(row[0] || {}));
    } else {
        console.log('Columns from RPC:', data);
    }
}

checkSchema();
