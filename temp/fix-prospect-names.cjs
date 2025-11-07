const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const unipileDsn = process.env.UNIPILE_DSN;
const unipileApiKey = process.env.UNIPILE_API_KEY;
const unipileAccountId = 'mERQmojtSZq5GeomZZazlw'; // Thorsten's account

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixProspectNames() {
  console.log('🔧 Fixing prospect names by enriching from LinkedIn...\n');

  // Get prospects with suspicious first names (likely usernames)
  const { data: prospects, error } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, linkedin_url')
    .not('linkedin_url', 'is', null)
    .limit(50); // Process in batches

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log(`Found ${prospects.length} prospects to check\n`);

  let fixed = 0;
  let skipped = 0;
  let failed = 0;

  for (const prospect of prospects) {
    // Skip if already looks like a proper first name (capitalized, not a username)
    if (prospect.first_name &&
        prospect.first_name.length > 1 &&
        prospect.first_name[0] === prospect.first_name[0].toUpperCase() &&
        prospect.last_name &&
        prospect.last_name !== 'User') {
      skipped++;
      continue;
    }

    try {
      // Extract LinkedIn username
      const linkedinUsername = prospect.linkedin_url.split('/in/')[1]?.replace(/\/$/, '');
      if (!linkedinUsername) {
        console.log(`⚠️  Invalid LinkedIn URL: ${prospect.linkedin_url}`);
        failed++;
        continue;
      }

      console.log(`🔍 Enriching: ${linkedinUsername}`);

      // Fetch from Unipile
      const url = `https://${unipileDsn}/api/v1/users/${linkedinUsername}?account_id=${unipileAccountId}`;
      const response = await fetch(url, {
        headers: {
          'X-API-KEY': unipileApiKey
        }
      });

      if (!response.ok) {
        console.log(`   ❌ Unipile API failed (${response.status})`);
        failed++;
        continue;
      }

      const profileData = await response.json();
      const displayName = profileData.display_name || '';

      if (!displayName) {
        console.log(`   ⚠️  No display name in profile`);
        failed++;
        continue;
      }

      // Parse display name into first/last
      const nameParts = displayName.trim().split(/\s+/);
      let firstName = '';
      let lastName = '';

      if (nameParts.length >= 2) {
        firstName = nameParts[0];
        lastName = nameParts.slice(1).join(' ');
      } else if (nameParts.length === 1) {
        firstName = nameParts[0];
        lastName = prospect.last_name || '';
      }

      // Update the prospect
      const { error: updateError } = await supabase
        .from('campaign_prospects')
        .update({
          first_name: firstName,
          last_name: lastName
        })
        .eq('id', prospect.id);

      if (updateError) {
        console.log(`   ❌ Update failed: ${updateError.message}`);
        failed++;
      } else {
        console.log(`   ✅ Updated: ${firstName} ${lastName}`);
        fixed++;
      }

      // Rate limit: wait 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Fixed: ${fixed}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);
}

fixProspectNames().catch(console.error);
