require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function exportProspects() {
  const campaignId = '0a56408b-be39-4144-870f-2b0dce45b620';

  console.log('📤 EXPORTING 25 PROSPECTS FOR UPLOAD\n');
  console.log('=' .repeat(70));

  // Get the 25 prospects
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('last_name');

  if (!prospects || prospects.length === 0) {
    console.log('\n❌ No prospects found\n');
    return;
  }

  console.log(`\n✅ Found ${prospects.length} prospects\n`);

  // Format for upload endpoint
  const formattedProspects = prospects.map(p => ({
    first_name: p.first_name,
    last_name: p.last_name,
    email: p.email,
    company: p.company,
    title: p.title,
    linkedin_url: p.linkedin_url,
    phone: p.phone,
    location: p.location,
    industry: p.industry,
    notes: p.notes,
    personalization_data: p.personalization_data || {}
  }));

  // Create upload payload
  const uploadPayload = {
    campaign_id: campaignId,
    prospects: formattedProspects
  };

  // Save to file
  const outputPath = '/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/temp/prospects-upload.json';
  fs.writeFileSync(outputPath, JSON.stringify(uploadPayload, null, 2));

  console.log(`✅ Exported to: ${outputPath}\n`);

  // Also create a simple list
  console.log('📋 PROSPECT LIST:\n');
  prospects.forEach((p, i) => {
    console.log(`${String(i + 1).padStart(2, ' ')}. ${p.first_name} ${p.last_name}`);
    console.log(`    ${p.title || 'No title'}`);
    console.log(`    ${p.company || 'Unknown company'}`);
    console.log(`    ${p.linkedin_url ? '✅ LinkedIn' : '❌ No LinkedIn'}`);
  });

  console.log('\n' + '=' .repeat(70));
  console.log(`\n💡 To upload, send POST to: /api/campaigns/upload-prospects`);
  console.log(`   With the JSON from: ${outputPath}\n`);
}

exportProspects().catch(console.error);
