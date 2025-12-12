const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function test() {
  const teamId = 'TH422C4R2';
  
  const { data: config, error: configError } = await supabase
    .from('slack_app_config')
    .select('workspace_id')
    .eq('slack_team_id', teamId)
    .eq('status', 'active')
    .single();
  
  console.log('Config:', JSON.stringify(config), 'Error:', configError?.message);
  
  if (config) {
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('id', config.workspace_id)
      .single();
    
    console.log('Workspace:', JSON.stringify(workspace), 'Error:', wsError?.message);
  }
}

test().catch(console.error);
