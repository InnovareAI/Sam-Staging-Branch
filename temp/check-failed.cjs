require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data: failed } = await supabase
    .from('send_queue')
    .select('id, linkedin_user_id, error_message')
    .eq('status', 'failed')
    .limit(200);

  const vanities = (failed || []).filter(f => {
    const id = f.linkedin_user_id;
    return id && !id.startsWith('ACo') && !id.startsWith('ACw');
  });

  const providerIds = (failed || []).filter(f => {
    const id = f.linkedin_user_id;
    return id && (id.startsWith('ACo') || id.startsWith('ACw'));
  });

  console.log('Total failed:', failed?.length || 0);
  console.log('Vanities:', vanities.length);
  console.log('Provider IDs:', providerIds.length);

  console.log('\nVanity slugs that cannot be resolved:');
  for (const item of vanities.slice(0, 20)) {
    console.log('  - ' + item.linkedin_user_id);
  }

  console.log('\nProvider IDs failing for other reasons:');
  for (const item of providerIds.slice(0, 10)) {
    console.log('  - ' + item.linkedin_user_id);
    console.log('    Error: ' + (item.error_message?.substring(0, 80) || 'none'));
  }
})();
