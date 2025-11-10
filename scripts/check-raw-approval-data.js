#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SESSION_ID = 'c4a1adf4-ffc3-493b-b7d9-f549318236b5';

async function checkRawApprovalData() {
  // Check if ANY data exists for this session
  const { count } = await supabase
    .from('prospect_approval_data')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', SESSION_ID);

  console.log(`\n📊 Total records in prospect_approval_data for session: ${count || 0}\n`);

  if (count > 0) {
    // Get sample records with ALL columns
    const { data: prospects } = await supabase
      .from('prospect_approval_data')
      .select('*')
      .eq('session_id', SESSION_ID)
      .limit(2);

    console.log('🔍 Sample records:\n');
    prospects?.forEach((p, i) => {
      console.log(`Record ${i + 1}:`);
      console.log(JSON.stringify(p, null, 2));
      console.log('\n---\n');
    });
  } else {
    console.log('❌ No data found in prospect_approval_data table for this session.');
    console.log('   The data may have been deleted after transfer.\n');

    // Check if we can find it by looking at personalization_data in campaign_prospects
    console.log('💡 Checking if original data is referenced in personalization_data...\n');

    const { data: campaignProspect } = await supabase
      .from('campaign_prospects')
      .select('personalization_data')
      .eq('campaign_id', '3c984824-5561-4ba5-8b08-f34af2a00e27')
      .limit(1)
      .single();

    if (campaignProspect?.personalization_data?.approval_data_id) {
      const approvalDataId = campaignProspect.personalization_data.approval_data_id;
      console.log(`   Found reference to approval_data_id: ${approvalDataId}`);

      // Try to fetch that specific record
      const { data: originalData } = await supabase
        .from('prospect_approval_data')
        .select('*')
        .eq('id', approvalDataId)
        .single();

      if (originalData) {
        console.log('   ✅ Found original approval data:\n');
        console.log(JSON.stringify(originalData, null, 2));
      } else {
        console.log('   ❌ Original approval data has been deleted.');
      }
    }
  }
}

checkRawApprovalData();
