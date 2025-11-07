require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAdd() {
  const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';
  const campaignId = '0a56408b-be39-4144-870f-2b0dce45b620';

  // Get one prospect to test
  const { data: cp } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', campaignId)
    .limit(1)
    .single();

  if (!cp) {
    console.log('No prospect found');
    return;
  }

  console.log('Test prospect:', cp.first_name, cp.last_name);

  // Try minimal insert
  const { data, error } = await supabase
    .from('prospect_approval_data')
    .insert({
      workspace_id: workspaceId,
      name: `${cp.first_name} ${cp.last_name}`,
      title: cp.title || '',
      company: cp.company || '',
      contact: {
        linkedin_url: cp.linkedin_url,
        email: cp.email,
        first_name: cp.first_name,
        last_name: cp.last_name
      },
      approval_status: 'pending'
    })
    .select();

  if (error) {
    console.log('❌ Error:', error.message);
    console.log('   Details:', error.details);
    console.log('   Hint:', error.hint);
  } else {
    console.log('✅ Success!', data);

    // Clean up
    await supabase
      .from('prospect_approval_data')
      .delete()
      .eq('id', data[0].id);
    console.log('✅ Cleaned up test record');
  }
}

testAdd().catch(console.error);
