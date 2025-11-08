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

  return 'cybersecurity';
}

async function update() {
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

  console.log('Updating personalization data for 25 prospects...\n');

  let updated = 0;

  for (const p of prospects) {
    const company = extractCompany(p.title);
    const industry = getIndustry(p.title);
    const firstName = p.first_name || 'there';

    const personalizationData = {
      firstName: firstName,
      company: company,
      industry: industry
    };

    const { error } = await supabase
      .from('campaign_prospects')
      .update({ personalization_data: personalizationData })
      .eq('id', p.id);

    if (!error) {
      updated++;
      console.log(`${updated}. ${firstName} ${p.last_name || ''} - ${company} (${industry})`);
    }
  }

  console.log(`\n✅ Updated ${updated}/25 prospects`);
  console.log('\n✅ Campaign ready: 20251106-BLL-CISO Outreach - Mid Market');
}

update().catch(console.error);
