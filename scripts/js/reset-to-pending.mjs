#!/usr/bin/env node
import 'dotenv/config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const campaignId = '5067bfd4-e4c6-4082-a242-04323c8860c8';

console.log('🔄 Resetting all prospects to pending status\n');

const res = await fetch(`${SUPABASE_URL}/rest/v1/campaign_prospects?campaign_id=eq.${campaignId}`, {
  method: 'PATCH',
  headers: {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body: JSON.stringify({
    status: 'pending',
    contacted_at: null
  })
});

if (res.ok) {
  const updated = await res.json();
  console.log(`✅ Reset ${updated.length} prospects to status='pending'\n`);
  console.log('━'.repeat(60));
  console.log('✅ READY TO EXECUTE!');
  console.log('━'.repeat(60));
  console.log('\nCampaign: 20251101-IAI-Outreach Campaign');
  console.log(`Prospects: ${updated.length} (all status=pending)`);
  console.log('\nGo to UI and execute the campaign now!');
} else {
  console.error('❌ Failed to reset:', await res.text());
}
