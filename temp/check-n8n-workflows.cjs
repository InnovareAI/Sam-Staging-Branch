require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkN8NWorkflows() {
  console.log('🔍 Checking N8N Workflow Configuration\n');

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('name, n8n_workflow_id, campaign_type, status')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('📊 Active Campaigns and their N8N Workflows:\n');

  campaigns.forEach((c, index) => {
    console.log(`${index + 1}. ${c.name}`);
    console.log(`   Type: ${c.campaign_type || 'NOT SET'}`);
    console.log(`   N8N Workflow: ${c.n8n_workflow_id || 'NOT SET ❌'}`);
    console.log('');
  });

  // Check integrations table for N8N configuration
  const { data: integrations } = await supabase
    .from('integrations')
    .select('workspace_id, n8n_config')
    .not('n8n_config', 'is', null)
    .limit(5);

  console.log('\n🔧 N8N Integration Configuration:\n');

  integrations.forEach((int, index) => {
    console.log(`${index + 1}. Workspace: ${int.workspace_id}`);
    if (int.n8n_config) {
      console.log(`   Config: ${JSON.stringify(int.n8n_config, null, 2)}`);
    }
    console.log('');
  });
}

checkN8NWorkflows().catch(console.error);
