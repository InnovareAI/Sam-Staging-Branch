import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const campaignId = process.argv[2] || 'eab2af84-cc09-4e60-9c51-701ef1621840';

const { data: prospects, error } = await supabase
  .from('campaign_prospects')
  .select('first_name, last_name, company_name, status, contacted_at, created_at, personalization_data')
  .eq('campaign_id', campaignId)
  .order('created_at', { ascending: true });

if (error) {
  console.error('Error fetching prospects:', error);
  process.exit(1);
}

console.log('📋 Campaign Prospects Schedule Check');
console.log('🕐 Current time:', new Date().toISOString());
console.log('🆔 Campaign ID:', campaignId);
console.log('');

if (!prospects || prospects.length === 0) {
  console.log('❌ No prospects found');
  process.exit(0);
}

prospects.forEach((p, i) => {
  const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown';
  console.log(`${i + 1}. ${name} - ${p.company_name || 'No company'}`);
  console.log(`   Status: ${p.status}`);
  console.log(`   Created: ${p.created_at}`);
  console.log(`   Contacted: ${p.contacted_at || '⚠️  Not yet contacted'}`);

  // Check personalization_data for any scheduling info
  if (p.personalization_data) {
    const data = p.personalization_data;
    if (data.queued_for_background) {
      console.log(`   📦 Queued for background: YES`);
    }
    if (data.batch_number) {
      console.log(`   📦 Batch: ${data.batch_number}`);
    }
    if (data.scheduled_time) {
      console.log(`   ⏰ Scheduled: ${data.scheduled_time}`);
    }
  } else {
    console.log(`   ⚠️  No scheduling info found`);
  }
  console.log('');
});

console.log('📝 Note: "Processing in background" means prospects are queued for immediate processing,');
console.log('    not scheduled for a future time. They should be contacted within minutes.');
