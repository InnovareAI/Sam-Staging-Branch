import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

console.log('🔧 Applying LinkedIn Reconnection Migration via Supabase API...\n');

// Read the migration file
const migrationSQL = readFileSync('supabase/migrations/20251022_create_atomic_account_association.sql', 'utf8');

console.log('📄 Migration file loaded');
console.log(`   Length: ${migrationSQL.length} characters\n`);

// Use Supabase REST API to execute SQL (requires Management API)
const supabaseUrl = 'https://latxadqrvrrrcvkktrog.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

console.log('🚀 Attempting to execute SQL via REST API...\n');

try {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`
    },
    body: JSON.stringify({ sql: migrationSQL })
  });

  if (response.ok) {
    const result = await response.json();
    console.log('✅ Migration applied successfully!');
    console.log('   Result:', result);
  } else {
    const errorText = await response.text();
    console.error('❌ REST API execution failed:', response.status, response.statusText);
    console.error('   Response:', errorText);
    throw new Error('REST API execution failed');
  }
} catch (error) {
  console.error('❌ API method failed:', error.message);
  console.log('\n📋 ALTERNATIVE METHODS:\n');
  console.log('Method 1: Supabase Dashboard (RECOMMENDED)');
  console.log('  1. Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql/new');
  console.log('  2. Copy contents of: supabase/migrations/20251022_create_atomic_account_association.sql');
  console.log('  3. Paste and click "Run"\n');

  console.log('Method 2: Use database pooler connection string');
  console.log('  Check Supabase Dashboard → Settings → Database');
  console.log('  Look for "Pooler Connection String" with correct password\n');

  console.log('Method 3: Use Supabase CLI');
  console.log('  supabase link --project-ref latxadqrvrrrcvkktrog');
  console.log('  supabase db push\n');
}

console.log('✅ Script complete!');
