#!/usr/bin/env node
/**
 * Quick reset - run this RIGHT BEFORE executing campaign in UI
 */
import 'dotenv/config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const campaignId = '9fb680d9-ddd2-4e86-87ff-db1ce75b908e';

console.log('⚡ QUICK RESET - Run campaign execution NOW!\n');

const res = await fetch(`${SUPABASE_URL}/rest/v1/campaign_prospects?campaign_id=eq.${campaignId}`, {
  method: 'PATCH',
  headers: {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    status: 'pending'
  })
});

if (res.ok) {
  console.log('✅ All prospects set to PENDING');
  console.log('');
  console.log('🚀 GO TO UI AND EXECUTE CAMPAIGN NOW!');
  console.log('   (within next 10 seconds)');
  console.log('');
} else {
  console.log('❌ Failed');
}
