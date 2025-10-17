/**
 * Remove dummy/test campaigns from all statuses
 * Run with: node scripts/remove-dummy-campaigns.cjs
 */
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function removeDummyCampaigns() {
  try {
    console.log('🔍 Finding dummy/test campaigns...\n');

    // Get all campaigns
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('id, name, status, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching campaigns:', error);
      return;
    }

    console.log(`📊 Found ${campaigns.length} total campaigns\n`);

    // Identify dummy campaigns (you can adjust these patterns)
    const dummyPatterns = [
      /test/i,
      /dummy/i,
      /sample/i,
      /demo/i,
      /IAI-test/i,
      /20251017-IAI/i
    ];

    const dummyCampaigns = campaigns.filter(campaign =>
      dummyPatterns.some(pattern => pattern.test(campaign.name))
    );

    if (dummyCampaigns.length === 0) {
      console.log('✅ No dummy campaigns found!');
      return;
    }

    console.log(`🗑️  Found ${dummyCampaigns.length} dummy campaigns:\n`);

    dummyCampaigns.forEach((campaign, index) => {
      console.log(`${index + 1}. ${campaign.name}`);
      console.log(`   ID: ${campaign.id}`);
      console.log(`   Status: ${campaign.status}`);
      console.log(`   Created: ${campaign.created_at}`);
      console.log('');
    });

    console.log('\n⚠️  WARNING: This will DELETE these campaigns permanently!\n');
    console.log('To proceed, run this SQL in Supabase:\n');

    const campaignIds = dummyCampaigns.map(c => `'${c.id}'`).join(', ');

    console.log('-- Delete dummy campaigns');
    console.log(`DELETE FROM campaigns WHERE id IN (${campaignIds});`);
    console.log('\n-- This will cascade delete:');
    console.log('-- - campaign_prospects');
    console.log('-- - campaign messages');
    console.log('-- - campaign analytics');
    console.log('\n💡 Or to archive instead of delete:');
    console.log(`UPDATE campaigns SET status = 'archived' WHERE id IN (${campaignIds});`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

removeDummyCampaigns();
