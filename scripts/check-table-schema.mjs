#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const workspaceId = 'dea5a7f2-673c-4429-972d-6ba5fca473fb';

console.log('\n📋 Fetching one document to see actual schema...\n');

const { data, error } = await supabase
  .from('knowledge_base_documents')
  .select('*')
  .eq('workspace_id', workspaceId)
  .limit(1)
  .single();

if (error) {
  console.error('Error:', error);
} else {
  console.log('✅ Table columns:');
  console.log(JSON.stringify(data, null, 2));
}
