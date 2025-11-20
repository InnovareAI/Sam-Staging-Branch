#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('\n🔍 All workspaces:\n');

const { data: all } = await supabase
  .from('workspaces')
  .select('id, name, slug')
  .order('name');

all.forEach(w => {
  console.log(`  ${w.name} (${w.slug}): ${w.id}`);
});
