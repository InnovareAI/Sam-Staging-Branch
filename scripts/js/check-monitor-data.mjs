#!/usr/bin/env node
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

console.log('🔍 Checking monitor data...\n');

const { data: monitors, error } = await supabase
  .from('linkedin_post_monitors')
  .select('*')
  .eq('workspace_id', workspaceId);

if (error) {
  console.error('❌ Error:', error);
} else {
  console.log(`Found ${monitors.length} monitors:\n`);
  monitors.forEach((m, idx) => {
    console.log(`Monitor ${idx + 1}:`);
    console.log(JSON.stringify(m, null, 2));
    console.log('');
  });
}
