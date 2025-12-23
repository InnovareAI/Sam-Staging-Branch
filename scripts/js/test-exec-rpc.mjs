
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testExec() {
    console.log('🧪 Testing exec RPC...');
    const { data, error } = await supabase.rpc('exec', { sql: 'SELECT 1 as test' });

    if (error) {
        console.error('❌ exec RPC failed:', error.message);
    } else {
        console.log('✅ exec RPC is working!', data);
    }
}

testExec();
