#!/usr/bin/env node

/**
 * Create admin service accounts for InnovareAI workspaces
 * Creates admin1, admin2, admin5, admin6 and assigns them to IA1, IA2, IA5, IA6
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env.local') });

// Workspace IDs
const WORKSPACES = {
  IA1: 'babdcab8-1a78-4b2f-913e-6e9fd9821009',
  IA2: '04666209-fce8-4d71-8eaf-01278edfc73b',
  IA5: 'cd57981a-e63b-401c-bde1-ac71752c2293',
  IA6: '2a8f7c3d-9b1e-4f6a-8c2d-5e9a1b4f7d3c'
};

// Admin accounts to create
const ADMIN_ACCOUNTS = [
  { email: 'admin1@innovareai.com', password: 'Admin1InnovareAI2025!', workspace: 'IA1' },
  { email: 'admin2@innovareai.com', password: 'Admin2InnovareAI2025!', workspace: 'IA2' },
  { email: 'admin5@innovareai.com', password: 'Admin5InnovareAI2025!', workspace: 'IA5' },
  { email: 'admin6@innovareai.com', password: 'Admin6InnovareAI2025!', workspace: 'IA6' }
];

async function createAdminAccounts() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing SUPABASE credentials in environment');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  console.log('🚀 Creating admin service accounts...\n');

  for (const account of ADMIN_ACCOUNTS) {
    console.log(`Creating ${account.email} for ${account.workspace}...`);

    try {
      // Create user via Supabase Auth Admin API
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true,
        user_metadata: {
          role: 'admin',
          workspace: account.workspace
        }
      });

      if (authError) {
        console.error(`  ❌ Auth error: ${authError.message}`);
        continue;
      }

      const userId = authData.user.id;
      console.log(`  ✅ Auth user created: ${userId}`);

      // Update users table with current_workspace_id
      const { error: updateError } = await supabase
        .from('users')
        .update({ current_workspace_id: WORKSPACES[account.workspace] })
        .eq('id', userId);

      if (updateError) {
        console.error(`  ⚠️ Failed to update current_workspace_id: ${updateError.message}`);
      } else {
        console.log(`  ✅ Set current_workspace_id to ${account.workspace}`);
      }

      // Add to workspace_members
      const { error: memberError } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: WORKSPACES[account.workspace],
          user_id: userId,
          role: 'admin',
          status: 'active'
        });

      if (memberError) {
        console.error(`  ❌ Failed to add to workspace_members: ${memberError.message}`);
      } else {
        console.log(`  ✅ Added to ${account.workspace} workspace_members as admin`);
      }

      console.log('');

    } catch (error) {
      console.error(`  ❌ Unexpected error: ${error.message}`);
      console.log('');
    }
  }

  console.log('✅ Admin account creation complete!\n');

  // Verify results
  console.log('📋 Verifying workspace memberships...\n');

  for (const ws of Object.keys(WORKSPACES)) {
    const { data: members } = await supabase
      .from('workspace_members')
      .select('user_id, users(email), role')
      .eq('workspace_id', WORKSPACES[ws])
      .order('role', { ascending: false });

    console.log(`${ws}:`);
    members?.forEach(m => {
      console.log(`  - ${m.users.email} (${m.role})`);
    });
    console.log('');
  }
}

createAdminAccounts().catch(console.error);
