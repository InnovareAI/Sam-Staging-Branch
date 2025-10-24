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

const workspaceId = process.argv[2] || 'dea5a7f2-673c-4429-972d-6ba5fca473fb';

const { data } = await supabase
  .from('knowledge_base_documents')
  .select('section_id, filename')
  .eq('workspace_id', workspaceId);

const sections = {};
data.forEach(d => {
  const s = d.section_id || 'null';
  if (!sections[s]) sections[s] = [];
  sections[s].push(d.filename);
});

console.log(`\n📁 Sections in knowledge_base_documents (${data.length} total):\n`);
Object.entries(sections).sort().forEach(([s, files]) => {
  console.log(`${s}: ${files.length} files`);
  files.slice(0, 3).forEach(f => console.log(`  - ${f}`));
  if (files.length > 3) console.log(`  ... and ${files.length - 3} more`);
  console.log('');
});
