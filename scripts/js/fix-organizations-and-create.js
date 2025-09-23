#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔧 FIXING ORGANIZATIONS TABLE AND CREATING ORGS');
console.log('==============================================\n');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createOrganizationsWithClerkIds() {
  console.log('📝 Creating organizations with clerk_org_id values...');
  
  const orgsToCreate = [
    {
      name: 'Sendingcell',
      slug: 'sendingcell',
      clerk_org_id: uuidv4() // Generate unique ID for Clerk compatibility
    },
    {
      name: '3cubed', 
      slug: '3cubed',
      clerk_org_id: uuidv4()
    },
    {
      name: 'InnovareAI',
      slug: 'innovareai', 
      clerk_org_id: uuidv4()
    }
  ];
  
  const created = [];
  
  for (const orgData of orgsToCreate) {
    try {
      console.log(`\n🔄 Creating ${orgData.name}...`);
      
      const { data: org, error } = await supabase
        .from('organizations')
        .insert([{
          name: orgData.name,
          slug: orgData.slug,
          clerk_org_id: orgData.clerk_org_id
        }])
        .select()
        .single();
      
      if (error) {
        console.log(`❌ Error creating ${orgData.name}:`, error.message);
        
        // Try with just name and clerk_org_id
        const { data: orgMin, error: errorMin } = await supabase
          .from('organizations')
          .insert([{
            name: orgData.name,
            clerk_org_id: orgData.clerk_org_id
          }])
          .select()
          .single();
        
        if (errorMin) {
          console.log(`❌ Minimal insert failed for ${orgData.name}:`, errorMin.message);
        } else {
          console.log(`✅ Created ${orgData.name} with minimal data`);
          console.log(`   ID: ${orgMin.id}`);
          console.log(`   Clerk Org ID: ${orgMin.clerk_org_id}`);
          created.push(orgMin);
        }
      } else {
        console.log(`✅ Successfully created ${orgData.name}`);
        console.log(`   ID: ${org.id}`);
        console.log(`   Name: ${org.name}`);
        console.log(`   Slug: ${org.slug || 'N/A'}`);
        console.log(`   Clerk Org ID: ${org.clerk_org_id}`);
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
      console.log(`\n   ${index + 1}. ${org.name}`);
      console.log(`      ID: ${org.id}`);
      if (org.slug) console.log(`      Slug: ${org.slug}`);
      console.log(`      Clerk Org ID: ${org.clerk_org_id}`);
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
      
      // Identify InnovareAI as the admin organization
      const innovareAI = allOrgs.find(org => org.name === 'InnovareAI');
      if (innovareAI) {
        console.log(`\n🔑 ADMIN ORGANIZATION: InnovareAI`);
        console.log(`   Admin Org ID: ${innovareAI.id}`);
        console.log(`   This will be used for admin account management`);
      }
      
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
  const created = await createOrganizationsWithClerkIds();
  const verified = await verifyOrganizations();
  
  console.log('\n🎯 ORGANIZATION RESTORATION SUMMARY');
  console.log('==================================');
  
  if (verified) {
    console.log('✅ ALL ORGANIZATIONS SUCCESSFULLY RESTORED:');
    console.log('   • Sendingcell - Ready for use');
    console.log('   • 3cubed - Ready for use'); 
    console.log('   • InnovareAI - ADMIN ORGANIZATION');
    console.log('\n📝 Organizations are now ready for user assignment');
    console.log('📝 InnovareAI is designated as the admin organization');
  } else {
    console.log('⚠️  PARTIAL RESTORATION COMPLETED');
    console.log(`   Created ${created.length} organizations`);
    console.log('   Some organizations may still need to be created manually');
  }
}

main().catch(console.error);