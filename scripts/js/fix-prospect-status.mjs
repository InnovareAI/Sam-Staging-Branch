#!/usr/bin/env node
/**
 * Fix campaign prospects with 'new' status to 'approved'
 * This fixes prospects added before the status bug was fixed
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixProspectStatus() {
  console.log('🔧 Fixing prospect statuses...\n');

  // Update prospects with 'new' status to 'approved'
  const { data: updateData, error: updateError } = await supabase
    .from('campaign_prospects')
    .update({ status: 'approved' })
    .eq('status', 'new')
    .not('linkedin_url', 'is', null)
    .select();

  if (updateError) {
    console.error('❌ Error updating prospects:', updateError);
    process.exit(1);
  }

  console.log(`✅ Updated ${updateData?.length || 0} prospects from 'new' to 'approved'\n`);

  // Get status counts
  const { data: statusData, error: statusError } = await supabase
    .from('campaign_prospects')
    .select('status, linkedin_url');

  if (statusError) {
    console.error('❌ Error fetching status counts:', statusError);
    process.exit(1);
  }

  const statusCounts = statusData.reduce((acc, row) => {
    const status = row.status || 'null';
    const hasLinkedIn = row.linkedin_url ? 'with_linkedin' : 'without_linkedin';

    if (!acc[status]) {
      acc[status] = { total: 0, with_linkedin: 0, without_linkedin: 0 };
    }
    acc[status].total++;
    acc[status][hasLinkedIn]++;
    return acc;
  }, {});

  console.log('📊 Current status breakdown:');
  console.log('─'.repeat(60));
  Object.entries(statusCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([status, counts]) => {
      console.log(`   ${status.padEnd(25)} ${counts.total.toString().padStart(5)} total (${counts.with_linkedin.toString().padStart(4)} with LinkedIn URL)`);
    });
  console.log('─'.repeat(60));
  console.log(`   ${'TOTAL'.padEnd(25)} ${statusData.length.toString().padStart(5)} prospects\n`);
}

fixProspectStatus();
