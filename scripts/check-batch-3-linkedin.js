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

async function checkBatch3LinkedIn() {
  // Get batch 3 session
  const { data: session } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .eq('batch_number', 3)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!session) {
    console.log('❌ No batch 3 found');
    return;
  }

  console.log(`\n📋 Batch 3 Session: ${session.id}`);
  console.log(`   Campaign: ${session.campaign_name}`);
  console.log(`   Total: ${session.total_prospects}`);

  // Get first 3 prospects to see their full data
  const { data: prospects } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('session_id', session.id)
    .limit(3);

  console.log('\n🔍 Sample Prospect Data:\n');
  prospects?.forEach((p, i) => {
    console.log(`${i + 1}. ${p.name}`);
    console.log(`   Title: ${p.title}`);
    console.log(`   Company:`, typeof p.company === 'object' ? p.company : { name: p.company });
    console.log(`   Contact object:`, p.contact);
    console.log(`   LinkedIn URL (direct):`, p.linkedin_url || 'NULL');
    console.log('');
  });

  // Check if ANY have LinkedIn URLs
  const { count: withUrls } = await supabase
    .from('prospect_approval_data')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', session.id)
    .not('contact->linkedin_url', 'eq', '')
    .not('contact->linkedin_url', 'is', null);

  console.log(`📊 Total with LinkedIn URLs: ${withUrls || 0} of ${session.total_prospects}`);
}

checkBatch3LinkedIn();
