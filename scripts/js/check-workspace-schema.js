#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 CHECKING WORKSPACE TABLE SCHEMA');
console.log('=================================\n');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTableStructure(tableName) {
  console.log(`📋 Checking ${tableName} table structure...`);
  
  try {
    // Try to select with limit 0 to see table structure
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(0);
      
    if (error) {
      console.log(`❌ Error accessing ${tableName}:`, error.message);
      return false;
    }
    
    console.log(`✅ ${tableName} table exists and is accessible`);
    return true;
    
  } catch (err) {
    console.log(`❌ Exception checking ${tableName}:`, err.message);
    return false;
  }
}

async function trySimpleWorkspaceInsert() {
  console.log('\n🧪 Testing simple workspace insert...');
  
  try {
    const { data, error } = await supabase
      .from('workspaces')
      .insert([{
        name: 'Test Workspace',
        slug: 'test-workspace',
        owner_id: '2197f460-2078-44b5-9bf8-bbfb2dd5d23c'
      }])
      .select()
      .single();
      
    if (error) {
      console.log('❌ Insert error:', error.message);
      console.log('❌ Error details:', error);
      return false;
    }
    
    console.log('✅ Simple insert successful:', data);
    
    // Clean up test record
    await supabase
      .from('workspaces')
      .delete()
      .eq('id', data.id);
      
    console.log('✅ Test record cleaned up');
    return true;
    
  } catch (err) {
    console.log('❌ Exception during insert:', err.message);
    return false;
  }
}

async function checkForeignKeys() {
  console.log('\n🔗 Checking foreign key relationships...');
  
  // Check if organizations table has the expected columns
  const { data: orgData, error: orgError } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .limit(1);
    
  if (orgError) {
    console.log('❌ Error checking organizations:', orgError.message);
  } else {
    console.log('✅ Organizations table structure confirmed');
    console.log('   Sample org:', orgData[0]);
  }
  
  // Check if users table has the expected columns
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, email')
    .limit(1);
    
  if (userError) {
    console.log('❌ Error checking users:', userError.message);
  } else {
    console.log('✅ Users table structure confirmed');
    console.log('   Sample user:', userData[0]);
  }
}

async function main() {
  // Check all critical tables
  await checkTableStructure('workspaces');
  await checkTableStructure('workspace_members');
  await checkTableStructure('organizations');
  await checkTableStructure('users');
  
  // Check foreign key relationships
  await checkForeignKeys();
  
  // Try a simple insert
  await trySimpleWorkspaceInsert();
  
  console.log('\n📊 SCHEMA CHECK COMPLETE');
  console.log('=========================');
}

main().catch(console.error);