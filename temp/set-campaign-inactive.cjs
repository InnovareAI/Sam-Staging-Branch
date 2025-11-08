const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setInactive() {
  const campaignId = '0a56408b-be39-4144-870f-2b0dce45b620';

  const { error } = await supabase
    .from('campaigns')
    .update({ status: 'inactive' })
    .eq('id', campaignId);

  if (error) {
    console.log(`❌ Error: ${error.message}`);
  } else {
    console.log('✅ Campaign status changed to "inactive"');
    console.log('   It will now appear in the "Inactive" tab');
    console.log('\n👉 Refresh the UI and check the Inactive tab\n');
  }
}

setInactive().catch(console.error);
