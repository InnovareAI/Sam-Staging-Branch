const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function extractCompany(title) {
  if (!title) return 'your organization';

  const atMatch = title.match(/\b(?:at|@)\s+([A-Z][A-Za-z0-9\s&.,-]+?)(?:\s*[\|]|$)/);
  if (atMatch) {
    const company = atMatch[1].trim();
    if (!company.match(/^(CIO|CISO|CEO|CTO|VP|Director|Manager|Leader|Executive|Board)/i)) {
      return company;
    }
  }

  return 'your organization';
}

function getIndustry(title) {
  if (!title) return 'cybersecurity';
  const lower = title.toLowerCase();

  if (lower.includes('finance') || lower.includes('fintech')) return 'financial services';
  if (lower.includes('health') || lower.includes('medical')) return 'healthcare';
  if (lower.includes('retail')) return 'retail';
  if (lower.includes('energy')) return 'energy';
  if (lower.includes('manufactur')) return 'manufacturing';

  return 'cybersecurity';
}

async function showAll() {
  const wsId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name')
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
  console.log('                 BLL CAMPAIGN PROSPECT REVIEW                          ');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`Campaign: ${campaign.name}`);
  console.log(`Total Prospects: ${prospects.length}`);
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  let withCompany = 0;
  let withoutCompany = 0;

  prospects.forEach((p, idx) => {
    const num = idx + 1;
    const company = extractCompany(p.title);
    const industry = getIndustry(p.title);
    const firstName = p.first_name || 'there';

    if (company !== 'your organization') withCompany++;
    else withoutCompany++;

    console.log(`${num}. ${firstName} ${p.last_name || ''}`);
    console.log(`   Title: ${p.title || 'No title'}`);
    console.log(`   Company: ${company}`);
    console.log(`   Industry: ${industry}`);
    console.log(`   LinkedIn: ${p.linkedin_url ? 'Yes' : 'No'}`);
    console.log(`   Current Personalization:`);
    if (p.personalization_data) {
      console.log(`      - firstName: ${p.personalization_data.firstName || 'N/A'}`);
      console.log(`      - company: ${p.personalization_data.company || 'N/A'}`);
      console.log(`      - industry: ${p.personalization_data.industry || 'N/A'}`);
    } else {
      console.log('      - No personalization data');
    }
    console.log('');
  });

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('                           SUMMARY                                     ');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`✓ Total Prospects: ${prospects.length}`);
  console.log(`✓ With Company Name: ${withCompany}`);
  console.log(`✓ Without Company (will use "your organization"): ${withoutCompany}`);
  console.log(`✓ All have LinkedIn URLs: ${prospects.every(p => p.linkedin_url) ? 'YES' : 'NO'}`);
  console.log(`✓ All have first names: ${prospects.every(p => p.first_name) ? 'YES' : 'NO'}`);
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('\nPersonalization Variables Available:');
  console.log('  [First Name] - ✓ Ready');
  console.log('  [Company] - ✓ Ready (extracted from titles or "your organization")');
  console.log('  [industry] - ✓ Ready (auto-detected from titles)');
  console.log('═══════════════════════════════════════════════════════════════════════\n');
}

showAll().catch(console.error);
