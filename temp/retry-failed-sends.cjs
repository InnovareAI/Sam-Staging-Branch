require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function extractLinkedInSlug(urlOrSlug) {
  if (!urlOrSlug) return null;
  if (!urlOrSlug.includes('/') && !urlOrSlug.includes('http')) return urlOrSlug;
  const match = urlOrSlug.match(/linkedin\.com\/in\/([^\/\?#]+)/i);
  return match ? match[1] : urlOrSlug;
}

(async () => {
  console.log('🔍 Finding failed sends with invalid user ID errors...\n');

  const fifteenMinAgo = new Date(Date.now() - 60 * 60 * 1000); // Last hour

  // Get failed sends with the specific error
  const { data: failedItems, error } = await supabase
    .from('send_queue')
    .select('id, prospect_id, linkedin_user_id, campaign_id')
    .eq('status', 'failed')
    .like('error_message', '%User ID does not match provider%')
    .gte('updated_at', fifteenMinAgo.toISOString());

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${failedItems?.length || 0} failed sends\n`);

  let updated = 0;
  let skipped = 0;

  for (const item of failedItems || []) {
    // Get the prospect's current linkedin_user_id
    const { data: prospect } = await supabase
      .from('campaign_prospects')
      .select('linkedin_user_id, linkedin_url')
      .eq('id', item.prospect_id)
      .single();

    if (!prospect) {
      console.log(`⚠️  Queue ${item.id}: Prospect not found`);
      skipped++;
      continue;
    }

    const correctUserId = prospect.linkedin_user_id || extractLinkedInSlug(prospect.linkedin_url);

    if (!correctUserId) {
      console.log(`⚠️  Queue ${item.id}: No valid linkedin_user_id found`);
      skipped++;
      continue;
    }

    // Update queue item with correct user ID and retry
    const { error: updateError } = await supabase
      .from('send_queue')
      .update({
        linkedin_user_id: correctUserId,
        status: 'pending',
        error_message: null
      })
      .eq('id', item.id);

    if (!updateError) {
      updated++;
      console.log(`✅ Retrying queue ${item.id.slice(0, 8)}: ${correctUserId}`);
    } else {
      console.error(`❌ Failed to update ${item.id}:`, updateError);
    }
  }

  console.log(`\n✅ Retried: ${updated}`);
  console.log(`⚠️  Skipped: ${skipped}`);
})();
