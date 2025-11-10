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

async function checkApprovalData() {
  const { data: prospects } = await supabase
    .from('prospect_approval_data')
    .select('name, contact, linkedin_url')
    .eq('session_id', SESSION_ID)
    .limit(5);

  console.log('\n🔍 Sample data from prospect_approval_data:\n');

  prospects?.forEach((p, i) => {
    console.log(`${i + 1}. Name: ${p.name || 'NULL'}`);
    console.log(`   LinkedIn URL column: ${p.linkedin_url || 'NULL'}`);

    if (p.contact) {
      const contact = typeof p.contact === 'string' ? JSON.parse(p.contact) : p.contact;
      console.log(`   Contact data:`, JSON.stringify(contact, null, 2));
    }
    console.log('');
  });
}

checkApprovalData();
