import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifySchema() {
    console.log('🔍 Verifying schema...');

    // Try to select the new column
    const { data, error } = await supabase
        .from('campaigns')
        .select('id, schedule_settings')
        .limit(1);

    if (error) {
        console.error('❌ Error selecting schedule_settings:', error.message);
        process.exit(1);
    }

    console.log('✅ Column `schedule_settings` exists and is accessible!');
    if (data && data.length > 0) {
        console.log('Sample data:', data[0]);
    } else {
        console.log('Table is empty or no rows returned, but query succeeded.');
    }
}

verifySchema().catch(console.error);
