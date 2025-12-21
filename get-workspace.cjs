
const { createClient } = require('@supabase/supabase-js');

// Read env file
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const url = urlMatch ? urlMatch[1] : '';
const key = keyMatch ? keyMatch[1] : '';

async function main() {
    if (!url || !key) {
        console.error('Missing Supabase URL or Key in .env.local');
        return;
    }

    const supabase = createClient(url, key);

    // Sign in
    const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
        email: 'tl@innovareai.com',
        password: '*tvoHcv6pkoR7PgFVEVq!'
    });

    if (authError) {
        console.error('Auth failed:', authError.message);
        return;
    }

    const { data, error } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', auth.user.id)
        .limit(1);

    if (error) console.error(error);
    else console.log(JSON.stringify(data, null, 2));
}

main();
