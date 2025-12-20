require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const INNOVAREAI_WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

(async () => {
  console.log('Adding demo video and one-pager links to Reply Agent Settings...\n');

  // First check current columns
  const { data: current } = await supabase
    .from('reply_agent_settings')
    .select('*')
    .eq('workspace_id', INNOVAREAI_WORKSPACE_ID)
    .single();

  console.log('Current columns:', Object.keys(current || {}).join(', '));

  // Check if new columns exist
  if (!current) {
    console.log('No settings found for workspace');
    return;
  }

  // The columns might not exist in the database yet
  // Let me try updating with the new fields
  const { data, error } = await supabase
    .from('reply_agent_settings')
    .update({
      demo_video_link: 'https://links.innovareai.com/SAM_Demo',
      one_pager_link: 'https://innovareai.notion.site/SAM-One-Pager',
      free_trial_link: 'https://app.meet-sam.com/signup/innovareai',
      updated_at: new Date().toISOString()
    })
    .eq('workspace_id', INNOVAREAI_WORKSPACE_ID)
    .select();

  if (error) {
    console.log('Error updating (columns may not exist):', error.message);
    console.log('\nNeed to add columns to reply_agent_settings table');
    console.log('Required columns: demo_video_link, one_pager_link, free_trial_link');
  } else {
    console.log('Updated settings:', JSON.stringify(data, null, 2));
  }

})();
