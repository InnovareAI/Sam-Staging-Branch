#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verify() {
  const userId = '2197f460-2078-44b5-9bf8-bbfb2dd5d23c';

  // Check with service role
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId);

  console.log('Query result:');
  console.log('Data:', data);
  console.log('Error:', error);
  console.log('Count:', data?.length);
}

verify().catch(console.error);
