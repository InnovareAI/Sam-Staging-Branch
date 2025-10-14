import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  console.log('🔍 Checking prospect_approval_sessions schema...\n');

  // Get a sample record to see all columns
  const { data, error } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .limit(1)
    .single();

  if (error) {
    console.log('❌ Error:', error.message);
    return;
  }

  if (data) {
    console.log('✅ Available columns:');
    Object.keys(data).forEach(key => {
      console.log(`   - ${key}: ${typeof data[key]} = ${data[key]}`);
    });
  } else {
    console.log('❌ No data found');
  }
}

checkSchema();
