#!/usr/bin/env node
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Finding IA1 workspace...\n');

const { data: workspaces, error } = await supabase
  .from('workspaces')
  .select('id, name')
  .ilike('name', '%IA1%');

if (error) {
  console.error('❌ Error:', error);
} else {
  console.log(`Found ${workspaces.length} workspaces:`);
  workspaces.forEach(w => {
    console.log(`  - ${w.name} (${w.id}) - Company: ${w.company || 'N/A'}`);
  });
}
