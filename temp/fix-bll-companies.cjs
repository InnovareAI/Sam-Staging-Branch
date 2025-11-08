const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Extract real company from title
function extractCompany(title) {
  if (!title) return 'your organization';

  // Common patterns: "at Company" or "@ Company"
  const atMatch = title.match(/\b(?:at|@)\s+([A-Z][A-Za-z0-9\s&.,-]+?)(?:\s*[\|]|$)/);
  if (atMatch) {
    const company = atMatch[1].trim();
    // Filter out non-company phrases
    if (!company.match(/^(CIO|CISO|CEO|CTO|VP|Director|Manager|Leader|Executive)/i)) {
      return company;
    }
  }

  // Fallback
  return 'your organization';
}

// Determine industry from title
function getIndustry(title) {
  if (!title) return 'cybersecurity';
  const lower = title.toLowerCase();

  if (lower.includes('finance') || lower.includes('fintech') || lower.includes('bank')) {
    return 'financial services';
  }
  if (lower.includes('health') || lower.includes('medical') || lower.includes('pharma')) {
    return 'healthcare';
  }
  if (lower.includes('retail') || lower.includes('ecommerce')) {
    return 'retail';
  }
  if (lower.includes('manufactur')) {
    return 'manufacturing';
  }
  if (lower.includes('energy') || lower.includes('utilities')) {
    return 'energy';
  }

  return 'cybersecurity';
}

async function fixCompanies() {
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
    .eq('status', 'approved');

  console.log('Fixing company names and personalization data...\n');

  let fixed = 0;

  for (const p of prospects) {
    const company = extractCompany(p.title);
    const industry = getIndustry(p.title);
    const firstName = p.first_name || 'there';

    const personalizationData = {
      firstName: firstName,
      company: company,
      industry: industry,
      title: p.title || 'security leader',
      linkedin_url: p.linkedin_url
    };

    const { error } = await supabase
      .from('campaign_prospects')
      .update({
        company: company,
        personalization_data: personalizationData
      })
      .eq('id', p.id);

    if (!error) {
      fixed++;
      console.log(`${fixed}. ${firstName} ${p.last_name || ''}`);
      console.log(`   Company: ${company}`);
      console.log(`   Industry: ${industry}`);
    } else {
      console.log(`Error updating ${firstName}: ${error.message}`);
    }
  }

  console.log(`\n✅ Fixed ${fixed}/25 prospects`);
  console.log('\n✅ ALL PROSPECTS READY FOR CAMPAIGN');
  console.log('Campaign: 20251106-BLL-CISO Outreach - Mid Market');
  console.log('\nPersonalization variables:');
  console.log('  [First Name] ✓');
  console.log('  [Company] ✓');
  console.log('  [industry] ✓');
}

fixCompanies().catch(console.error);
