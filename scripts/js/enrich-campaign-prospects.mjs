#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const unipileApiKey = process.env.UNIPILE_API_KEY;
const unipileDsn = process.env.UNIPILE_DSN;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

if (!unipileApiKey || !unipileDsn) {
  console.error('❌ Missing Unipile credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function enrichCampaignProspects(campaignId, unipileAccountId) {
  try {
    console.log('🔍 Fetching campaign...');

    // Get campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name, workspace_id')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error('❌ Campaign not found:', campaignError);
      return;
    }

    console.log('✅ Found campaign:', campaign.name);
    console.log('');

    // Get all prospects
    const { data: prospects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select('id, first_name, last_name, linkedin_url, company_name, title')
      .eq('campaign_id', campaignId);

    if (prospectsError) {
      console.error('❌ Error fetching prospects:', prospectsError);
      return;
    }

    console.log(`📊 Found ${prospects.length} prospects`);
    console.log('');

    let updated = 0;
    let failed = 0;
    let skipped = 0;

    for (const prospect of prospects) {
      try {
        // Skip if already has proper company data (not a headline)
        if (prospect.company_name && prospect.title &&
            !prospect.company_name.includes('|') &&
            prospect.company_name.length < 100) {
          console.log('⏭️ ', prospect.first_name, prospect.last_name, '- Already enriched');
          skipped++;
          continue;
        }

        // Extract vanity from LinkedIn URL
        const vanityMatch = prospect.linkedin_url?.match(/linkedin\.com\/in\/([^\/\?#]+)/);
        if (!vanityMatch) {
          console.log('❌', prospect.first_name, prospect.last_name, '- Invalid LinkedIn URL');
          failed++;
          continue;
        }

        const vanity = vanityMatch[1];

        // Fetch from Unipile using legacy endpoint
        const response = await fetch(
          `https://${unipileDsn}/api/v1/users/${vanity}?account_id=${unipileAccountId}`,
          {
            method: 'GET',
            headers: {
              'X-API-KEY': unipileApiKey
            }
          }
        );

        if (!response.ok) {
          console.log('❌', prospect.first_name, prospect.last_name, '- API error:', response.status);
          failed++;
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }

        const data = await response.json();

        // Extract company from position
        const position = data.positions && data.positions.length > 0 ? data.positions[0] : null;
        const companyName = position?.company_name || null;
        const title = position?.title || null;

        if (companyName) {
          // Update in database
          const { error: updateError } = await supabase
            .from('campaign_prospects')
            .update({
              company_name: companyName,
              title: title,
              updated_at: new Date().toISOString()
            })
            .eq('id', prospect.id);

          if (updateError) {
            console.log('❌', prospect.first_name, prospect.last_name, '- Update failed:', updateError.message);
            failed++;
          } else {
            console.log('✅', prospect.first_name, prospect.last_name);
            console.log('   Company:', companyName);
            console.log('   Title:', title);
            updated++;
          }
        } else {
          console.log('⚠️ ', prospect.first_name, prospect.last_name, '- No company found');
          failed++;
        }

        // Rate limit: wait 2 seconds between requests
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.log('❌', prospect.first_name, prospect.last_name, '- Error:', error.message);
        failed++;
      }
    }

    console.log('');
    console.log('Summary:');
    console.log('  ✅ Updated:', updated);
    console.log('  ⏭️  Skipped:', skipped);
    console.log('  ❌ Failed:', failed);
    console.log('');
    console.log('✅ Enrichment complete!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Get campaign ID from command line args
const campaignId = process.argv[2];
const unipileAccountId = process.argv[3];

if (!campaignId) {
  console.error('Usage: node scripts/js/enrich-campaign-prospects.mjs <campaign_id> <unipile_account_id>');
  console.error('');
  console.error('Example:');
  console.error('  node scripts/js/enrich-campaign-prospects.mjs 0a56408b-be39-4144-870f-2b0dce45b620 4Vv6oZ73RvarImDN6iYbbg');
  process.exit(1);
}

if (!unipileAccountId) {
  console.error('❌ Missing Unipile account ID');
  console.error('');
  console.error('Available accounts:');
  console.error('  Stan Bounev: 4Vv6oZ73RvarImDN6iYbbg');
  console.error('  Irish Maguad: ymtTx4xVQ6OVUFk83ctwtA');
  console.error('  Michelle: aroiwOeQQo2S8_-FqLjzNw');
  process.exit(1);
}

enrichCampaignProspects(campaignId, unipileAccountId);
