require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verify() {
  const userId = 'f6885ff3-deef-4781-8721-93011c990b1b';
  
  const { data: memberships, error } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('user_id', userId);
    
  console.log('\n✅ VERIFIED: tl@innovareai.com workspace memberships:');
  console.log(JSON.stringify(memberships, null, 2));
  console.log('\nError:', error);
}

verify().catch(console.error);
