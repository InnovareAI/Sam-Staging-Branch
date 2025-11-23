#!/usr/bin/env node
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const userId = 'f6885ff3-deef-4781-8721-93011c990b1b';

console.log('🔍 Checking workspace_members for user...\n');

const { data, error } = await supabase
  .from('workspace_members')
  .select('*')
  .eq('user_id', userId);

if (error) {
  console.error('❌ Error:', error);
} else {
  console.log(`Found ${data.length} memberships:\n`);
  data.forEach((m, idx) => {
    console.log(`${idx + 1}. Workspace ID: ${m.workspace_id}`);
    console.log(`   Role: ${m.role}\n`);
  });
}
