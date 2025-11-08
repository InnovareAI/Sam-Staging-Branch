const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findBLLProspects() {
  console.log('Looking for Blue Label Labs prospects...\n');

  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('*')
    .ilike('name', '%blue%');

  if (!workspaces || workspaces.length === 0) {
    console.log('No Blue Label Labs workspace found');
    return;
  }

  const workspace = workspaces[0];
  console.log(`Workspace: ${workspace.name}`);
  console.log(`ID: ${workspace.id}\n`);

  const { data: approvalData } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false });

  console.log(`Total approval records: ${approvalData ? approvalData.length : 0}\n`);

  if (approvalData && approvalData.length > 0) {
    for (const record of approvalData) {
      if (record.data) {
        const data = typeof record.data === 'string' ? JSON.parse(record.data) : record.data;

        if (data.prospects && Array.isArray(data.prospects)) {
          const pending = data.prospects.filter(p => p.status !== 'approved');

          if (pending.length >= 20 && pending.length <= 30) {
            console.log('Found record with 25 prospects:\n');
            console.log(`ID: ${record.id}`);
            console.log(`Created: ${new Date(record.created_at).toLocaleString()}`);
            console.log(`Pending: ${pending.length}\n`);

            console.log('Prospects:\n');
            pending.forEach((p, i) => {
              const contact = p.contact || {};
              console.log(`${i + 1}. ${contact.firstName || ''} ${contact.lastName || ''}`);
              console.log(`   Company: ${contact.company || ''}`);
              console.log(`   LinkedIn: ${contact.linkedin_url || ''}`);
              console.log('');
            });
            return;
          }
        }
      }
    }

    console.log('All approval records:\n');
    approvalData.forEach((record, i) => {
      if (!record.data) return;
      const data = typeof record.data === 'string' ? JSON.parse(record.data) : record.data;
      if (!data) return;
      const count = data.prospects ? data.prospects.length : 0;
      const pending = data.prospects ? data.prospects.filter(p => p.status !== 'approved').length : 0;
      if (count > 0) {
        console.log(`${i + 1}. ${record.id} - Total: ${count}, Pending: ${pending}, Created: ${new Date(record.created_at).toLocaleDateString()}`);
      }
    });
  }
}

findBLLProspects().catch(console.error);
