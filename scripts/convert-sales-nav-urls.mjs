#!/usr/bin/env node

/**
 * Convert Sales Navigator URLs to Regular LinkedIn URLs
 *
 * Uses Unipile API to lookup the LinkedIn profile and get the canonical URL
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment
dotenv.config({ path: join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

// Convert Sales Navigator URL to regular LinkedIn URL
// Method from: https://evaboot.com/blog/convert-sales-navigator-url-to-linkedin-url
function convertSalesNavUrl(salesNavUrl) {
  // Sales Navigator Lead URL format:
  // https://www.linkedin.com/sales/lead/ACwAAFvDKocBkeHV8FCRfQlmLM8S5b9feZ7Kh4E,NAME,abc

  // Sales Navigator Account URL format:
  // https://www.linkedin.com/sales/account/12345,NAME,abc

  // Step 1: Extract the unique ID (everything between "lead/" or "account/" and the first comma)
  let uniqueId = null;
  let isCompany = false;

  // Check if it's a lead (person) URL
  const leadMatch = salesNavUrl.match(/\/sales\/lead\/([^,]+)/);
  if (leadMatch) {
    uniqueId = leadMatch[1];
    isCompany = false;
  } else {
    // Check if it's an account (company) URL
    const accountMatch = salesNavUrl.match(/\/sales\/account\/([^,]+)/);
    if (accountMatch) {
      uniqueId = accountMatch[1];
      isCompany = true;
    }
  }

  if (!uniqueId) {
    console.error('   ❌ Invalid Sales Navigator URL format');
    return null;
  }

  // Step 2: Construct the regular LinkedIn URL
  let linkedinUrl;
  if (isCompany) {
    linkedinUrl = `https://www.linkedin.com/company/${uniqueId}`;
  } else {
    linkedinUrl = `https://www.linkedin.com/in/${uniqueId}`;
  }

  console.log(`   ✅ Converted to: ${linkedinUrl}`);
  return linkedinUrl;
}

async function convertAllSalesNavUrls(campaignId, unipileAccountId) {
  console.log('🔄 Converting Sales Navigator URLs to Regular LinkedIn URLs\n');

  // Get all prospects with Sales Navigator URLs
  const { data: prospects, error } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, linkedin_url, status')
    .eq('campaign_id', campaignId)
    .like('linkedin_url', '%/sales/lead/%');

  if (error) {
    console.error('❌ Failed to fetch prospects:', error);
    return;
  }

  if (!prospects || prospects.length === 0) {
    console.log('✅ No Sales Navigator URLs found - nothing to convert!');
    return;
  }

  console.log(`📊 Found ${prospects.length} prospects with Sales Navigator URLs\n`);

  let successCount = 0;
  let failCount = 0;

  for (const prospect of prospects) {
    console.log(`\n👤 ${prospect.first_name} ${prospect.last_name}`);
    console.log(`   Current URL: ${prospect.linkedin_url}`);

    const regularUrl = await convertSalesNavUrl(prospect.linkedin_url, unipileAccountId);

    if (regularUrl) {
      // Update the prospect with the regular LinkedIn URL
      const { error: updateError } = await supabase
        .from('campaign_prospects')
        .update({
          linkedin_url: regularUrl,
          status: 'pending'  // Reset to pending so they can be sent
        })
        .eq('id', prospect.id);

      if (updateError) {
        console.error(`   ❌ Failed to update database: ${updateError.message}`);
        failCount++;
      } else {
        console.log(`   ✅ Updated to: ${regularUrl}`);
        console.log(`   ✅ Status reset to: pending`);
        successCount++;
      }
    } else {
      console.log(`   ❌ Could not convert URL - keeping as 'error' status`);
      failCount++;
    }

    // Rate limit: wait 1 second between API calls
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 CONVERSION SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`Total prospects processed: ${prospects.length}`);
  console.log(`✅ Successfully converted: ${successCount}`);
  console.log(`❌ Failed to convert: ${failCount}`);
  console.log(`${'='.repeat(60)}\n`);

  if (successCount > 0) {
    console.log('🎉 Conversion complete! Converted prospects are now status=pending and ready to send.');
  }

  if (failCount > 0) {
    console.log('⚠️  Some URLs could not be converted. You may need to manually find their regular LinkedIn URLs.');
    console.log('   Tip: Open Sales Navigator → Click the profile → "View on LinkedIn" → Copy URL');
  }
}

// Get campaign ID and Unipile account ID from command line or use defaults
const CAMPAIGN_ID = process.argv[2] || '683f9214-8a3f-4015-98fe-aa3ae76a9ebe';  // Charissa's campaign
const UNIPILE_ACCOUNT_ID = process.argv[3] || '4nt1J-blSnGUPBjH2Nfjpg';  // Charissa's Unipile account

console.log(`Campaign ID: ${CAMPAIGN_ID}`);
console.log(`Unipile Account ID: ${UNIPILE_ACCOUNT_ID}\n`);

convertAllSalesNavUrls(CAMPAIGN_ID, UNIPILE_ACCOUNT_ID);
