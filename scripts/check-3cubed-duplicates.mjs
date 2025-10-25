#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const SUPABASE_URL = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const SERVICE_ROLE_KEY = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

console.log('\n⚠️  3CUBED WORKSPACE - DUPLICATE ACCOUNT ANALYSIS\n');
console.log('='.repeat(80) + '\n');

const { data: accounts, error } = await supabase
  .from('user_unipile_accounts')
  .select('*')
  .eq('workspace_id', 'ecb08e55-2b7e-4d49-8f50-d38e39ce2482')
  .order('created_at', { ascending: true });

if (error) {
  console.log('❌ Error:', error.message);
  process.exit(1);
}

console.log(`Total accounts: ${accounts.length}\n`);

accounts.forEach((acc, i) => {
  console.log(`${i + 1}. ${acc.account_name}`);
  console.log(`   ID: ${acc.unipile_account_id}`);
  console.log(`   Status: ${acc.connection_status}`);
  console.log(`   Created: ${new Date(acc.created_at).toLocaleString()}`);
  console.log(`   LinkedIn: ${acc.linkedin_public_identifier || 'N/A'}`);
  console.log('');
});

console.log('='.repeat(80));
console.log('\n🔍 ANALYSIS:\n');

// Check if these are actually different LinkedIn profiles or duplicates
const norikos = accounts.filter(a => a.account_name.includes('Noriko'));
const thorstens = accounts.filter(a => a.account_name.includes('Thorsten'));

if (norikos.length > 1) {
  console.log(`⚠️  Noriko has ${norikos.length} accounts:`);
  const uniqueLinkedInIds = new Set(norikos.map(n => n.linkedin_public_identifier).filter(Boolean));
  console.log(`   Unique LinkedIn profiles: ${uniqueLinkedInIds.size}`);
  console.log(`   LinkedIn IDs: ${Array.from(uniqueLinkedInIds).join(', ')}`);
  console.log('');
}

if (thorstens.length > 1) {
  console.log(`⚠️  Thorsten has ${thorstens.length} accounts:`);
  const uniqueLinkedInIds = new Set(thorstens.map(t => t.linkedin_public_identifier).filter(Boolean));
  console.log(`   Unique LinkedIn profiles: ${uniqueLinkedInIds.size}`);
  console.log(`   LinkedIn IDs: ${Array.from(uniqueLinkedInIds).join(', ')}`);
  console.log('');
}

console.log('💡 These likely represent multiple connection attempts.');
console.log('   Each time a user reconnects their LinkedIn, Unipile creates a new account_id.\n');
