#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🧪 TESTING ADMIN API LOGIC');
console.log('===========================\n');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function simulateAdminAPI() {
  console.log('🔍 Simulating admin workspaces API logic...');
  
  try {
    console.log('📋 Step 1: Fetch workspaces...');
    const { data: workspaces, error: workspacesError } = await supabase
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (workspacesError) {
      console.log('❌ Workspaces error:', workspacesError.message);
      return;
    }
    
    console.log(`✅ Found ${workspaces.length} workspaces`);
    
    console.log('📋 Step 2: Fetch workspace members...');
    const { data: allMembers, error: membersError } = await supabase
      .from('workspace_members')
      .select('*');
      
    if (membersError) {
      console.log('❌ Members error:', membersError.message);
      return;
    }
    
    console.log(`✅ Found ${allMembers.length} workspace members`);
    
    console.log('📋 Step 3: Combine data...');
    const enrichedWorkspaces = workspaces.map(workspace => ({
      ...workspace,
      workspace_members: allMembers.filter(member => member.workspace_id === workspace.id),
      member_count: allMembers.filter(member => member.workspace_id === workspace.id).length
    }));
    
    console.log('\n🎯 FINAL RESULT:');
    console.log('================');
    
    const result = {
      workspaces: enrichedWorkspaces,
      total: enrichedWorkspaces.length
    };
    
    console.log(`Total workspaces: ${result.total}`);
    
    result.workspaces.forEach(ws => {
      console.log(`\n📁 ${ws.name}`);
      console.log(`   • ID: ${ws.id}`);
      console.log(`   • Slug: ${ws.slug}`);
      console.log(`   • Owner: ${ws.owner_id}`);
      console.log(`   • Members: ${ws.member_count}`);
      console.log(`   • Created: ${new Date(ws.created_at).toLocaleDateString()}`);
    });
    
    console.log('\n📊 API RESPONSE PREVIEW:');
    console.log('========================');
    console.log(JSON.stringify(result, null, 2));
    
    return result;
    
  } catch (error) {
    console.log('❌ Error:', error.message);
    return null;
  }
}

async function main() {
  const result = await simulateAdminAPI();
  
  if (result && result.total > 0) {
    console.log('\n✅ SUCCESS: Admin API logic works correctly');
    console.log('🎯 The Super Admin panel should display this data');
    console.log('\n💡 If the panel still shows "No workspaces", the issue is:');
    console.log('   • Frontend not calling the correct API endpoint');
    console.log('   • Authentication issues with the API');
    console.log('   • Browser caching old responses');
  } else {
    console.log('\n❌ FAILURE: Admin API logic has issues');
  }
}

main().catch(console.error);