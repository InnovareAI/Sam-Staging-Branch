#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🏢 RESTORING ALL ORGANIZATIONS');
console.log('=============================\n');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTableStructure() {
  console.log('🔍 Checking organizations table structure...');
  
  try {
    // Try minimal insert to see what columns exist
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('❌ Error checking structure:', error.message);
      return null;
    }
    
    console.log('✅ Organizations table accessible');
    return true;
  } catch (err) {
    console.log('❌ Structure check error:', err.message);
    return null;
  }
}

async function createOrganizations() {
  console.log('\n📝 Creating organizations...');
  
  const orgsToCreate = [
    {
      name: 'Sendingcell',
      slug: 'sendingcell'
    },
    {
      name: '3cubed', 
      slug: '3cubed'
    },
    {
      name: 'InnovareAI',
      slug: 'innovareai'
    }
  ];
  
  const created = [];
  
  for (const orgData of orgsToCreate) {
    try {
      console.log(`\n🔄 Creating ${orgData.name}...`);
      
      // Try minimal insert first
      const { data: org, error } = await supabase
        .from('organizations')
        .insert([{
          name: orgData.name,
          slug: orgData.slug
        }])
        .select()
        .single();
      
      if (error) {
        console.log(`❌ Error creating ${orgData.name}:`, error.message);
        
        // Try even more minimal insert
        const { data: orgMin, error: errorMin } = await supabase
          .from('organizations')
          .insert([{
            name: orgData.name
          }])
          .select()
          .single();
        
        if (errorMin) {
          console.log(`❌ Minimal insert failed for ${orgData.name}:`, errorMin.message);
        } else {
          console.log(`✅ Created ${orgData.name} with minimal data`);
          console.log(`   ID: ${orgMin.id}`);
          created.push(orgMin);
        }
      } else {
        console.log(`✅ Successfully created ${orgData.name}`);
        console.log(`   ID: ${org.id}`);
        console.log(`   Name: ${org.name}`);
        console.log(`   Slug: ${org.slug}`);
        created.push(org);
      }
      
    } catch (err) {
      console.log(`❌ Exception creating ${orgData.name}:`, err.message);
    }
  }
  
  return created;
}

async function verifyOrganizations() {
  console.log('\n🔍 Verifying created organizations...');
  
  try {
    const { data: allOrgs, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (error) {
      console.log('❌ Error verifying organizations:', error.message);
      return false;
    }
    
    console.log(`✅ Found ${allOrgs.length} organizations in database:`);
    allOrgs.forEach((org, index) => {
      console.log(`   ${index + 1}. ${org.name}${org.slug ? ` (${org.slug})` : ''}`);
      console.log(`      ID: ${org.id}`);
      if (org.created_at) {
        console.log(`      Created: ${new Date(org.created_at).toLocaleDateString()}`);
      }
    });
    
    // Check if we have the expected organizations
    const expectedNames = ['Sendingcell', '3cubed', 'InnovareAI'];
    const existingNames = allOrgs.map(org => org.name);
    const missing = expectedNames.filter(name => !existingNames.includes(name));
    
    if (missing.length === 0) {
      console.log('\n✅ All expected organizations are present!');
      return true;
    } else {
      console.log(`\n⚠️  Missing organizations: ${missing.join(', ')}`);
      return false;
    }
    
  } catch (err) {
    console.log('❌ Verification error:', err.message);
    return false;
  }
}

async function main() {
  const structureOk = await checkTableStructure();
  
  if (!structureOk) {
    console.log('❌ Cannot proceed - table structure issue');
    return;
  }
  
  const created = await createOrganizations();
  const verified = await verifyOrganizations();
  
  console.log('\n🎯 ORGANIZATION RESTORATION SUMMARY');
  console.log('==================================');
  
  if (verified) {
    console.log('✅ ALL ORGANIZATIONS SUCCESSFULLY RESTORED:');
    console.log('   • Sendingcell');
    console.log('   • 3cubed'); 
    console.log('   • InnovareAI (ADMIN account)');
    console.log('\n📝 Next steps: Restore users and assign to organizations');
  } else {
    console.log('⚠️  PARTIAL RESTORATION COMPLETED');
    console.log(`   Created ${created.length} organizations`);
    console.log('   Some organizations may still need to be created');
  }
}

main().catch(console.error);