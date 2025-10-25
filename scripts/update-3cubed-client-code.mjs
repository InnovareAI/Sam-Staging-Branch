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

async function updateClientCode() {
  console.log('🔧 Updating 3cubed client code from 3WC to 3AI...\n');

  // Find the 3cubed workspace
  const { data: workspace, error: findError } = await supabase
    .from('workspaces')
    .select('id, name, client_code')
    .eq('name', '3cubed Workspace')
    .single();

  if (findError || !workspace) {
    console.error('❌ Failed to find 3cubed workspace:', findError);
    return;
  }

  console.log('Found workspace:');
  console.log(`  ID: ${workspace.id}`);
  console.log(`  Name: ${workspace.name}`);
  console.log(`  Current client code: ${workspace.client_code}`);
  console.log('');

  // Update the client code
  const { data: updated, error: updateError } = await supabase
    .from('workspaces')
    .update({ client_code: '3AI' })
    .eq('id', workspace.id)
    .select()
    .single();

  if (updateError) {
    console.error('❌ Failed to update client code:', updateError);
    return;
  }

  console.log('✅ Successfully updated client code:');
  console.log(`  Old: ${workspace.client_code}`);
  console.log(`  New: ${updated.client_code}`);
}

updateClientCode().catch(console.error);
