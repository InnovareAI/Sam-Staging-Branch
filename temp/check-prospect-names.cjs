const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProspectNames() {
  console.log('🔍 Checking prospect names...\n');

  // Get recent campaign prospects
  const { data: prospects, error } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, linkedin_url')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log('Recent prospects:\n');

  prospects.forEach((p, index) => {
    console.log(`${index + 1}. First Name: "${p.first_name}"`);
    console.log(`   Last Name: "${p.last_name}"`);
    console.log(`   LinkedIn: ${p.linkedin_url}`);
    console.log('');

    // Check if first_name contains special characters or emojis
    const hasEmojis = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA70}-\u{1FAFF}]/u.test(p.first_name);
    const hasSpecialChars = /[^\w\s'-]/.test(p.first_name);

    if (hasEmojis) {
      console.log('   ⚠️  Contains emojis!');
    }
    if (hasSpecialChars) {
      console.log('   ⚠️  Contains special characters!');
    }
  });
}

checkProspectNames().catch(console.error);
