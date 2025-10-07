#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  const { data: sample } = await supabase
    .from('workspace_accounts')
    .select('*')
    .limit(1)
    .single();

  console.log('📋 workspace_accounts columns:');
  console.log(Object.keys(sample || {}));
  
  // Check if account already exists
  const { data: existing } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('unipile_account_id', 'nefy7jYjS5K6X3U7ORxHNQ');

  console.log('\n🔍 Existing entries for this Unipile account:');
  console.log(existing);
}

checkSchema().catch(console.error);
