
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    console.log('🔍 Verifying LinkedIn safety schema...');

    // Test table existence
    const { error: tableError } = await supabase.from('linkedin_searches').select('id').limit(0);

    if (tableError) {
        console.log('❌ Table linkedin_searches MISSING:', tableError.message);
    } else {
        console.log('✅ Table linkedin_searches EXISTS');
    }

    // Test function
    const { data, error: funcError } = await supabase.rpc('check_linkedin_search_quota', { p_account_id: 'test-nonexistent' });

    if (funcError) {
        console.log('❌ Quota function MISSING:', funcError.message);
    } else {
        console.log('✅ Quota function EXISTS. Response:', data);
    }
}

verify();
