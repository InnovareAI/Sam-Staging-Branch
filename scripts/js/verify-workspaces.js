#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 VERIFYING WORKSPACE DATA');
console.log('===========================\n');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkWorkspaces() {
  console.log('📋 Checking workspaces in database...');
  
  const { data: workspaces, error } = await supabase
    .from('workspaces')
    .select(`
      *,
      workspace_members(
        id,
        user_id,
        role,
        users(email, first_name)
      )
    `)
    .order('name');
    
  if (error) {
    console.log('❌ Error fetching workspaces:', error.message);
    return;
  }
  
  console.log(`✅ Found ${workspaces.length} workspaces in database:`);
  
  workspaces.forEach(workspace => {
    console.log(`\n📁 ${workspace.name}`);
    console.log(`   • ID: ${workspace.id}`);
    console.log(`   • Slug: ${workspace.slug}`);
    console.log(`   • Owner: ${workspace.owner_id}`);
    console.log(`   • Organization: ${workspace.organization_id}`);
    console.log(`   • Members: ${workspace.workspace_members?.length || 0}`);
    
    if (workspace.workspace_members && workspace.workspace_members.length > 0) {
      workspace.workspace_members.forEach(member => {
        console.log(`     - ${member.users?.email || 'Unknown'} (${member.role})`);
      });
    }
  });
  
  return workspaces;
}

async function testAPICompatibility(workspaces) {
  console.log('\n🔧 Testing API compatibility...');
  
  // Test the same query structure as the admin API
  const { data: apiTest, error: apiError } = await supabase
    .from('workspaces')
    .select(`
      id,
      name,
      slug,
      owner_id,
      created_at,
      updated_at,
      settings,
      workspace_members (
        id,
        user_id,
        role,
        joined_at
      )
    `)
    .order('created_at', { ascending: false });
    
  if (apiError) {
    console.log('❌ API query failed:', apiError.message);
    return false;
  }
  
  console.log(`✅ API query successful - returned ${apiTest.length} workspaces`);
  return true;
}

async function main() {
  const workspaces = await checkWorkspaces();
  
  if (!workspaces || workspaces.length === 0) {
    console.log('\n❌ NO WORKSPACES FOUND');
    console.log('This explains why the Super Admin panel shows no workspaces.');
    console.log('The workspace restoration may not have worked properly.');
    return;
  }
  
  const apiWorking = await testAPICompatibility(workspaces);
  
  console.log('\n📊 DIAGNOSIS');
  console.log('=============');
  
  if (workspaces.length > 0 && apiWorking) {
    console.log('✅ Workspaces exist in database');
    console.log('✅ API query structure works');
    console.log('\n💡 ISSUE: The Super Admin panel may be:');
    console.log('1. Using a different API endpoint');
    console.log('2. Having authentication issues');
    console.log('3. Caching old data');
    console.log('4. Using incorrect query parameters');
  } else {
    console.log('❌ There are issues with workspace data or API structure');
  }
  
  console.log('\n🎯 NEXT STEPS:');
  console.log('• Check admin API endpoint implementation');
  console.log('• Verify frontend workspace loading logic');
  console.log('• Clear browser cache and refresh');
}

main().catch(console.error);