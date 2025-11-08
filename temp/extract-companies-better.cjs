const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Improved company extraction that handles @ symbol and various formats
function extractCompany(title) {
  if (!title) return null;

  // Pattern 1: "@ Company" - simple single word companies
  let match = title.match(/\b@\s+([A-Z][A-Za-z0-9]+)\s+(?:for|as|\||$)/);
  if (match) {
    return match[1].trim();
  }

  // Pattern 2: "at Company" or "@ Company Name" (multi-word)
  match = title.match(/\b(?:@|at)\s+([A-Z][A-Za-z0-9\s&.,'()-]+?)(?:\s+for|\s+as|\s*\||$)/);
  if (match) {
    const company = match[1].trim();
    // Filter out job titles and known false positives
    if (!company.match(/^(CIO|CISO|CEO|CTO|CFO|VP|SVP|Director|Manager|Leader|Executive|Board|Head|Chief|Cyber|Intel|Threat|Analyst)/i)) {
      // Also check it's not ending with a job title
      if (!company.match(/(Director|Manager|Leader|Executive|Analyst|Officer|Engineer|Architect|Consultant)$/i)) {
        return company;
      }
    }
  }

  // Pattern 3: Look for "at Company Group/Service/etc" before "Head of"
  match = title.match(/(?:at|@)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){1,3})\s+Head\s+of/i);
  if (match) {
    return match[1].trim();
  }

  return null;
}

function getIndustry(title, company) {
  const text = `${title || ''} ${company || ''}`.toLowerCase();

  if (text.includes('finance') || text.includes('fintech') || text.includes('bank')) {
    return 'financial services';
  }
  if (text.includes('health') || text.includes('medical') || text.includes('pharma') || text.includes('lifesciences') || text.includes('life sciences')) {
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
  if (text.includes('university') || text.includes('education') || text.includes('reserve')) {
    return 'education';
  }
  if (text.includes('microsoft') || text.includes('google') || text.includes('aws') || text.includes('tech ')) {
    return 'technology';
  }
  if (text.includes('cardworks') || text.includes('payment')) {
    return 'financial services';
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
  console.log('           IMPROVED COMPANY EXTRACTION FROM TITLES                     ');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  let updated = 0;
  let skipped = 0;

  for (const [index, prospect] of prospects.entries()) {
    const num = index + 1;
    console.log(`${num}. ${prospect.first_name} ${prospect.last_name || ''}`);
    console.log(`   Title: ${prospect.title || 'No title'}`);

    // Extract company
    const company = extractCompany(prospect.title) || 'your organization';
    const industry = getIndustry(prospect.title, company);

    console.log(`   Extracted Company: ${company}`);
    console.log(`   Industry: ${industry}`);

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
      console.log(`   ❌ Update error: ${error.message}`);
    } else {
      if (company !== 'your organization') {
        console.log(`   ✅ Updated with real company`);
        updated++;
      } else {
        console.log(`   ⚠️  Using fallback "your organization"`);
        skipped++;
      }
    }
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('                          SUMMARY                                      ');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`✅ Updated with real companies: ${updated}`);
  console.log(`⚠️  Using "your organization": ${skipped}`);
  console.log(`📊 Total: ${prospects.length}`);
  console.log('═══════════════════════════════════════════════════════════════════════\n');
}

enrichCompanies().catch(console.error);
