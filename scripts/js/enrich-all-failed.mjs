#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const campaignId = '51803ded-bbc9-4564-aefb-c6d11d69f17c';
const unipileAccountId = 'lN6tdIWOStK_dEaxhygCEQ';

console.log('🔄 Enriching all failed prospects...\n');

const { data: failed } = await supabase
  .from('campaign_prospects')
  .select('id, linkedin_url, personalization_data')
  .eq('campaign_id', campaignId)
  .eq('status', 'failed')
  .limit(31);

if (!failed || failed.length === 0) {
  console.log('✅ No failed prospects');
  process.exit(0);
}

console.log(`Processing ${failed.length} prospects\n`);

let enriched = 0;
let errors = 0;

for (const prospect of failed) {
  try {
    const linkedinUsername = prospect.linkedin_url.split('/in/')[1]?.split('?')[0]?.replace('/', '');
    
    if (!linkedinUsername) {
      errors++;
      continue;
    }

    const profileUrl = `https://${process.env.UNIPILE_DSN}/api/v1/users/${linkedinUsername}?account_id=${unipileAccountId}`;
    
    const response = await fetch(profileUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': process.env.UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      errors++;
      continue;
    }

    const profileData = await response.json();
    
    const firstName = profileData.first_name || profileData.display_name?.split(' ')[0] || '';
    const lastName = profileData.last_name || profileData.display_name?.split(' ').slice(1).join(' ') || '';
    const company = profileData.company_name || profileData.company?.name || '';
    const jobTitle = profileData.headline || '';
    const providerId = profileData.provider_id;
    
    if (!firstName && !lastName) {
      errors++;
      continue;
    }

    // Update - use 'title' not 'job_title'
    const { error: updateError } = await supabase
      .from('campaign_prospects')
      .update({
        first_name: firstName,
        last_name: lastName,
        company_name: company || 'Unknown Company',
        title: jobTitle,
        status: 'pending',
        personalization_data: {
          ...(prospect.personalization_data || {}),
          enriched_at: new Date().toISOString(),
          error: null,
          provider_id: providerId
        }
      })
      .eq('id', prospect.id);

    if (updateError) {
      console.log(`❌ ${linkedinUsername}: ${updateError.message}`);
      errors++;
    } else {
      console.log(`✅ ${firstName} ${lastName} at ${company || 'Unknown'}`);
      enriched++;
    }
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
  } catch (error) {
    errors++;
  }
}

console.log(`\n📊 Final Results:`);
console.log(`   ✅ Enriched: ${enriched} prospects`);
console.log(`   ❌ Failed: ${errors} prospects`);
console.log(`\n🎯 Next steps:`);
if (enriched > 0) {
  console.log(`   - ${enriched} prospects reset to "pending" status`);
  console.log(`   - Automation cron will message them within 2 minutes`);
  console.log(`   - Check campaign status with: node scripts/js/check-specific-campaign.mjs`);
}
if (errors > 0) {
  console.log(`   - ${errors} prospects could not be enriched (no LinkedIn data available)`);
}
