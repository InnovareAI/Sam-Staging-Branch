#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 COMPREHENSIVE SUPABASE TABLE & SCHEMA CHECK');
console.log('==============================================\n');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listAllTables() {
  console.log('📋 Listing All Tables in Database...');
  
  try {
    // Get all tables from information_schema
    const { data: tables, error } = await supabase
      .rpc('exec', { 
        sql: `
          SELECT 
            table_name,
            table_type,
            table_schema
          FROM information_schema.tables 
          WHERE table_schema IN ('public', 'auth') 
          ORDER BY table_schema, table_name;
        `
      });
    
    if (error) {
      console.log('❌ Error getting tables:', error.message);
      
      // Try alternative method - directly query known tables
      console.log('\n🔄 Trying direct table access method...');
      
      const knownTables = [
        'users', 'workspaces', 'workspace_members', 'workspace_invitations',
        'sam_conversation_threads', 'sam_conversation_messages', 'knowledge_base',
        'campaigns', 'campaign_prospects', 'workspace_accounts', 'integrations',
        'linkedin_contacts', 'linkedin_discovery_jobs', 'bulk_upload_sessions'
      ];
      
      for (const tableName of knownTables) {
        try {
          const { data, error: tableError } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);
          
          if (tableError) {
            console.log(`❌ ${tableName}: ${tableError.message}`);
          } else {
            console.log(`✅ ${tableName}: Accessible (${data.length} sample records)`);
          }
        } catch (err) {
          console.log(`❌ ${tableName}: ${err.message}`);
        }
      }
    } else {
      console.log('✅ Tables found:');
      tables.forEach(table => {
        console.log(`   ${table.table_schema}.${table.table_name} (${table.table_type})`);
      });
    }

  } catch (err) {
    console.log('❌ Error listing tables:', err.message);
  }
}

async function checkTableStructures() {
  console.log('\n🏗️  Checking Key Table Structures...');
  
  const tablesToCheck = ['users', 'workspaces', 'workspace_members'];
  
  for (const tableName of tablesToCheck) {
    console.log(`\n📊 Table: ${tableName}`);
    try {
      // Get table structure by selecting with limit 0
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(0);
      
      if (error) {
        console.log(`❌ Cannot access ${tableName}:`, error.message);
      } else {
        console.log(`✅ ${tableName} table exists and is accessible`);
        
        // Try to get actual data
        const { data: sampleData, error: dataError } = await supabase
          .from(tableName)
          .select('*')
          .limit(3);
        
        if (dataError) {
          console.log(`   ⚠️  Data access limited:`, dataError.message);
        } else {
          console.log(`   📄 Sample records: ${sampleData.length}`);
          if (sampleData.length > 0) {
            console.log(`   🔑 Column names:`, Object.keys(sampleData[0]).join(', '));
          }
        }
      }
    } catch (err) {
      console.log(`❌ Error checking ${tableName}:`, err.message);
    }
  }
}

async function checkClerkColumns() {
  console.log('\n🚫 Checking for Clerk Columns...');
  
  const tablesToCheck = ['users', 'workspaces', 'organizations'];
  
  for (const tableName of tablesToCheck) {
    try {
      // Try to select clerk_id specifically
      const { data, error } = await supabase
        .from(tableName)
        .select('clerk_id')
        .limit(1);
      
      if (error) {
        if (error.message.includes('does not exist') || error.message.includes('column "clerk_id"')) {
          console.log(`✅ ${tableName}: clerk_id column removed`);
        } else {
          console.log(`❌ ${tableName}: Unexpected error - ${error.message}`);
        }
      } else {
        console.log(`⚠️  ${tableName}: clerk_id column still exists!`);
      }
    } catch (err) {
      console.log(`✅ ${tableName}: clerk_id column removed (${err.message})`);
    }
  }
}

async function checkRLSPolicies() {
  console.log('\n🛡️  Checking RLS Policies...');
  
  try {
    // Try to access policy information
    const { data: policies, error } = await supabase
      .rpc('exec', {
        sql: `
          SELECT 
            schemaname,
            tablename,
            policyname,
            permissive,
            roles,
            cmd,
            qual
          FROM pg_policies 
          WHERE schemaname = 'public'
          ORDER BY tablename, policyname;
        `
      });
    
    if (error) {
      console.log('❌ Cannot access policy info:', error.message);
    } else {
      console.log(`✅ Found ${policies.length} RLS policies`);
      
      // Group by table
      const policyByTable = {};
      policies.forEach(policy => {
        if (!policyByTable[policy.tablename]) {
          policyByTable[policy.tablename] = [];
        }
        policyByTable[policy.tablename].push(policy.policyname);
      });
      
      Object.keys(policyByTable).forEach(table => {
        console.log(`   ${table}: ${policyByTable[table].length} policies`);
      });
    }
  } catch (err) {
    console.log('⚠️  RLS policy check limited:', err.message);
  }
}

async function checkAuthUsers() {
  console.log('\n👥 Checking Auth Users...');
  
  try {
    // Check if we can access auth.users
    const { data: authUsers, error } = await supabase
      .from('auth.users')
      .select('id, email, created_at')
      .limit(5);
    
    if (error) {
      console.log('⚠️  Cannot access auth.users directly (normal with RLS):', error.message);
    } else {
      console.log(`✅ Auth users accessible: ${authUsers.length} records`);
      authUsers.forEach(user => {
        console.log(`   ${user.email} (ID: ${user.id.substring(0, 8)}...)`);
      });
    }
  } catch (err) {
    console.log('⚠️  Auth users check limited:', err.message);
  }
}

async function main() {
  await listAllTables();
  await checkTableStructures();
  await checkClerkColumns();
  await checkRLSPolicies();
  await checkAuthUsers();
  
  console.log('\n🎯 TABLE CHECK SUMMARY');
  console.log('======================');
  console.log('This report shows the current state of the Supabase database.');
  console.log('Use this information to verify schema and identify any remaining issues.');
}

main().catch(console.error);