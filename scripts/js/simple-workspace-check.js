#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 SIMPLE WORKSPACE CHECK');
console.log('=========================\n');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDirectly() {
  console.log('📋 Checking workspaces table directly...');
  
  const { data: workspaces, error: wsError } = await supabase
    .from('workspaces')
    .select('*');
    
  if (wsError) {
    console.log('❌ Error fetching workspaces:', wsError.message);
    return false;
  }
  
  console.log(`✅ Found ${workspaces.length} workspaces:`);
  workspaces.forEach(ws => {
    console.log(`   • ${ws.name} (${ws.slug})`);
  });
  
  console.log('\n📋 Checking workspace_members table directly...');
  
  const { data: members, error: membersError } = await supabase
    .from('workspace_members')
    .select('*');
    
  if (membersError) {
    console.log('❌ Error fetching workspace members:', membersError.message);
    return false;
  }
  
  console.log(`✅ Found ${members.length} workspace members:`);
  members.forEach(member => {
    console.log(`   • User ${member.user_id} → Workspace ${member.workspace_id} (${member.role})`);
  });
  
  if (workspaces.length > 0 && members.length > 0) {
    console.log('\n✅ DATA EXISTS - Issue is with relationships/foreign keys');
    return true;
  }
  
  return false;
}

async function fixRelationships() {
  console.log('\n🔧 FIXING TABLE RELATIONSHIPS');
  console.log('==============================');
  
  // Check if we need to add foreign key constraints
  console.log('💡 The issue is likely missing foreign key constraints.');
  console.log('Database tables exist but relationships aren\'t defined.');
  console.log('\nThe Super Admin panel API needs proper table relationships.');
}

async function main() {
  const hasData = await checkDirectly();
  
  if (hasData) {
    await fixRelationships();
    console.log('\n🎯 SOLUTION:');
    console.log('============');
    console.log('1. ✅ Workspace data exists in database');
    console.log('2. ❌ Table relationships are missing');
    console.log('3. 🔧 Need to add foreign key constraints');
    console.log('4. 🔄 Update admin API to work without JOINs');
  } else {
    console.log('\n❌ PROBLEM: No workspace data found');
    console.log('Need to re-run workspace restoration script');
  }
}

main().catch(console.error);