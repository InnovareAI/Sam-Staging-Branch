require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

supabase.from('campaign_messages').insert({
  test: 'schema_check'
}).then(r => {
  console.log('Error shows required fields:', r.error?.message);
}).catch(e => console.log(e.message));
