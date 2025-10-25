import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkProspects() {
  console.log('🔍 Checking workspace prospects...\n');

  // First, get a sample to see the schema
  const { data: sampleProspects, error: sampleError } = await supabase
    .from('workspace_prospects')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (sampleProspects && sampleProspects.length > 0) {
    console.log('Schema/Columns:', Object.keys(sampleProspects[0]));
    console.log('');
  }

  // Get recently created prospects  (with campaign_name which indicates they went through approval)
  const { data: prospects, error } = await supabase
    .from('workspace_prospects')
    .select('*')
    .not('campaign_name', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!prospects || prospects.length === 0) {
    console.log('⚠️  No prospects found with campaign names');
    return;
  }

  console.log(`✅ Found ${prospects.length} prospects with campaign names:\n`);

  prospects.forEach((p, i) => {
    console.log(`Prospect ${i + 1}:`);
    console.log(`  Name: ${p.name}`);
    console.log(`  Email: ${p.email}`);
    console.log(`  LinkedIn URL: ${p.linkedin_url || 'NOT SET'}`);
    console.log(`  Campaign Name: ${p.campaign_name || 'NOT SET'}`);
    console.log(`  Company: ${p.company_name || 'NOT SET'}`);
    console.log('');
  });

  // Check if any campaigns have been created from these prospects
  const campaignNames = [...new Set(prospects.map(p => p.campaign_name).filter(Boolean))];

  if (campaignNames.length > 0) {
    console.log(`\n📋 Checking campaigns created from these prospects...\n`);

    for (const campaignName of campaignNames) {
      const { data: campaign, error: campError } = await supabase
        .from('campaigns')
        .select('id, name, status, workspace_id')
        .eq('name', campaignName)
        .maybeSingle();

      if (campaign) {
        console.log(`Campaign: ${campaign.name}`);
        console.log(`  ID: ${campaign.id}`);
        console.log(`  Status: ${campaign.status}`);

        // Check campaign prospects
        const { data: campProspects, error: cpError } = await supabase
          .from('campaign_prospects')
          .select('first_name, last_name, email, linkedin_url, linkedin_user_id, status')
          .eq('campaign_id', campaign.id);

        if (campProspects) {
          console.log(`  Prospects: ${campProspects.length}`);
          const withLinkedIn = campProspects.filter(p => p.linkedin_url || p.linkedin_user_id).length;
          console.log(`  With LinkedIn URL/ID: ${withLinkedIn}`);
          console.log(`  Sample prospect:`, {
            name: `${campProspects[0]?.first_name} ${campProspects[0]?.last_name}`,
            email: campProspects[0]?.email,
            linkedin_url: campProspects[0]?.linkedin_url || 'NOT SET',
            linkedin_user_id: campProspects[0]?.linkedin_user_id || 'NOT SET',
            status: campProspects[0]?.status
          });
        }
        console.log('');
      }
    }
  }
}

checkProspects().catch(console.error);
