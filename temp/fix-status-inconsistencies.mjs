#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

console.log('🔧 FIXING STATUS INCONSISTENCIES\n');

async function findAndFixInconsistencies() {
  console.log('Step 1: Finding queue items marked as "sent" with mismatched prospect status...\n');

  // Get sent queue items with prospect details
  const { data: sentQueue } = await supabase
    .from('send_queue')
    .select(`
      id,
      prospect_id,
      status,
      sent_at,
      created_at
    `)
    .eq('status', 'sent')
    .not('prospect_id', 'is', null)
    .order('sent_at', { ascending: false })
    .limit(500);

  if (!sentQueue || sentQueue.length === 0) {
    console.log('No sent queue items found');
    return;
  }

  console.log(`Checking ${sentQueue.length} sent queue items...\n`);

  const inconsistencies = [];

  for (const queueItem of sentQueue) {
    // Get the prospect
    const { data: prospect } = await supabase
      .from('campaign_prospects')
      .select('id, first_name, last_name, linkedin_status, connection_status')
      .eq('id', queueItem.prospect_id)
      .single();

    if (prospect) {
      // Check if prospect status is NOT aligned with queue status
      const isInconsistent =
        prospect.linkedin_status !== 'sent' &&
        prospect.linkedin_status !== 'connection_sent' &&
        prospect.connection_status !== 'pending';

      if (isInconsistent) {
        inconsistencies.push({
          queueId: queueItem.id,
          prospectId: prospect.id,
          prospectName: `${prospect.first_name} ${prospect.last_name}`,
          currentLinkedinStatus: prospect.linkedin_status,
          currentConnectionStatus: prospect.connection_status,
          sentAt: queueItem.sent_at
        });
      }
    }
  }

  console.log(`Found ${inconsistencies.length} inconsistencies:\n`);

  if (inconsistencies.length === 0) {
    console.log('✅ No inconsistencies found!\n');
    return;
  }

  // Display inconsistencies
  inconsistencies.forEach((inc, idx) => {
    console.log(`${idx + 1}. ${inc.prospectName} (Prospect ID: ${inc.prospectId})`);
    console.log(`   Queue ID: ${inc.queueId}`);
    console.log(`   Current linkedin_status: ${inc.currentLinkedinStatus}`);
    console.log(`   Current connection_status: ${inc.currentConnectionStatus || 'null'}`);
    console.log(`   Sent at: ${inc.sentAt}`);
    console.log('');
  });

  // Fix inconsistencies
  console.log('\nStep 2: Fixing inconsistencies...\n');

  let fixed = 0;
  let errors = 0;

  for (const inc of inconsistencies) {
    try {
      const { error } = await supabase
        .from('campaign_prospects')
        .update({
          linkedin_status: 'connection_sent',
          connection_status: 'pending'
        })
        .eq('id', inc.prospectId);

      if (error) {
        console.log(`❌ Failed to update ${inc.prospectName}: ${error.message}`);
        errors++;
      } else {
        console.log(`✅ Fixed ${inc.prospectName} (Prospect ID: ${inc.prospectId})`);
        console.log(`   Updated: linkedin_status → 'connection_sent', connection_status → 'pending'`);
        fixed++;
      }
    } catch (err) {
      console.log(`❌ Error updating ${inc.prospectName}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`\n✅ Fixed: ${fixed}`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`📊 Total inconsistencies: ${inconsistencies.length}\n`);
}

async function main() {
  try {
    await findAndFixInconsistencies();
    console.log('✅ Complete!\n');
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
