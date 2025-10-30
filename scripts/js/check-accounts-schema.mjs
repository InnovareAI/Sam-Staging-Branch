#!/usr/bin/env node
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

async function checkSchema() {
  const { data: accounts } = await supabase
    .from('workspace_accounts')
    .select('*')
    .limit(1);

  if (accounts && accounts.length > 0) {
    console.log('workspace_accounts columns:');
    console.log(Object.keys(accounts[0]).sort());
    console.log('\nSample record:');
    console.log(JSON.stringify(accounts[0], null, 2));
  }
}

checkSchema();
