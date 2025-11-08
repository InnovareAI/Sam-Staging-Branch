const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function activateCampaign() {
  const campaignId = '0a56408b-be39-4144-870f-2b0dce45b620';

  console.log('Activating campaign...\n');

  const { error } = await supabase
    .from('campaigns')
    .update({
      status: 'active',
      updated_at: new Date().toISOString()
    })
    .eq('id', campaignId);

  if (error) {
    console.log(`❌ Error: ${error.message}`);
  } else {
    console.log('✅ Campaign status updated to "active"');
    console.log('   Campaign: 20251106-BLL-CISO Outreach - Mid Market');
    console.log('   ID: 0a56408b-be39-4144-870f-2b0dce45b620');
    console.log('\n✅ Campaign should now appear in the UI\n');
  }
}

activateCampaign().catch(console.error);
