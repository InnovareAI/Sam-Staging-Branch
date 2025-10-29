#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixWorkspaceProspects() {
  console.log('🔧 Fixing workspace_prospects ownership...\n');

  // Get all campaign_prospects with added_by set
  const { data: cpWithOwners } = await supabase
    .from('campaign_prospects')
    .select('prospect_id, added_by')
    .not('added_by', 'is', null)
    .not('prospect_id', 'is', null);

  console.log(`Found ${cpWithOwners?.length || 0} campaign_prospects with owners\n`);

  if (!cpWithOwners || cpWithOwners.length === 0) {
    console.log('⚠️ No campaign_prospects have prospect_id set.');
    console.log('This means workspace_prospects are separate from campaign_prospects.\n');
    console.log('Setting added_by based on workspace_id instead...\n');

    // Get all campaigns and update their prospects
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id, workspace_id, created_by');

    let updated = 0;
    for (const campaign of campaigns || []) {
      // Get prospects from this workspace
      const { data: wpIds } = await supabase
        .from('workspace_prospects')
        .select('id')
        .eq('workspace_id', campaign.workspace_id)
        .is('added_by', null);

      if (wpIds && wpIds.length > 0) {
        const { error } = await supabase
          .from('workspace_prospects')
          .update({ added_by: campaign.created_by })
          .eq('workspace_id', campaign.workspace_id)
          .is('added_by', null);

        if (!error) {
          updated += wpIds.length;
        }
      }
    }

    console.log(`✅ Updated ${updated} workspace_prospects\n`);

  } else {
    // Update workspace_prospects from campaign_prospects
    console.log('Updating workspace_prospects from campaign_prospects...\n');

    let updated = 0;
    for (const cp of cpWithOwners) {
      if (cp.prospect_id) {
        const { error } = await supabase
          .from('workspace_prospects')
          .update({ added_by: cp.added_by })
          .eq('id', cp.prospect_id)
          .is('added_by', null);

        if (!error) updated++;
      }
    }

    console.log(`✅ Updated ${updated} workspace_prospects\n`);
  }

  // Final verification
  const { count: total } = await supabase
    .from('workspace_prospects')
    .select('*', { count: 'exact', head: true });

  const { count: withOwner } = await supabase
    .from('workspace_prospects')
    .select('*', { count: 'exact', head: true })
    .not('added_by', 'is', null);

  console.log(`📊 Final: ${withOwner}/${total} workspace_prospects have owners\n`);

  if (withOwner < total) {
    console.log('⚠️ Some prospects still have no owner.');
    console.log('These may be orphaned prospects not linked to any campaign.\n');
  }
}

fixWorkspaceProspects().catch(console.error);
