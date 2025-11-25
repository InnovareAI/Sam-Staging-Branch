#!/usr/bin/env ts-node
/**
 * Backfill Missing linkedin_user_id for Campaign Prospects
 *
 * Issue: 138 campaign prospects have NULL linkedin_user_id (Unipile provider_id)
 * Root Cause: LinkedIn profile URLs exist but provider_id wasn't fetched during upload
 * Fix: Extract vanity from URL and call Unipile API to get provider_id
 *
 * Usage:
 *   npm run backfill-linkedin-ids        # Dry run (no changes)
 *   npm run backfill-linkedin-ids --execute  # Execute updates
 *
 * CRITICAL: Uses Unipile legacy endpoint to avoid profile?identifier= bug
 * See: CLAUDE.md section on Nov 22 Unipile bug fix
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const UNIPILE_DSN = process.env.UNIPILE_DSN || 'api6.unipile.com:13670';
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!UNIPILE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables');
  console.error('Required: UNIPILE_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface Prospect {
  id: string;
  campaign_id: string;
  first_name: string;
  last_name: string;
  linkedin_url: string;
  linkedin_user_id: string | null;
  added_by_unipile_account: string | null;
}

interface UnipileProfile {
  id: string; // This is the provider_id we need
  name: string;
  profile_pic_url: string;
}

/**
 * Extract LinkedIn vanity name from URL
 * Examples:
 *   http://www.linkedin.com/in/bennett-fahey → bennett-fahey
 *   https://linkedin.com/in/sarah-robertson-123 → sarah-robertson-123
 */
function extractVanityFromUrl(url: string): string | null {
  const match = url.match(/linkedin\.com\/in\/([^\/\?#]+)/);
  return match ? match[1] : null;
}

/**
 * Fetch Unipile profile using legacy endpoint (NOT profile?identifier=)
 *
 * CRITICAL: Do NOT use /api/v1/users/profile?identifier={vanity}
 * That endpoint has a bug where vanities with numbers return wrong profiles
 * Example: noah-ottmar-b59478295 returned Jamshaid Ali's profile
 *
 * Use legacy endpoint instead: /api/v1/users/{vanity}?account_id={account_id}
 */
async function fetchUnipileProfile(
  vanity: string,
  accountId: string
): Promise<UnipileProfile | null> {
  try {
    // Use legacy endpoint - correctly resolves all vanities including those with numbers
    const url = `https://${UNIPILE_DSN}/api/v1/users/${vanity}?account_id=${accountId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'X-API-KEY': UNIPILE_API_KEY!,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`❌ Unipile API error for ${vanity}: ${response.status} ${text}`);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`❌ Error fetching profile for ${vanity}:`, error);
    return null;
  }
}

/**
 * Get default Unipile account for workspace
 * Prefers LinkedIn accounts, falls back to any connected account
 */
async function getWorkspaceUnipileAccount(workspaceId: string): Promise<string | null> {
  const { data: accounts, error } = await supabase
    .from('user_unipile_accounts')
    .select('unipile_account_id, platform, connection_status')
    .eq('workspace_id', workspaceId)
    .eq('connection_status', 'active')
    .order('platform', { ascending: true }); // LinkedIn comes before MAIL alphabetically

  if (error || !accounts || accounts.length === 0) {
    console.error(`❌ No active Unipile account found for workspace ${workspaceId}`);
    return null;
  }

  // Prefer LinkedIn accounts
  const linkedinAccount = accounts.find(a => a.platform === 'LINKEDIN');
  if (linkedinAccount) {
    return linkedinAccount.unipile_account_id;
  }

  // Fallback to first active account
  return accounts[0].unipile_account_id;
}

async function main() {
  const isDryRun = !process.argv.includes('--execute');

  console.log('🔍 Backfill Missing linkedin_user_id Script');
  console.log('==========================================');
  console.log(`Mode: ${isDryRun ? '🔒 DRY RUN (no changes)' : '✅ EXECUTE (will update database)'}`);
  console.log('');

  // Fetch all prospects with NULL linkedin_user_id
  console.log('📊 Fetching prospects with NULL linkedin_user_id...');
  const { data: prospects, error } = await supabase
    .from('campaign_prospects')
    .select('id, campaign_id, first_name, last_name, linkedin_url, linkedin_user_id, added_by_unipile_account')
    .is('linkedin_user_id', null)
    .not('linkedin_url', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching prospects:', error);
    process.exit(1);
  }

  if (!prospects || prospects.length === 0) {
    console.log('✅ No prospects found with NULL linkedin_user_id. Database is clean!');
    process.exit(0);
  }

  console.log(`Found ${prospects.length} prospects to process`);
  console.log('');

  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  // Process in batches to avoid rate limits
  const batchSize = 5;
  const delayBetweenBatches = 2000; // 2 seconds

  for (let i = 0; i < prospects.length; i += batchSize) {
    const batch = prospects.slice(i, i + batchSize);

    console.log(`\nProcessing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(prospects.length / batchSize)}...`);

    for (const prospect of batch) {
      const vanity = extractVanityFromUrl(prospect.linkedin_url);

      if (!vanity) {
        console.log(`⚠️  Skipped: ${prospect.first_name} ${prospect.last_name} - Invalid LinkedIn URL format`);
        skippedCount++;
        continue;
      }

      // Get Unipile account for this prospect's campaign
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('workspace_id')
        .eq('id', prospect.campaign_id)
        .single();

      if (!campaign) {
        console.log(`⚠️  Skipped: ${prospect.first_name} ${prospect.last_name} - Campaign not found`);
        skippedCount++;
        continue;
      }

      const accountId = await getWorkspaceUnipileAccount(campaign.workspace_id);
      if (!accountId) {
        console.log(`⚠️  Skipped: ${prospect.first_name} ${prospect.last_name} - No Unipile account for workspace`);
        skippedCount++;
        continue;
      }

      // Fetch profile from Unipile
      console.log(`   Fetching: ${prospect.first_name} ${prospect.last_name} (${vanity})...`);
      const profile = await fetchUnipileProfile(vanity, accountId);

      if (!profile || !profile.id) {
        console.log(`   ❌ Failed: Could not fetch profile from Unipile`);
        failedCount++;
        continue;
      }

      console.log(`   ✅ Found: provider_id = ${profile.id}`);

      // Update database
      if (!isDryRun) {
        const { error: updateError } = await supabase
          .from('campaign_prospects')
          .update({
            linkedin_user_id: profile.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', prospect.id);

        if (updateError) {
          console.log(`   ❌ Database update failed:`, updateError);
          failedCount++;
          continue;
        }

        console.log(`   ✅ Updated database`);
      } else {
        console.log(`   🔒 DRY RUN: Would update linkedin_user_id to ${profile.id}`);
      }

      successCount++;
    }

    // Delay between batches to respect rate limits
    if (i + batchSize < prospects.length) {
      console.log(`   ⏱️  Waiting ${delayBetweenBatches / 1000}s before next batch...`);
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }

  console.log('');
  console.log('==========================================');
  console.log('📊 Summary');
  console.log('==========================================');
  console.log(`✅ Successfully processed: ${successCount}`);
  console.log(`❌ Failed: ${failedCount}`);
  console.log(`⚠️  Skipped: ${skippedCount}`);
  console.log(`📊 Total: ${prospects.length}`);
  console.log('');

  if (isDryRun) {
    console.log('🔒 DRY RUN MODE - No changes were made');
    console.log('Run with --execute flag to apply updates');
  } else {
    console.log('✅ EXECUTION COMPLETE - Database updated');
  }
}

main().catch(console.error);
