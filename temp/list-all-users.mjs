#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

console.log('👥 All Users in System:\n');

const { data } = await supabase.auth.admin.listUsers();

data.users.forEach((u, i) => {
  console.log(`${i + 1}. ${u.email}`);
  console.log(`   ID: ${u.id}`);
  if (u.user_metadata?.full_name) {
    console.log(`   Name: ${u.user_metadata.full_name}`);
  }
  console.log('');
});

console.log(`Total users: ${data.users.length}\n`);
