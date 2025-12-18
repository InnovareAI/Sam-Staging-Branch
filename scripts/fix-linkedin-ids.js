import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://latxadqrvrrrcvkktrog.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixLinkedInIds() {
  console.log('🔍 Finding prospects with URL-formatted linkedin_user_id...');

  // First, check how many have this issue
  const { data: prospects, error: fetchError } = await supabase
    .from('campaign_prospects')
    .select('id, linkedin_user_id, first_name, last_name')
    .ilike('linkedin_user_id', '%linkedin.com%');

  if (fetchError) {
    console.error('❌ Error fetching prospects:', fetchError);
    return;
  }

  const prospectCount = prospects ? prospects.length : 0;
  console.log(`📊 Found ${prospectCount} prospects with URL-formatted linkedin_user_id`);

  if (!prospects || prospects.length === 0) {
    console.log('✅ No prospects need fixing!');
  } else {
    // Show sample
    console.log('\n📝 Sample prospects to fix:');
    prospects.slice(0, 5).forEach(p => {
      console.log(`   ${p.first_name} ${p.last_name}: ${p.linkedin_user_id}`);
    });

    // Fix them one by one
    let fixed = 0;
    let failed = 0;

    for (const prospect of prospects) {
      const match = prospect.linkedin_user_id.match(/linkedin\.com\/in\/([^\/\?#]+)/i);
      if (match) {
        const slug = match[1];
        const { error: updateError } = await supabase
          .from('campaign_prospects')
          .update({ linkedin_user_id: slug })
          .eq('id', prospect.id);

        if (updateError) {
          console.error(`❌ Failed to update ${prospect.first_name} ${prospect.last_name}:`, updateError.message);
          failed++;
        } else {
          console.log(`   ✅ Fixed ${prospect.first_name} ${prospect.last_name}: ${prospect.linkedin_user_id} → ${slug}`);
          fixed++;
        }
      }
    }

    console.log('\n📊 Cleanup Results:');
    console.log(`   ✅ Fixed: ${fixed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📝 Total: ${prospects.length}`);
  }

  // Also check send_queue
  console.log('\n🔍 Checking send_queue for URL-formatted linkedin_user_id...');
  const { data: queueItems, error: queueError } = await supabase
    .from('send_queue')
    .select('id, linkedin_user_id')
    .ilike('linkedin_user_id', '%linkedin.com%');

  if (queueError) {
    console.error('❌ Error fetching queue items:', queueError);
    return;
  }

  const queueCount = queueItems ? queueItems.length : 0;
  console.log(`📊 Found ${queueCount} queue items with URL-formatted linkedin_user_id`);

  if (queueItems && queueItems.length > 0) {
    let queueFixed = 0;
    let queueFailed = 0;

    for (const item of queueItems) {
      const match = item.linkedin_user_id.match(/linkedin\.com\/in\/([^\/\?#]+)/i);
      if (match) {
        const slug = match[1];
        const { error: updateError } = await supabase
          .from('send_queue')
          .update({ linkedin_user_id: slug })
          .eq('id', item.id);

        if (updateError) {
          console.error(`❌ Failed to update queue item ${item.id}:`, updateError.message);
          queueFailed++;
        } else {
          console.log(`   ✅ Fixed queue item: ${item.linkedin_user_id} → ${slug}`);
          queueFixed++;
        }
      }
    }

    console.log('\n📊 Queue Cleanup Results:');
    console.log(`   ✅ Fixed: ${queueFixed}`);
    console.log(`   ❌ Failed: ${queueFailed}`);
    console.log(`   📝 Total: ${queueItems.length}`);
  } else {
    console.log('✅ No queue items need fixing!');
  }
}

fixLinkedInIds().catch(console.error);
