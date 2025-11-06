require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkN8NIntegration() {
  const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
  
  console.log('\n🔍 CHECKING N8N INTEGRATION\n');
  
  // Get latest campaign
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(1);
    
  const campaign = campaigns[0];
  console.log('📋 Latest Campaign:', campaign.name);
  console.log('   ID:', campaign.id);
  console.log('   Type:', campaign.campaign_type);
  console.log('   Status:', campaign.status);
  console.log('   N8N Workflow ID:', campaign.n8n_workflow_id || 'NOT SET');
  console.log('   N8N Execution ID:', campaign.n8n_execution_id || 'NOT SET');
  console.log('');
  
  // Check prospects
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, status, contacted_at, personalization_data')
    .eq('campaign_id', campaign.id)
    .limit(5);
    
  console.log('📊 Prospects (' + prospects.length + ' shown):');
  prospects.forEach((p, i) => {
    console.log((i + 1) + '.', p.first_name, p.last_name);
    console.log('   Status:', p.status);
    console.log('   Contacted:', p.contacted_at || 'Not yet');
    console.log('   N8N data:', p.personalization_data?.n8n_execution_id || 'NOT SET');
    console.log('');
  });
  
  // Check for any n8n execution logs in the database
  console.log('🔍 Checking for n8n execution records...');
  const { data: executions, error } = await supabase
    .from('n8n_executions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (error) {
    console.log('⚠️  n8n_executions table might not exist:', error.message);
  } else if (executions && executions.length > 0) {
    console.log('Found', executions.length, 'recent n8n executions');
    executions.forEach(e => {
      console.log('  -', e.workflow_name || 'Unknown workflow');
      console.log('    ID:', e.execution_id);
      console.log('    Status:', e.status);
    });
  } else {
    console.log('No n8n execution records found');
  }
}

checkN8NIntegration().catch(console.error);
