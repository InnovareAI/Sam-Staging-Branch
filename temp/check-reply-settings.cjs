require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('REPLY AGENT SETTINGS:');
  console.log('='.repeat(60) + '\n');

  // Check reply_agent_settings
  const { data: settings, error } = await supabase
    .from('reply_agent_settings')
    .select('*')
    .limit(2);

  if (error) {
    console.log('Error querying reply_agent_settings:', error.message);
    
    // Try workspace_reply_agent_config instead
    const { data: config, error: configError } = await supabase
      .from('workspace_reply_agent_config')
      .select('*')
      .limit(2);
    
    if (configError) {
      console.log('Error querying workspace_reply_agent_config:', configError.message);
    } else if (config && config[0]) {
      console.log('workspace_reply_agent_config columns:');
      console.log(Object.keys(config[0]).join(', '));
      console.log('\nSample config:');
      console.log(JSON.stringify(config[0], null, 2));
    }
  } else if (settings && settings[0]) {
    console.log('reply_agent_settings columns:');
    console.log(Object.keys(settings[0]).join(', '));
    console.log('\nSample settings:');
    console.log(JSON.stringify(settings[0], null, 2));
  }

  // Check workspace calendar_settings
  console.log('\n' + '='.repeat(60));
  console.log('WORKSPACE CALENDAR SETTINGS:');
  console.log('-'.repeat(40));

  const { data: workspaces, error: wsError } = await supabase
    .from('workspaces')
    .select('id, name, calendar_settings')
    .not('calendar_settings', 'is', null)
    .limit(3);

  if (wsError) {
    console.log('Error:', wsError.message);
  } else if (!workspaces || workspaces.length === 0) {
    console.log('No workspaces with calendar_settings configured');
  } else {
    for (const ws of workspaces) {
      console.log('Workspace:', ws.name);
      console.log('Calendar Settings:', JSON.stringify(ws.calendar_settings, null, 2));
    }
  }

})();
