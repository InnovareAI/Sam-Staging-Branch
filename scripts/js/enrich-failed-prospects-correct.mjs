#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const campaignId = '51803ded-bbc9-4564-aefb-c6d11d69f17c';
const unipileAccountId = 'lN6tdIWOStK_dEaxhygCEQ';

console.log('🔄 Re-enriching failed prospects with correct API...\n');

// Get failed prospects
const { data: failed } = await supabase
  .from('campaign_prospects')
  .select('id, linkedin_url, personalization_data')
  .eq('campaign_id', campaignId)
  .eq('status', 'failed')
  .limit(10); // Process 10 at a time

if (!failed || failed.length === 0) {
  console.log('✅ No failed prospects found');
  process.exit(0);
}

console.log(`Found ${failed.length} prospects to re-enrich\n`);

let enriched = 0;
let errors = 0;

for (const prospect of failed) {
  try {
    // Extract LinkedIn username from URL
    const linkedinUsername = prospect.linkedin_url.split('/in/')[1]?.split('?')[0]?.replace('/', '');
    
    if (!linkedinUsername) {
      console.log(`❌ Invalid LinkedIn URL: ${prospect.linkedin_url}`);
      errors++;
      continue;
    }

    console.log(`Enriching: ${linkedinUsername}`);
    
    // Call Unipile GET /api/v1/users/{username}
    const profileUrl = `https://${process.env.UNIPILE_DSN}/api/v1/users/${linkedinUsername}?account_id=${unipileAccountId}`;
    
    const response = await fetch(profileUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': process.env.UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`  ❌ API Error ${response.status}: ${errorText.substring(0, 100)}`);
      errors++;
      continue;
    }

    const profileData = await response.json();
    
    // Extract data using same logic as execute-live
    const firstName = profileData.first_name || profileData.display_name?.split(' ')[0] || '';
    const lastName = profileData.last_name || profileData.display_name?.split(' ').slice(1).join(' ') || '';
    const company = profileData.company_name || profileData.company?.name || '';
    const title = profileData.headline || '';
    const providerId = profileData.provider_id;
    
    if (!firstName && !lastName) {
      console.log(`  ⚠️  No name found in profile`);
      errors++;
      continue;
    }

    // Update prospect
    const { error: updateError } = await supabase
      .from('campaign_prospects')
      .update({
        first_name: firstName,
        last_name: lastName,
        company_name: company || 'Unknown Company',
        job_title: title,
        status: 'pending', // Reset to pending for retry
        error_message: null,
        personalization_data: {
          ...(prospect.personalization_data || {}),
          enriched_at: new Date().toISOString(),
          error: null,
          provider_id: providerId
        }
      })
      .eq('id', prospect.id);

    if (updateError) {
      console.log(`  ❌ Update failed: ${updateError.message}`);
      errors++;
    } else {
      console.log(`  ✅ ${firstName} ${lastName} at ${company || 'Unknown'}`);
      enriched++;
    }
    
    // Rate limit: 2 seconds between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    errors++;
  }
}

console.log(`\n📊 Results:`);
console.log(`   ✅ Enriched: ${enriched}`);
console.log(`   ❌ Errors: ${errors}`);
console.log(`   ⏳ Remaining: ${31 - enriched - errors}`);

if (enriched > 0) {
  console.log(`\n✅ Enriched prospects will be automatically messaged within 2 minutes.`);
}

if (errors > 0) {
  console.log(`\n⚠️  ${errors} prospects could not be enriched (LinkedIn profiles unavailable or restricted)`);
}
