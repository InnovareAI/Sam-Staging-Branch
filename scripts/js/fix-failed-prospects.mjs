#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const campaignId = '51803ded-bbc9-4564-aefb-c6d11d69f17c';
const unipileAccountId = 'lN6tdIWOStK_dEaxhygCEQ'; // 3cubed LinkedIn account

console.log('🔄 Re-enriching failed prospects...\n');

// Get failed prospects
const { data: failed } = await supabase
  .from('campaign_prospects')
  .select('id, linkedin_url, personalization_data')
  .eq('campaign_id', campaignId)
  .eq('status', 'failed')
  .limit(5); // Start with 5 to avoid rate limits

if (!failed || failed.length === 0) {
  console.log('No failed prospects found');
  process.exit(0);
}

console.log(`Found ${failed.length} prospects to re-enrich\n`);

let enriched = 0;
let errors = 0;

for (const prospect of failed) {
  try {
    console.log(`Enriching: ${prospect.linkedin_url}`);
    
    // Call Unipile to get profile data
    const response = await fetch(`https://${process.env.UNIPILE_DSN}/api/v1/users/profile`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-API-KEY': process.env.UNIPILE_API_KEY
      },
      body: JSON.stringify({
        account_id: unipileAccountId,
        identifier: prospect.linkedin_url
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`  ❌ API Error: ${response.status} - ${errorText.substring(0, 100)}`);
      errors++;
      continue;
    }

    const profileData = await response.json();
    
    // Extract name and company - same logic as execute-live
    const firstName = profileData.first_name || profileData.name?.split(' ')[0] || '';
    const lastName = profileData.last_name || profileData.name?.split(' ').slice(1).join(' ') || '';
    const company = profileData.company_name || 
                    profileData.company?.name || 
                    profileData.headline?.match(/at (.+?)$/)?.[1] || '';
    const title = profileData.headline || profileData.title || '';
    
    if (!firstName && !lastName) {
      console.log(`  ⚠️  No name data in LinkedIn profile`);
      errors++;
      continue;
    }

    // Update prospect with enriched data
    const { error: updateError } = await supabase
      .from('campaign_prospects')
      .update({
        first_name: firstName,
        last_name: lastName,
        company_name: company || 'Unknown Company',
        job_title: title,
        status: 'pending', // Reset to pending so cron will retry
        error_message: null,
        personalization_data: {
          ...(prospect.personalization_data || {}),
          enriched_at: new Date().toISOString(),
          error: null,
          provider_id: profileData.id // Store for follow-ups
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
    
    // Rate limit: wait 3 seconds between requests
    await new Promise(resolve => setTimeout(resolve, 3000));
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    errors++;
  }
}

console.log(`\n📊 Results:`);
console.log(`   ✅ Enriched: ${enriched}`);
console.log(`   ❌ Errors: ${errors}`);
console.log(`\nEnriched prospects will be automatically messaged by cron within 2 minutes.`);
console.log(`\nTo enrich more, run this script again.`);
