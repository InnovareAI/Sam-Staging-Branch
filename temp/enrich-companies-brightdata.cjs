const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BRIGHTDATA_CUSTOMER_ID = process.env.BRIGHT_DATA_CUSTOMER_ID;
const BRIGHTDATA_PASSWORD = process.env.BRIGHT_DATA_PASSWORD;

// BrightData LinkedIn Profile Scraper API
async function scrapeLinkedInProfile(linkedinUrl) {
  try {
    const url = 'https://api.brightdata.com/datasets/v3/trigger';

    const payload = {
      dataset_id: 'gd_l7q7dkf244hwjntr0',  // LinkedIn Profile dataset
      include_errors: true,
      format: 'json',
      snapshot_id: `bll_${Date.now()}`,
      discover_by: 'url',
      discover: [linkedinUrl]
    };

    console.log(`  📡 Scraping: ${linkedinUrl}`);

    const auth = Buffer.from(`${BRIGHTDATA_CUSTOMER_ID}:${BRIGHTDATA_PASSWORD}`).toString('base64');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`  ❌ BrightData API error: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    console.log(`  ✅ Snapshot created: ${data.snapshot_id}`);

    // Wait for snapshot to complete
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Get snapshot results
    const snapshotUrl = `https://api.brightdata.com/datasets/v3/snapshot/${data.snapshot_id}`;
    const snapshotResponse = await fetch(snapshotUrl, {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });

    if (!snapshotResponse.ok) {
      console.error(`  ❌ Failed to get snapshot data`);
      return null;
    }

    const snapshotData = await snapshotResponse.json();
    return snapshotData;

  } catch (error) {
    console.error(`  ❌ Error scraping LinkedIn: ${error.message}`);
    return null;
  }
}

function extractCompanyFromProfile(profileData) {
  if (!profileData) return null;

  // BrightData returns current company in the experience array
  if (profileData.experience && profileData.experience.length > 0) {
    const currentJob = profileData.experience[0];
    if (currentJob.company_name) {
      return currentJob.company_name;
    }
  }

  // Fallback to company field if available
  if (profileData.company) {
    return profileData.company;
  }

  return null;
}

function getIndustry(title, company) {
  const text = `${title || ''} ${company || ''}`.toLowerCase();

  if (text.includes('finance') || text.includes('fintech') || text.includes('bank')) {
    return 'financial services';
  }
  if (text.includes('health') || text.includes('medical') || text.includes('pharma') || text.includes('lifesciences')) {
    return 'healthcare';
  }
  if (text.includes('retail') || text.includes('ecommerce')) {
    return 'retail';
  }
  if (text.includes('manufactur')) {
    return 'manufacturing';
  }
  if (text.includes('energy') || text.includes('utilities') || text.includes('pipeline')) {
    return 'energy';
  }
  if (text.includes('university') || text.includes('education')) {
    return 'education';
  }

  return 'cybersecurity';
}

async function enrichCompanies() {
  const wsId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id')
    .eq('workspace_id', wsId)
    .eq('name', '20251106-BLL-CISO Outreach - Mid Market')
    .single();

  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', campaign.id)
    .eq('status', 'approved')
    .order('last_name');

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('              ENRICHING COMPANIES WITH BRIGHTDATA                       ');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`Total prospects to enrich: ${prospects.length}`);
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  let enriched = 0;
  let failed = 0;
  let skipped = 0;

  for (const [index, prospect] of prospects.entries()) {
    const num = index + 1;
    console.log(`\n${num}/${prospects.length}. ${prospect.first_name} ${prospect.last_name || ''}`);

    // Skip if already has a real company
    if (prospect.personalization_data?.company &&
        prospect.personalization_data.company !== 'your organization') {
      console.log(`  ⏭️  Already has company: ${prospect.personalization_data.company}`);
      skipped++;
      continue;
    }

    if (!prospect.linkedin_url) {
      console.log(`  ⚠️  No LinkedIn URL`);
      failed++;
      continue;
    }

    // Scrape LinkedIn profile
    const profileData = await scrapeLinkedInProfile(prospect.linkedin_url);

    if (!profileData) {
      console.log(`  ❌ Failed to scrape profile`);
      failed++;
      continue;
    }

    // Extract company name
    const company = extractCompanyFromProfile(profileData);

    if (!company) {
      console.log(`  ⚠️  No company found in profile, using fallback`);
      failed++;
      continue;
    }

    // Determine industry
    const industry = getIndustry(prospect.title, company);

    // Update personalization data
    const personalizationData = {
      firstName: prospect.first_name || 'there',
      company: company,
      industry: industry,
      title: prospect.title || 'security leader',
      linkedin_url: prospect.linkedin_url
    };

    const { error } = await supabase
      .from('campaign_prospects')
      .update({ personalization_data: personalizationData })
      .eq('id', prospect.id);

    if (error) {
      console.log(`  ❌ Database update error: ${error.message}`);
      failed++;
    } else {
      console.log(`  ✅ Company: ${company}`);
      console.log(`  ✅ Industry: ${industry}`);
      enriched++;
    }

    // Rate limit: Wait 3 seconds between requests
    if (index < prospects.length - 1) {
      console.log(`  ⏳ Waiting 3 seconds before next request...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('                          ENRICHMENT COMPLETE                          ');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`✅ Successfully enriched: ${enriched} prospects`);
  console.log(`⏭️  Skipped (already had company): ${skipped} prospects`);
  console.log(`❌ Failed: ${failed} prospects`);
  console.log(`📊 Total: ${prospects.length} prospects`);
  console.log('═══════════════════════════════════════════════════════════════════════\n');
}

enrichCompanies().catch(console.error);
