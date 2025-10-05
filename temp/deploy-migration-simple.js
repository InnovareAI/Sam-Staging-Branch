const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://latxadqrvrrrcvkktrog.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const supabase = createClient(supabaseUrl, serviceKey);

const sql = fs.readFileSync('supabase/migrations/20251002000000_create_prospect_approval_system.sql', 'utf8');

console.log('🚀 Deploying migration...');
console.log(`📄 SQL length: ${sql.length} chars`);

// Just try to create one table directly to test
supabase.rpc('exec', { sql }).then(result => {
  console.log('✅ Success:', result);
}).catch(err => {
  console.error('❌ Error:', err);
});
