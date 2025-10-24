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

const workspaceId = 'dea5a7f2-673c-4429-972d-6ba5fca473fb';

const { data: docs } = await supabase
  .from('knowledge_base_documents')
  .select('section_id, filename')
  .eq('workspace_id', workspaceId)
  .limit(100);

const sections = {};
docs?.forEach(d => {
  const s = d.section_id || 'null';
  if (!sections[s]) sections[s] = 0;
  sections[s]++;
});

console.log('\nActual section_id values in knowledge_base_documents:');
Object.entries(sections).sort((a,b) => b[1] - a[1]).forEach(([s, count]) => {
  console.log(`  "${s}": ${count} docs`);
});
