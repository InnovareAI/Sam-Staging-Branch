const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkFailedProspect() {
  const { data: prospects, error } = await supabase
    .from('campaign_prospects')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\nRecent prospects:');
  prospects.forEach((p, idx) => {
    console.log('\nProspect ' + (idx + 1) + ': ' + p.first_name + ' ' + p.last_name);
    console.log('   LinkedIn URL: ' + p.linkedin_url);
    console.log('   Status: ' + p.status);
    console.log('   Campaign ID: ' + p.campaign_id);
    console.log('   Updated: ' + p.updated_at);
    if (p.personalization_data && p.personalization_data.error) {
      console.log('   ERROR: ' + p.personalization_data.error);
    }
  });
}

checkFailedProspect();
