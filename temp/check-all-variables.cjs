const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllVariables() {
  console.log('🔍 Checking all prospect variables...\n');

  // Check recent prospect_approval_data
  const { data: approvalData } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('📋 Recent Prospect Approval Data:\n');

  approvalData.forEach((p, index) => {
    console.log(`${index + 1}. ${p.name}`);
    console.log(`   Raw Data Structure:`);
    console.log(`   - name: "${p.name}"`);
    console.log(`   - title: "${p.title}"`);
    console.log(`   - location: "${p.location}"`);
    console.log(`   - linkedin_url: "${p.linkedin_url}"`);
    console.log(`   - company: ${JSON.stringify(p.company, null, 2)}`);
    console.log(`   - contact: ${JSON.stringify(p.contact, null, 2)}`);
    console.log('');
  });

  // Check how these map to campaign_prospects
  const { data: campaignData } = await supabase
    .from('campaign_prospects')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('\n📊 Recent Campaign Prospects Data:\n');

  campaignData.forEach((p, index) => {
    console.log(`${index + 1}. ${p.first_name} ${p.last_name}`);
    console.log(`   Mapped Variables:`);
    console.log(`   - first_name: "${p.first_name}"`);
    console.log(`   - last_name: "${p.last_name}"`);
    console.log(`   - company_name: "${p.company_name}"`);
    console.log(`   - title: "${p.title}"`);
    console.log(`   - location: "${p.location}"`);
    console.log(`   - industry: "${p.industry}"`);
    console.log(`   - linkedin_url: "${p.linkedin_url}"`);
    console.log('');
  });

  // Show the mapping logic from code
  console.log('\n🔄 Current Mapping Logic (from add-approved-prospects):');
  console.log(`
  first_name: normalized from prospect.name
  last_name: normalized from prospect.name
  company_name: prospect.company?.name || ''
  title: prospect.title || ''
  location: prospect.location || null
  industry: prospect.company?.industry?.[0] || 'Not specified'
  linkedin_url: prospect.contact?.linkedin_url || prospect.linkedin_url
  `);
}

checkAllVariables().catch(console.error);
