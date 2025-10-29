#!/usr/bin/env node
/**
 * Add prospect ownership tracking for LinkedIn TOS compliance
 * CRITICAL: Users can ONLY message prospects they personally added
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addOwnershipTracking() {
  console.log('🚨 ADDING PROSPECT OWNERSHIP TRACKING\n');
  console.log('Purpose: LinkedIn TOS compliance - prevent account sharing\n');

  try {
    // Note: Column additions must be done via Supabase SQL Editor
    // because Supabase client doesn't support DDL operations

    console.log('⚠️  This script will backfill ownership data.');
    console.log('⚠️  You must first add columns via Supabase SQL Editor:\n');
    console.log('   ALTER TABLE workspace_prospects ADD COLUMN added_by UUID REFERENCES auth.users(id);');
    console.log('   ALTER TABLE campaign_prospects ADD COLUMN added_by UUID REFERENCES auth.users(id);\n');

    // Check if columns exist by trying to query them
    console.log('🔍 Checking if columns exist...\n');

    let columnsExist = false;
    try {
      await supabase.from('workspace_prospects').select('added_by').limit(1);
      await supabase.from('campaign_prospects').select('added_by').limit(1);
      columnsExist = true;
      console.log('✅ Columns already exist!\n');
    } catch (err) {
      console.log('❌ Columns do not exist yet.');
      console.log('   Please run the SQL commands above in Supabase SQL Editor first.\n');
      process.exit(1);
    }

    if (!columnsExist) return;

    // Backfill workspace_prospects
    console.log('📝 Backfilling workspace_prospects...');

    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id, created_by');

    let wpUpdated = 0;
    for (const campaign of campaigns || []) {
      const { data: prospects } = await supabase
        .from('campaign_prospects')
        .select('id, prospect_id')
        .eq('campaign_id', campaign.id)
        .not('prospect_id', 'is', null);

      for (const cp of prospects || []) {
        if (cp.prospect_id) {
          const { error } = await supabase
            .from('workspace_prospects')
            .update({ added_by: campaign.created_by })
            .eq('id', cp.prospect_id)
            .is('added_by', null);

          if (!error) wpUpdated++;
        }
      }
    }

    console.log(`   ✅ Updated ${wpUpdated} workspace prospects\n`);

    // Backfill campaign_prospects
    console.log('📝 Backfilling campaign_prospects...');

    let cpUpdated = 0;
    for (const campaign of campaigns || []) {
      const { error } = await supabase
        .from('campaign_prospects')
        .update({ added_by: campaign.created_by })
        .eq('campaign_id', campaign.id)
        .is('added_by', null);

      if (!error) {
        const { count } = await supabase
          .from('campaign_prospects')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', campaign.id)
          .eq('added_by', campaign.created_by);

        cpUpdated += count || 0;
      }
    }

    console.log(`   ✅ Updated ${cpUpdated} campaign prospects\n`);

    // Verify
    console.log('📊 Final verification:\n');

    const { count: wpTotal } = await supabase
      .from('workspace_prospects')
      .select('*', { count: 'exact', head: true });

    const { count: wpWithOwner } = await supabase
      .from('workspace_prospects')
      .select('*', { count: 'exact', head: true })
      .not('added_by', 'is', null);

    const { count: cpTotal } = await supabase
      .from('campaign_prospects')
      .select('*', { count: 'exact', head: true });

    const { count: cpWithOwner } = await supabase
      .from('campaign_prospects')
      .select('*', { count: 'exact', head: true })
      .not('added_by', 'is', null);

    console.log(`   workspace_prospects: ${wpWithOwner}/${wpTotal} have owner`);
    console.log(`   campaign_prospects: ${cpWithOwner}/${cpTotal} have owner`);

    console.log('\n✅ Ownership tracking migration complete!');
    console.log('\n⚠️  Next steps:');
    console.log('   1. Update execute-live API to verify ownership');
    console.log('   2. Update prospect creation to set added_by');
    console.log('   3. Test with a campaign to ensure compliance');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

addOwnershipTracking().catch(console.error);
