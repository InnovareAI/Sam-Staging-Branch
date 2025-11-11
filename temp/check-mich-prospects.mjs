#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CAMPAIGN_ID = '4cd9275f-b82d-47d6-a1d4-7207b992c4b7';

async function checkProspects() {
  console.log('🔍 Checking Mich\'s Campaign Prospects\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });

  const { data: prospects, error } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', CAMPAIGN_ID);

  if (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  console.log(`Found ${prospects.length} prospects\n`);

  const issues = [];

  prospects.forEach((p, i) => {
    console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
    console.log(`   ID: ${p.id}`);
    console.log(`   Status: ${p.status}`);
    console.log(`   LinkedIn URL: ${p.linkedin_url || '❌ MISSING'}`);
    console.log(`   Email: ${p.email || 'N/A'}`);
    console.log(`   Company: ${p.company_name || 'N/A'}`);

    if (!p.linkedin_url) {
      issues.push(`${p.first_name} ${p.last_name} - Missing LinkedIn URL`);
    }
    if (!p.first_name || !p.last_name) {
      issues.push(`${p.first_name} ${p.last_name} - Missing name`);
    }
    console.log('');
  });

  console.log('\n' + '─'.repeat(60));
  if (issues.length > 0) {
    console.log('\n⚠️  ISSUES FOUND:');
    issues.forEach(issue => console.log(`   - ${issue}`));
    console.log('\n❌ Campaign cannot execute - fix these issues first!\n');
  } else {
    console.log('\n✅ All prospects have required data');
    console.log('✅ Campaign ready to execute!\n');
  }
}

checkProspects().catch(console.error);
