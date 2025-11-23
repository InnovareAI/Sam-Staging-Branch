require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findJamilaCampaign() {
  const { data: prospect } = await supabase
    .from('campaign_prospects')
    .select('*, campaigns(id, campaign_name, message_templates)')
    .eq('first_name', 'Jamila')
    .eq('last_name', 'Hyre')
    .single();

  if (!prospect) {
    console.log('❌ Jamila not found');
    return;
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('JAMILA HYRE - FAILED MESSAGE ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('Found Jamila in campaign:', prospect.campaigns);
  console.log('\n📝 Message Template:');
  const template = prospect.campaigns.message_templates?.connection_request;
  console.log(`"${template}"`);
  console.log(`\nTemplate Length: ${template?.length} chars`);
  console.log(`   - Shows as ${template?.length} chars in UI ✅`);

  // Interpolate
  const interpolated = template
    .replace(/{first_name}/g, prospect.first_name)
    .replace(/{title}/g, prospect.title || '');

  console.log(`\n🧪 Interpolated Message:`);
  console.log(`"${interpolated}"`);
  console.log(`\n📏 Final Length: ${interpolated.length} chars`);

  if (interpolated.length > 300) {
    console.log(`❌ OVER LIMIT by: ${interpolated.length - 300} chars`);
  }

  console.log(`\n🔍 Why it failed:`);
  console.log(`   - Template uses {title} placeholder`);
  console.log(`   - Jamila's title: "${prospect.title}"`);
  console.log(`   - Title length: ${(prospect.title || '').length} chars`);
  console.log(`   - Template: ${template?.length} chars`);
  console.log(`   - Final message: ${interpolated.length} chars`);
  console.log(`\n💡 The UI showed ${template?.length} chars (safe), but actual message was ${interpolated.length} chars (too long)!`);
}

findJamilaCampaign().catch(console.error);
