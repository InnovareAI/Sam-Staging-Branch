require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listWorkspaces() {
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name, company_name, created_at')
    .order('created_at', { ascending: false });

  console.log(`\n📋 All Workspaces (${workspaces?.length || 0}):\n`);

  workspaces?.forEach((w, i) => {
    console.log(`${i + 1}. ${w.name}`);
    console.log(`   Company: ${w.company_name || 'N/A'}`);
    console.log(`   ID: ${w.id}`);
    console.log(`   Created: ${new Date(w.created_at).toLocaleDateString()}\n`);
  });
}

listWorkspaces().catch(console.error);
