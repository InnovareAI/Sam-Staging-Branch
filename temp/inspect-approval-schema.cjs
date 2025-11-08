const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspect() {
  const { data } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('workspace_id', '014509ba-226e-43ee-ba58-ab5f20d2ed08')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  console.log('Schema of prospect_approval_data:\n');
  console.log(JSON.stringify(data, null, 2));
}

inspect().catch(console.error);
