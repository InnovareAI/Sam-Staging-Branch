#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔧 EXECUTING CLERK_ID COLUMN DROP');
console.log('=================================\n');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function dropClerkColumn() {
  console.log('🗑️  Dropping clerk_id column from users table...');
  
  try {
    // Since we can't use rpc('exec'), we'll need to be creative
    // Let's first check current columns
    const { data: beforeColumns, error: beforeError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'users')
      .eq('table_schema', 'public');
    
    if (beforeError) {
      console.log('⚠️  Cannot access schema info directly');
    } else {
      console.log('📋 Current users table columns:');
      beforeColumns.forEach(col => {
        console.log(`   ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
      });
    }
    
    // Manual approach: We need to ask you to run this in Supabase dashboard
    console.log('\n📝 MANUAL ACTION REQUIRED:');
    console.log('Since we cannot execute DDL via the REST API, please:');
    console.log('1. Open Supabase Dashboard: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog');
    console.log('2. Go to SQL Editor');
    console.log('3. Execute this command:');
    console.log('   ALTER TABLE users DROP COLUMN IF EXISTS clerk_id CASCADE;');
    console.log('4. Run the verification script to confirm');
    
  } catch (err) {
    console.log('❌ Error:', err.message);
  }
}

async function verifyDrop() {
  console.log('\n🔍 Verifying clerk_id column status...');
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('clerk_id')
      .limit(1);
    
    if (error && (error.message.includes('does not exist') || error.message.includes('column "clerk_id"'))) {
      console.log('✅ SUCCESS: clerk_id column has been removed!');
      return true;
    } else if (error) {
      console.log('❌ Unexpected error:', error.message);
      return false;
    } else {
      console.log('⚠️  clerk_id column still exists');
      return false;
    }
  } catch (err) {
    if (err.message.includes('does not exist') || err.message.includes('column "clerk_id"')) {
      console.log('✅ SUCCESS: clerk_id column has been removed!');
      return true;
    } else {
      console.log('❌ Error during verification:', err.message);
      return false;
    }
  }
}

async function showFinalStatus() {
  console.log('\n📊 Final Users Table Structure:');
  
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('❌ Cannot access users table:', error.message);
    } else {
      if (users.length > 0) {
        console.log('🔑 Current column names:');
        Object.keys(users[0]).forEach(col => {
          console.log(`   ✓ ${col}`);
        });
      }
    }
  } catch (err) {
    console.log('❌ Error checking final structure:', err.message);
  }
}

async function main() {
  await dropClerkColumn();
  
  const isDropped = await verifyDrop();
  
  if (isDropped) {
    await showFinalStatus();
    console.log('\n🎉 CLERK REMOVAL COMPLETE!');
    console.log('✅ Database now uses 100% Supabase authentication');
  } else {
    console.log('\n⚠️  Manual action still required - see instructions above');
  }
}

main().catch(console.error);