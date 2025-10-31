#!/usr/bin/env node
/**
 * URGENT: Pause Campaign - Bad Company Data
 * Pauses campaign 20251028-3AI-SEO search 3 to prevent sending more messages with wrong company names
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CAMPAIGN_ID = '51803ded-bbc9-4564-aefb-c6d11d69f17c'; // 20251028-3AI-SEO search 3

console.log('🚨 URGENT: Pausing campaign with bad company data\n');

async function pauseCampaign() {
  // Pause the campaign
  const { data, error } = await supabase
    .from('campaigns')
    .update({ status: 'paused' })
    .eq('id', CAMPAIGN_ID)
    .select()
    .single();

  if (error) {
    console.error('❌ Failed to pause campaign:', error.message);
    process.exit(1);
  }

  console.log(`✅ Campaign paused: ${data.name}`);
  console.log(`   Status: ${data.status}`);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⚠️  Campaign is now PAUSED');
  console.log('   No more messages will be sent until:');
  console.log('   1. Company names are fixed');
  console.log('   2. Messages are regenerated');
  console.log('   3. Campaign is manually reactivated');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

pauseCampaign().catch(console.error);
