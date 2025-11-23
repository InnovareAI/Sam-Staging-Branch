#!/usr/bin/env node
import { readFileSync } from 'fs';

const sql = readFileSync('sql/migrations/016-add-linkedin-monitors-rls-policies.sql', 'utf8');

console.log('🔧 Running migration 016: Add RLS policies to linkedin_post_monitors\n');
console.log('SQL to execute:');
console.log('─'.repeat(60));
console.log(sql);
console.log('─'.repeat(60));
console.log('\nPlease run this SQL in Supabase SQL Editor:\n');
console.log('1. Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql/new');
console.log('2. Paste the SQL above');
console.log('3. Click "Run"\n');
