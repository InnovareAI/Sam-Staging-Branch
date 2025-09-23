#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🏢 RESTORING SENDINGCELL ORGANIZATION');
console.log('===================================\n');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createSendingcellOrganization() {
  console.log('📝 Creating Sendingcell organization...');
  
  try {
    const { data: org, error } = await supabase
      .from('organizations')
      .insert([
        {
          name: 'Sendingcell',
          slug: 'sendingcell',
          description: 'Sendingcell Organization',
          settings: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select()
      .single();
    
    if (error) {
      console.log('❌ Error creating Sendingcell:', error.message);
      return null;
    }
    
    console.log('✅ Successfully created Sendingcell organization');
    console.log(`   ID: ${org.id}`);
    console.log(`   Name: ${org.name}`);
    console.log(`   Slug: ${org.slug}`);
    console.log(`   Created: ${new Date(org.created_at).toLocaleDateString()}`);
    
    return org;
  } catch (err) {
    console.log('❌ Error creating organization:', err.message);
    return null;
  }
}

async function verifySendingcellCreation() {
  console.log('\n🔍 Verifying Sendingcell creation...');
  
  try {
    const { data: orgs, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('name', 'Sendingcell');
    
    if (error) {
      console.log('❌ Error verifying Sendingcell:', error.message);
      return false;
    }
    
    if (orgs.length > 0) {
      console.log('✅ Sendingcell organization verified in database');
      return true;
    } else {
      console.log('❌ Sendingcell not found after creation');
      return false;
    }
  } catch (err) {
    console.log('❌ Verification error:', err.message);
    return false;
  }
}

async function showOrganizationStatus() {
  console.log('\n📊 Current organizations status:');
  
  try {
    const { data: allOrgs, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (error) {
      console.log('❌ Error fetching organizations:', error.message);
      return;
    }
    
    console.log(`📋 Total organizations: ${allOrgs.length}`);
    allOrgs.forEach((org, index) => {
      console.log(`   ${index + 1}. ${org.name} (${org.slug})`);
    });
    
    // Check what's still needed
    const needed = ['3cubed', 'InnovareAI'];
    const existing = allOrgs.map(org => org.name);
    const missing = needed.filter(name => !existing.includes(name));
    
    if (missing.length > 0) {
      console.log(`\n⚠️  Still need to create: ${missing.join(', ')}`);
    } else {
      console.log('\n✅ All expected organizations created');
    }
    
  } catch (err) {
    console.log('❌ Status check error:', err.message);
  }
}

async function main() {
  const org = await createSendingcellOrganization();
  
  if (org) {
    const verified = await verifySendingcellCreation();
    await showOrganizationStatus();
    
    if (verified) {
      console.log('\n🎯 SENDINGCELL RESTORATION COMPLETE');
      console.log('==================================');
      console.log('✅ Sendingcell organization has been successfully restored');
      console.log('📝 Ready to restore 3cubed and InnovareAI organizations next');
    } else {
      console.log('\n❌ SENDINGCELL RESTORATION FAILED');
      console.log('=================================');
      console.log('Something went wrong during creation or verification');
    }
  } else {
    console.log('\n❌ FAILED TO CREATE SENDINGCELL');
    console.log('==============================');
    console.log('Unable to create Sendingcell organization');
  }
}

main().catch(console.error);