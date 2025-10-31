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

console.log('🔍 Checking prospect_approval_data table\n');

const { data, error, count } = await supabase
  .from('prospect_approval_data')
  .select('id, contact, company, title, created_at', { count: 'exact' })
  .order('created_at', { ascending: false })
  .limit(5);

if (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}

console.log(`📊 Total rows in prospect_approval_data: ${count}\n`);

if (!data || data.length === 0) {
  console.log('⚠️  Table is empty!');
  process.exit(0);
}

console.log(`📋 Recent ${data.length} entries:\n`);

data.forEach((row, i) => {
  console.log(`${i + 1}. ID: ${row.id}`);
  console.log(`   Created: ${new Date(row.created_at).toLocaleString()}`);
  console.log(`   LinkedIn URL: ${row.contact?.linkedin_url || row.contact?.linkedInUrl || 'N/A'}`);
  console.log(`   Company: ${row.company?.name || row.contact?.company || 'N/A'}`);
  console.log(`   Title: ${row.title || row.contact?.title || 'N/A'}`);
  console.log(`   Contact keys: ${Object.keys(row.contact || {}).join(', ')}`);
  console.log('');
});
