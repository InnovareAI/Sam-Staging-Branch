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

async function checkLatestSession() {
  // Get the most recent session
  const { data: sessions } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (!sessions || sessions.length === 0) {
    console.log('❌ No sessions found');
    return;
  }

  const session = sessions[0];
  console.log('\n📋 Latest Session Info:');
  console.log(`   Session ID: ${session.id}`);
  console.log(`   Campaign: ${session.campaign_name}`);
  console.log(`   Created: ${session.created_at}`);
  console.log(`   Total Prospects: ${session.total_prospects}`);
  console.log(`   Batch Number: ${session.batch_number}`);

  // Get sample prospects from this session
  const { data: prospects } = await supabase
    .from('prospect_approval_data')
    .select('name, title, company, contact, linkedin_url')
    .eq('session_id', session.id)
    .limit(3);

  console.log('\n🔍 Sample Prospects:');
  prospects?.forEach((p, i) => {
    console.log(`\n${i + 1}. ${p.name || 'NO NAME'}`);
    console.log(`   Title: ${p.title || 'NO TITLE'}`);
    console.log(`   Company: ${typeof p.company === 'object' ? p.company.name : p.company}`);
    console.log(`   LinkedIn URL column: ${p.linkedin_url || 'NULL'}`);

    if (p.contact) {
      const contact = typeof p.contact === 'string' ? JSON.parse(p.contact) : p.contact;
      console.log(`   Contact.email: ${contact.email || 'NULL'}`);
      console.log(`   Contact.linkedin_url: ${contact.linkedin_url || 'NULL'}`);
      console.log(`   Contact.phone: ${contact.phone || 'NULL'}`);
    }
  });

  // Check if ANY prospect has a LinkedIn URL
  const { count: withUrls } = await supabase
    .from('prospect_approval_data')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', session.id)
    .not('contact->linkedin_url', 'eq', '')
    .not('contact->linkedin_url', 'is', null);

  console.log(`\n📊 LinkedIn URL Status:`);
  console.log(`   Total prospects: ${session.total_prospects}`);
  console.log(`   With URLs in contact.linkedin_url: ${withUrls || 0}`);
  console.log(`   Missing URLs: ${session.total_prospects - (withUrls || 0)}`);
}

checkLatestSession();
