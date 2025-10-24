#!/usr/bin/env node
/**
 * Generate an admin impersonation link to log into a specific workspace
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const workspaceId = process.argv[2];

  if (!workspaceId) {
    // List workspaces
    const { data: workspaces, error } = await supabase
      .from('workspaces')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error:', error);
      process.exit(1);
    }

    console.log('\n📋 Recent Workspaces:\n');
    workspaces.forEach(w => {
      console.log(`${w.name || 'Unnamed'}`);
      console.log(`  ID: ${w.id}\n`);
    });
    console.log('Usage: node generate-workspace-login.js <workspace_id>\n');
    process.exit(0);
  }

  // Get workspace details and owner
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('id', workspaceId)
    .single();

  if (wsError || !workspace) {
    console.error('❌ Workspace not found:', workspaceId);
    process.exit(1);
  }

  // Get workspace owner/admin
  const { data: members, error: memError } = await supabase
    .from('workspace_members')
    .select('user_id, role, profiles(email)')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)
    .order('role', { ascending: true });

  if (memError || !members || members.length === 0) {
    console.error('❌ No active members found for this workspace');
    process.exit(1);
  }

  // Find owner or admin
  const owner = members.find(m => m.role === 'owner') || members.find(m => m.role === 'admin') || members[0];
  const userEmail = owner.profiles?.email;

  if (!userEmail) {
    console.error('❌ Could not find user email');
    process.exit(1);
  }

  console.log(`\n🔐 Workspace Login Details:\n`);
  console.log(`Workspace: ${workspace.name}`);
  console.log(`ID: ${workspace.id}`);
  console.log(`User: ${userEmail}`);
  console.log(`Role: ${owner.role}\n`);

  // Generate magic link (admin method)
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: userEmail,
  });

  if (linkError) {
    console.error('❌ Error generating magic link:', linkError);
    process.exit(1);
  }

  // Build the login URL with workspace redirect
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const magicLink = linkData.properties.action_link;
  
  console.log('🔗 Magic Link (expires in 1 hour):\n');
  console.log(magicLink);
  console.log('\n');
  console.log('📍 Direct workspace URL:\n');
  console.log(`${baseUrl}/dashboard?workspace=${workspaceId}`);
  console.log('\n');
}

main().catch(console.error);
