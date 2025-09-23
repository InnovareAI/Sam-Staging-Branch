/**
 * CREATE CHILLMINE WORKSPACE
 * =========================
 * Create a new workspace for ChillMine organization
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createChillMineWorkspace() {
  console.log('🏢 Creating ChillMine workspace...');
  
  try {
    // Check if ChillMine workspace already exists
    const { data: existingWorkspaces } = await supabase
      .from('workspaces')
      .select('*')
      .ilike('name', '%chillmine%');

    if (existingWorkspaces && existingWorkspaces.length > 0) {
      console.log('⚠️ ChillMine workspace already exists:');
      existingWorkspaces.forEach(ws => {
        console.log(`  - ${ws.name} (${ws.id})`);
      });
      return;
    }

    // Get tl@innovareai.com as owner
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const tlUser = authUsers.users.find(u => u.email === 'tl@innovareai.com');
    
    if (!tlUser) {
      console.log('❌ Could not find tl@innovareai.com to set as owner');
      return;
    }

    // Create ChillMine workspace
    const { data: newWorkspace, error: workspaceError } = await supabase
      .from('workspaces')
      .insert({
        name: 'ChillMine Workspace',
        slug: 'chillmine-workspace',
        owner_id: tlUser.id,
        created_at: '2025-09-01T00:00:00.000Z', // Match other workspaces
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (workspaceError) {
      console.log('❌ Failed to create ChillMine workspace:', workspaceError.message);
      return;
    }

    console.log(`✅ Created ChillMine workspace: ${newWorkspace.id}`);

    // Show all workspaces now
    console.log('\n📋 All workspaces:');
    const { data: allWorkspaces } = await supabase
      .from('workspaces')
      .select('*')
      .order('name');

    allWorkspaces?.forEach(workspace => {
      console.log(`  - ${workspace.name} (${workspace.id}) - Created: ${workspace.created_at}`);
    });

    console.log('\n✅ ChillMine workspace created successfully!');
    console.log('\n🔧 Next steps:');
    console.log('1. Add users to the ChillMine workspace');
    console.log('2. Set appropriate roles (owner, admin, user)');
    console.log('3. Configure workspace settings if needed');

  } catch (error) {
    console.error('❌ Create ChillMine workspace failed:', error);
  }
}

createChillMineWorkspace();