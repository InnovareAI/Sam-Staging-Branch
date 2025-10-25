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

console.log('\n🔍 CHECKING ALL PROSPECT APPROVAL DATA\n');
console.log('='.repeat(80) + '\n');

// Get ALL prospect approval data
const { data: allProspects, error } = await supabase
  .from('prospect_approval_data')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(50);

if (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

console.log(`Total records: ${allProspects.length}\n`);

// Group by approval status
const byStatus = allProspects.reduce((acc, p) => {
  const status = p.approval_status || 'unknown';
  acc[status] = (acc[status] || 0) + 1;
  return acc;
}, {});

console.log('By Status:');
Object.entries(byStatus).forEach(([status, count]) => {
  console.log(`  ${status}: ${count}`);
});

console.log('\n');
console.log('Recent prospects:');
console.log('─'.repeat(80));

allProspects.slice(0, 10).forEach(p => {
  console.log(`\nName: ${p.name || 'N/A'}`);
  console.log(`Status: ${p.approval_status}`);
  console.log(`Session ID: ${p.session_id}`);
  console.log(`LinkedIn URL: ${p.linkedin_url || p.contact?.linkedin_url || 'N/A'}`);
  console.log(`Contact data: ${JSON.stringify(p.contact || {})}`);
});

console.log('\n');
