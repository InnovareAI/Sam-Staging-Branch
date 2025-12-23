
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://latxadqrvrrrcvkktrog.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log('🔍 Checking linkedin_searches table schema...');
    const { data, error } = await supabase
        .from('linkedin_searches')
        .select('*')
        .limit(1);

    if (error) {
        if (error.code === '42703') { // Undefined column
            console.log('❌ One or more expected columns are MISSING.');
        } else {
            console.error('❌ Error querying table:', error.message);
        }
    } else {
        const firstRow = data[0] || {};
        const columns = Object.keys(firstRow);
        console.log('✅ Current columns in linkedin_searches:', columns.join(', '));

        const hasWorkspaceId = columns.includes('workspace_id');
        const hasAccountId = columns.includes('unipile_account_id');

        console.log(`📊 Isolation Check: workspace_id=${hasWorkspaceId}, unipile_account_id=${hasAccountId}`);
    }

    // Also check if the function exists
    console.log('🔍 Checking for check_linkedin_search_quota function...');
    const { data: funcData, error: funcError } = await supabase.rpc('check_linkedin_search_quota', { p_account_id: 'test' });
    if (funcError) {
        console.log('❌ Quota function MISSING or errored:', funcError.message);
    } else {
        console.log('✅ Quota function EXISTS.');
    }
}

checkSchema();
