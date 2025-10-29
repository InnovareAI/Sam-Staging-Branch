#!/usr/bin/env node
/**
 * Fetch LinkedIn profile data via Unipile and update prospect names
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

async function main() {
  console.log('🔄 Updating prospect names from LinkedIn profiles\n');

  // Get prospects with missing names
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, linkedin_url, company_name, title')
    .or('first_name.is.null,first_name.eq.,last_name.is.null,last_name.eq.')
    .not('linkedin_url', 'is', null)
    .limit(50);

  if (!prospects || prospects.length === 0) {
    console.log('✅ All prospects have names!');
    return;
  }

  console.log(`📝 Found ${prospects.length} prospects with missing names\n`);

  // Get LinkedIn account for API calls
  const { data: accounts } = await supabase
    .from('workspace_accounts')
    .select('unipile_account_id')
    .eq('account_type', 'linkedin')
    .eq('is_active', true)
    .limit(1);

  const account = accounts?.[0];

  if (!account) {
    console.error('❌ No active LinkedIn account found');
    process.exit(1);
  }

  let updated = 0;
  let failed = 0;

  for (const prospect of prospects) {
    // Extract username and strip query params
    const urlPart = prospect.linkedin_url.split('/in/')[1]?.replace('/', '');
    const linkedinUsername = urlPart?.split('?')[0];
    if (!linkedinUsername) {
      console.log(`⚠️  Invalid LinkedIn URL: ${prospect.linkedin_url}`);
      failed++;
      continue;
    }

    try {
      console.log(`\n🔍 Fetching profile: ${linkedinUsername}`);

      const profileUrl = `https://${UNIPILE_DSN}/api/v1/users/${linkedinUsername}?account_id=${account.unipile_account_id}`;
      const response = await fetch(profileUrl, {
        method: 'GET',
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        console.error(`   ❌ Failed: ${response.status}`);
        failed++;
        continue;
      }

      const profileData = await response.json();

      // Extract name from display_name (e.g., "John Doe" or "John Smith")
      const displayName = profileData.display_name || '';
      const nameParts = displayName.trim().split(/\s+/);

      let firstName = '';
      let lastName = '';

      if (nameParts.length >= 2) {
        firstName = nameParts[0];
        lastName = nameParts.slice(1).join(' ');
      } else if (nameParts.length === 1) {
        firstName = nameParts[0];
      }

      console.log(`   ✅ Found: ${firstName} ${lastName}`);

      // Update database
      const { error } = await supabase
        .from('campaign_prospects')
        .update({
          first_name: firstName,
          last_name: lastName,
          // Also update company if missing
          company_name: prospect.company_name || profileData.company || '',
          title: prospect.title || profileData.job_title || ''
        })
        .eq('id', prospect.id);

      if (error) {
        console.error(`   ❌ Database update failed:`, error.message);
        failed++;
      } else {
        console.log(`   ✅ Updated in database`);
        updated++;
      }

      // Rate limit: wait 1 second between calls
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`   ❌ Error:`, error.message);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ UPDATE COMPLETE');
  console.log(`📊 Updated: ${updated}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
