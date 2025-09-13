#!/usr/bin/env node

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Debug script to check current workspaces/organizations in the database
import { supabaseAdmin } from './app/lib/supabase.ts';

async function debugWorkspaces() {
  console.log('🔍 Debugging workspace IDs in database...');
  
  try {
    const supabase = supabaseAdmin();
    
    // Get all organizations
    const { data: organizations, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: true });

    if (orgError) {
      console.error('❌ Error fetching organizations:', orgError);
      return;
    }

    console.log('\n📋 Current Organizations:');
    console.log('='.repeat(80));
    
    if (!organizations || organizations.length === 0) {
      console.log('⚠️  No organizations found in database!');
    } else {
      organizations.forEach((org, index) => {
        console.log(`${index + 1}. ${org.name}`);
        console.log(`   ID: ${org.id}`);
        console.log(`   Slug: ${org.slug || 'N/A'}`);
        console.log(`   Created: ${new Date(org.created_at).toLocaleString()}`);
        console.log('   ' + '-'.repeat(50));
      });
    }

    // Check for any workspace_users entries
    const { data: workspaceUsers, error: usersError } = await supabase
      .from('workspace_users')
      .select('workspace_id, user_id, role')
      .limit(10);

    if (usersError) {
      console.log('⚠️  Could not check workspace_users:', usersError.message);
    } else {
      console.log('\n👥 Sample Workspace User Mappings:');
      console.log('='.repeat(80));
      
      if (!workspaceUsers || workspaceUsers.length === 0) {
        console.log('⚠️  No workspace_users entries found!');
      } else {
        workspaceUsers.forEach((entry, index) => {
          console.log(`${index + 1}. Workspace: ${entry.workspace_id}, User: ${entry.user_id}, Role: ${entry.role}`);
        });
      }
    }

    // Specific check for the problematic UUID
    const problematicId = '550e8400-e29b-41d4-a716-446655440000';
    const { data: problemCheck, error: problemError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', problematicId);

    console.log('\n🔍 Checking for problematic UUID:', problematicId);
    console.log('='.repeat(80));
    
    if (problemError) {
      console.log('❌ Error checking problematic ID:', problemError.message);
    } else if (!problemCheck || problemCheck.length === 0) {
      console.log('✅ Problematic UUID does NOT exist in database (good!)');
    } else {
      console.log('⚠️  Problematic UUID FOUND in database:', problemCheck);
    }

  } catch (error) {
    console.error('💥 Script error:', error);
  }
}

debugWorkspaces();