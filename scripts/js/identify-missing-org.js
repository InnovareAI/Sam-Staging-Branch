#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 IDENTIFYING MISSING ORGANIZATION');
console.log('==================================\n');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function showCurrentOrganizations() {
  console.log('📋 Current organizations in database:');
  
  try {
    const { data: orgs, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (error) {
      console.log('❌ Error fetching organizations:', error.message);
      return [];
    }
    
    console.log(`✅ Found ${orgs.length} organizations:`);
    orgs.forEach((org, index) => {
      console.log(`   ${index + 1}. ${org.name} (${org.slug})`);
    });
    
    return orgs;
  } catch (err) {
    console.log('❌ Error:', err.message);
    return [];
  }
}

async function suggestMissingOrganization() {
  console.log('\n🤔 What could the 4th organization be?');
  console.log('=====================================');
  
  console.log('Current organizations:');
  console.log('✅ Sendingcell');
  console.log('✅ 3cubed'); 
  console.log('✅ InnovareAI (ADMIN)');
  console.log('❓ ??? (Missing 4th organization)');
  
  console.log('\nPossible candidates:');
  console.log('• A client organization?');
  console.log('• A partner company?');
  console.log('• A subsidiary or division?');
  console.log('• A test/demo organization?');
  console.log('• Another business entity?');
  
  console.log('\n📝 Please specify what the 4th organization should be.');
}

async function main() {
  const currentOrgs = await showCurrentOrganizations();
  
  if (currentOrgs.length === 3) {
    await suggestMissingOrganization();
  } else if (currentOrgs.length === 4) {
    console.log('\n✅ All 4 organizations are present!');
  } else {
    console.log(`\n⚠️  Found ${currentOrgs.length} organizations, expected 4`);
  }
  
  console.log('\n🎯 WAITING FOR 4TH ORGANIZATION NAME');
  console.log('Please provide the name of the missing organization.');
}

main().catch(console.error);