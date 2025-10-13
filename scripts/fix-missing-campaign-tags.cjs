#!/usr/bin/env node

/**
 * Fix Missing Campaign Tags
 * Updates prospect_approval_sessions that have NULL campaign_tag
 * Sets campaign_tag = campaign_name (or generates one if missing)
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function fixMissingCampaignTags() {
  console.log('🔍 Finding sessions missing campaign_tag...\n');

  // Get sessions missing campaign_tag
  const { data: sessions, error: fetchError } = await supabase
    .from('prospect_approval_sessions')
    .select('id, campaign_name, campaign_tag, created_at')
    .is('campaign_tag', null);

  if (fetchError) {
    console.error('❌ Error fetching sessions:', fetchError.message);
    process.exit(1);
  }

  console.log(`Found ${sessions?.length || 0} sessions missing campaign_tag\n`);

  if (!sessions || sessions.length === 0) {
    console.log('✅ No sessions need updating!');
    return;
  }

  for (const session of sessions) {
    // Generate campaign name from creation date + session ID if missing
    let campaignName = session.campaign_name;

    if (!campaignName) {
      const date = new Date(session.created_at);
      const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
      campaignName = `${dateStr}-CLIENT-Session-${session.id.slice(0, 8)}`;
    }

    // Set campaign_tag = campaign_name
    const { error: updateError } = await supabase
      .from('prospect_approval_sessions')
      .update({
        campaign_name: campaignName,
        campaign_tag: campaignName
      })
      .eq('id', session.id);

    if (updateError) {
      console.error(`❌ Failed to update session ${session.id.slice(0, 8)}: ${updateError.message}`);
    } else {
      console.log(`✅ Updated session ${session.id.slice(0, 8)}`);
      console.log(`   Campaign: ${campaignName}\n`);
    }
  }

  console.log('✅ Migration complete!');
}

fixMissingCampaignTags().catch(console.error);
