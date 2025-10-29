#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const campaignId = '51803ded-bbc9-4564-aefb-c6d11d69f17c';

console.log('🔄 Re-enriching failed prospects...\n');

// Get workspace and LinkedIn account
const { data: campaign } = await supabase
  .from('campaigns')
  .select('workspace_id, created_by')
  .eq('id', campaignId)
  .single();

if (!campaign) {
  console.error('Campaign not found');
  process.exit(1);
}

// Get LinkedIn account for this workspace
const { data: linkedinAccount } = await supabase
  .from('workspace_accounts')
  .select('unipile_account_id')
  .eq('workspace_id', campaign.workspace_id)
  .eq('provider', 'linkedin')
  .single();

if (!linkedinAccount?.unipile_account_id) {
  console.error('❌ No LinkedIn account found for workspace');
  process.exit(1);
}

console.log(`✅ Using LinkedIn account: ${linkedinAccount.unipile_account_id}\n`);

// Get failed prospects
const { data: failed } = await supabase
  .from('campaign_prospects')
  .select('id, linkedin_url')
  .eq('campaign_id', campaignId)
  .eq('status', 'failed')
  .limit(5); // Start with first 5

console.log(`Found ${failed?.length || 0} prospects to re-enrich\n`);

let enriched = 0;
let errors = 0;

for (const prospect of failed || []) {
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
        account_id: linkedinAccount.unipile_account_id,
        identifier: prospect.linkedin_url
      })
    });

    if (!response.ok) {
      console.log(`  ❌ Failed: ${response.status} ${response.statusText}`);
      errors++;
      continue;
    }

    const profileData = await response.json();
    
    // Extract name and company
    const firstName = profileData.first_name || profileData.name?.split(' ')[0] || '';
    const lastName = profileData.last_name || profileData.name?.split(' ').slice(1).join(' ') || '';
    const company = profileData.company_name || profileData.headline?.match(/at (.+?)$/)?.[1] || '';
    
    if (!firstName && !lastName && !company) {
      console.log(`  ⚠️  No data available in LinkedIn profile`);
      errors++;
      continue;
    }

    // Update prospect
    const { error: updateError } = await supabase
      .from('campaign_prospects')
      .update({
        first_name: firstName,
        last_name: lastName,
        company_name: company,
        status: 'pending', // Reset to pending so cron will retry
        error_message: null,
        personalization_data: {
          ...prospect.personalization_data,
          enriched_at: new Date().toISOString(),
          error: null
        }
      })
      .eq('id', prospect.id);

    if (updateError) {
      console.log(`  ❌ Update failed: ${updateError.message}`);
      errors++;
    } else {
      console.log(`  ✅ ${firstName} ${lastName} at ${company || 'Unknown Company'}`);
      enriched++;
    }
    
    // Rate limit: wait 2 seconds between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    errors++;
  }
}

console.log(`\n📊 Results:`);
console.log(`   ✅ Enriched: ${enriched}`);
console.log(`   ❌ Errors: ${errors}`);
console.log(`\nEnriched prospects will be automatically messaged by cron within 2 minutes.`);
