const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data, error } = await supabase
    .from('campaign_prospects')
    .select('first_name, last_name, status, linkedin_user_id, notes, contacted_at')
    .ilike('first_name', 'noah')
    .ilike('last_name', 'ottmar')
    .single();

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  if (data) {
    console.log('✅ Noah Ottmar Status:');
    console.log('  Status:', data.status);
    console.log('  LinkedIn User ID:', data.linkedin_user_id || 'NOT SET');
    console.log('  Contacted At:', data.contacted_at || 'not yet');
    console.log('  Notes:', data.notes || 'none');
  }
})();
