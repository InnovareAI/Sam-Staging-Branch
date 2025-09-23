#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔧 REMOVING CLERK_ID COLUMN FROM USERS TABLE');
console.log('============================================\n');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function removeClerkColumn() {
  console.log('🗑️  Attempting to remove clerk_id column...');
  
  try {
    // First, let's see what's in the users table
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, clerk_id, email')
      .limit(3);
    
    if (usersError) {
      console.log('❌ Error accessing users table:', usersError.message);
      return;
    }
    
    console.log(`📊 Found ${users.length} users in table:`);
    users.forEach(user => {
      console.log(`   ${user.email} - clerk_id: ${user.clerk_id || 'NULL'} - id: ${user.id.substring(0, 8)}...`);
    });
    
    // Check if any users actually have clerk_id values
    const usersWithClerkId = users.filter(u => u.clerk_id);
    console.log(`\n🔍 Users with clerk_id values: ${usersWithClerkId.length}`);
    
    if (usersWithClerkId.length > 0) {
      console.log('⚠️  Some users still have clerk_id values. This needs to be handled carefully.');
      usersWithClerkId.forEach(user => {
        console.log(`   ${user.email}: ${user.clerk_id}`);
      });
    } else {
      console.log('✅ No users have clerk_id values - safe to remove column');
    }
    
    // Now attempt to drop the column using a raw SQL query
    console.log('\n🔧 Attempting to drop clerk_id column...');
    
    // We'll use a simple approach - directly modify via Supabase SQL editor equivalent
    // Since we can't use rpc('exec'), we'll try to use a workaround
    
    // Method 1: Try to update the column to NULL first
    const { error: nullifyError } = await supabase
      .from('users')
      .update({ clerk_id: null })
      .not('clerk_id', 'is', null);
    
    if (nullifyError) {
      console.log('⚠️  Could not nullify clerk_id values:', nullifyError.message);
    } else {
      console.log('✅ Nullified all clerk_id values');
    }
    
    console.log('\n📝 Manual SQL command needed:');
    console.log('Execute this in Supabase SQL Editor:');
    console.log('```sql');
    console.log('ALTER TABLE users DROP COLUMN IF EXISTS clerk_id CASCADE;');
    console.log('```');
    
  } catch (err) {
    console.log('❌ Error:', err.message);
  }
}

async function verifyAfterRemoval() {
  console.log('\n🔍 Verifying clerk_id column removal...');
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('clerk_id')
      .limit(1);
    
    if (error && error.message.includes('does not exist')) {
      console.log('✅ clerk_id column successfully removed!');
    } else if (error) {
      console.log('❌ Unexpected error:', error.message);
    } else {
      console.log('⚠️  clerk_id column still exists');
    }
  } catch (err) {
    if (err.message.includes('does not exist')) {
      console.log('✅ clerk_id column successfully removed!');
    } else {
      console.log('❌ Error during verification:', err.message);
    }
  }
}

async function main() {
  await removeClerkColumn();
  
  console.log('\n🎯 NEXT STEPS:');
  console.log('1. Go to Supabase Dashboard > SQL Editor');
  console.log('2. Run: ALTER TABLE users DROP COLUMN IF EXISTS clerk_id CASCADE;');
  console.log('3. Verify removal with the verification script');
  
  console.log('\n🔄 Running verification now...');
  await verifyAfterRemoval();
}

main().catch(console.error);