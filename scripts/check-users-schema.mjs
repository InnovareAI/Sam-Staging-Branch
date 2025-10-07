#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  const { data: sample } = await supabase
    .from('users')
    .select('*')
    .limit(1)
    .single();

  console.log('📋 Users table columns:');
  console.log(Object.keys(sample || {}));
}

checkSchema().catch(console.error);
