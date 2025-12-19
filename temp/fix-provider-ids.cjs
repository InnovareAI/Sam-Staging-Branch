require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Extract LinkedIn ID from URL
function extractLinkedInId(url) {
  if (!url) return null;

  // Pattern 1: /in/username/ (vanity URL)
  const vanityMatch = url.match(/linkedin\.com\/in\/([^\/\?]+)/);
  if (vanityMatch) return vanityMatch[1];

  // Pattern 2: Sales Navigator or numeric profile ID
  const idMatch = url.match(/linkedin\.com\/.*[^\d](\d{8,})/);
  if (idMatch) return idMatch[1];

  return null;
}

(async () => {
  console.log('🔍 Finding prospects without provider_id...\n');

  // Get all prospects with linkedin_url but no linkedin_user_id
  const { data: prospects, error } = await supabase
    .from('campaign_prospects')
    .select('id, linkedin_url, linkedin_user_id, first_name, last_name')
    .not('linkedin_url', 'is', null)
    .is('linkedin_user_id', null)
    .limit(500);

  if (error) {
    console.error('Error fetching prospects:', error);
    return;
  }

  console.log(`Found ${prospects?.length || 0} prospects without linkedin_user_id\n`);

  let updated = 0;
  let skipped = 0;

  for (const p of prospects || []) {
    const userId = extractLinkedInId(p.linkedin_url);
    if (userId) {
      const { error: updateError } = await supabase
        .from('campaign_prospects')
        .update({ linkedin_user_id: userId })
        .eq('id', p.id);

      if (!updateError) {
        updated++;
        console.log(`✅ ${p.first_name} ${p.last_name}: ${userId}`);
      } else {
        console.error(`❌ Failed to update ${p.first_name} ${p.last_name}:`, updateError);
      }
    } else {
      skipped++;
      console.log(`⚠️  ${p.first_name} ${p.last_name}: Could not extract ID from ${p.linkedin_url}`);
    }
  }

  console.log(`\n✅ Updated: ${updated}`);
  console.log(`⚠️  Skipped: ${skipped}`);
})();
