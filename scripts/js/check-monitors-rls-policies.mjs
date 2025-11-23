#!/usr/bin/env node
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

// Create both service role and anon clients
const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

console.log('🔍 Checking linkedin_post_monitors RLS policies...\n');

// Check with service role (bypasses RLS)
console.log('1. Service Role Query (bypasses RLS):');
const { data: serviceData, error: serviceError } = await supabaseService
  .from('linkedin_post_monitors')
  .select('*');

if (serviceError) {
  console.error('❌ Service role error:', serviceError);
} else {
  console.log(`✅ Found ${serviceData.length} monitors with service role\n`);
}

// Check with anon key (uses RLS)
console.log('2. Anon Key Query (uses RLS):');
const { data: anonData, error: anonError } = await supabaseAnon
  .from('linkedin_post_monitors')
  .select('*');

if (anonError) {
  console.error('❌ Anon key error:', anonError);
} else {
  console.log(`✅ Found ${anonData.length} monitors with anon key\n`);
}

// Check RLS policies
console.log('3. Checking RLS policies on linkedin_post_monitors:');
const { data: policies, error: policiesError } = await supabaseService
  .from('pg_policies')
  .select('*')
  .eq('tablename', 'linkedin_post_monitors');

if (policiesError) {
  console.error('❌ Error fetching policies:', policiesError);
} else if (!policies || policies.length === 0) {
  console.log('⚠️  No RLS policies found on linkedin_post_monitors table');
  console.log('   This means the table is completely inaccessible via anon key!');
} else {
  console.log(`Found ${policies.length} policies:\n`);
  policies.forEach((p, idx) => {
    console.log(`Policy ${idx + 1}:`);
    console.log(`  Name: ${p.policyname}`);
    console.log(`  Command: ${p.cmd}`);
    console.log(`  Roles: ${p.roles}`);
    console.log(`  Using: ${p.qual}`);
    console.log(`  With Check: ${p.with_check}\n`);
  });
}
