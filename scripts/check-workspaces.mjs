import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkWorkspaces() {
  console.log('🔍 Checking workspaces...\n');

  const { data: workspaces, error } = await supabase
    .from('workspaces')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!workspaces || workspaces.length === 0) {
    console.log('⚠️  No workspaces found');
    return;
  }

  console.log('Workspace schema:', Object.keys(workspaces[0]));
  console.log('');

  console.log(`✅ Found ${workspaces.length} workspaces:\n`);

  workspaces.forEach((w, i) => {
    console.log(`Workspace ${i + 1}:`);
    console.log(`  ID: ${w.id}`);
    console.log(`  Name: ${w.name}`);
    console.log(`  Client Code: ${w.client_code || 'NOT SET'}`);
    console.log(`  Created: ${w.created_at}`);
    console.log('');
  });
}

checkWorkspaces().catch(console.error);
