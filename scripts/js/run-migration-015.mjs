#!/usr/bin/env node
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔧 Running migration 015: Remove hashtags unique constraint\n');

const sql = readFileSync('sql/migrations/015-remove-hashtags-unique-constraint.sql', 'utf8');

console.log('SQL to execute:');
console.log('─'.repeat(60));
console.log(sql);
console.log('─'.repeat(60));
console.log('\nPlease run this SQL in Supabase SQL Editor:\n');
console.log('1. Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql/new');
console.log('2. Paste the SQL above');
console.log('3. Click "Run"\n');
