import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔄 Running migration via Supabase REST API...\n');

const sql = readFileSync('supabase/migrations/20251112_fix_campaign_metrics_n8n.sql', 'utf-8');

// Use Supabase SQL function to execute
const { data, error } = await supabase.rpc('exec_sql', { query: sql });

if (error) {
  console.error('❌ Migration failed:', error);
  
  // Try direct query approach
  console.log('\n🔄 Trying direct approach...');
  
  const { error: dropError } = await supabase.rpc('exec_sql', {
    query: 'DROP VIEW IF EXISTS campaign_performance_summary CASCADE;'
  });
  
  console.log(dropError ? '⚠️  Drop error (may not exist)' : '✅ View dropped');
  
  process.exit(1);
}

console.log('✅ Migration successful!\n');

// Test view
console.log('🧪 Testing view with BLL-CISO campaign...');

const { data: campaigns, error: queryError } = await supabase
  .from('campaign_performance_summary')
  .select('*')
  .ilike('campaign_name', '%BLL-CISO%');

if (queryError) {
  console.error('❌ Query failed:', queryError);
} else {
  console.log('\n✅ View working! Results:');
  console.table(campaigns);
}
