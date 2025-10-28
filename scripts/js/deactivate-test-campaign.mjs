import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔧 Deactivating test campaign...\n');

const { data: campaign, error: fetchError } = await supabase
  .from('campaigns')
  .select('*')
  .eq('name', '20251028-IAI-test 10')
  .single();

if (fetchError || !campaign) {
  console.log('❌ Campaign not found');
  process.exit(1);
}

console.log('Found campaign:', campaign.name);
console.log('Current status:', campaign.status);
console.log('Has message:', campaign.connection_message ? 'YES' : 'NO');

if (campaign.status === 'active' && !campaign.connection_message) {
  console.log('\n⚠️  Campaign is active but has no message template');
  console.log('⚠️  Deactivating to prevent errors...\n');

  const { error: updateError } = await supabase
    .from('campaigns')
    .update({ status: 'scheduled' })
    .eq('id', campaign.id);

  if (updateError) {
    console.log('❌ Error:', updateError.message);
  } else {
    console.log('✅ Campaign deactivated (status: scheduled)');
  }
} else {
  console.log('\n✅ Campaign is OK or already inactive');
}
