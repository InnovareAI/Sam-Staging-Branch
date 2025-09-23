#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🏢 CREATING WT MATCHMAKER ORGANIZATION');
console.log('====================================\n');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createWTMatchmaker() {
  console.log('📝 Creating WT Matchmaker organization...');
  
  try {
    const { data: org, error } = await supabase
      .from('organizations')
      .insert([{
        name: 'WT Matchmaker',
        slug: 'wt-matchmaker',
        clerk_org_id: uuidv4()
      }])
      .select()
      .single();
    
    if (error) {
      console.log('❌ Error creating WT Matchmaker:', error.message);
      return null;
    }
    
    console.log('✅ Successfully created WT Matchmaker');
    console.log(`   ID: ${org.id}`);
    console.log(`   Name: ${org.name}`);
    console.log(`   Slug: ${org.slug}`);
    console.log(`   Clerk Org ID: ${org.clerk_org_id}`);
    console.log(`   Created: ${new Date(org.created_at).toLocaleDateString()}`);
    
    return org;
  } catch (err) {
    console.log('❌ Error creating WT Matchmaker:', err.message);
    return null;
  }
}

async function verifyAllOrganizations() {
  console.log('\n🔍 Verifying all 4 organizations...');
  
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
      console.log(`      Slug: ${org.slug}`);
      console.log(`      Clerk Org ID: ${org.clerk_org_id}`);
      console.log(`      Created: ${new Date(org.created_at).toLocaleDateString()}`);
    });
    
    // Check if we have all expected organizations
    const expectedNames = ['Sendingcell', '3cubed', 'InnovareAI', 'WT Matchmaker'];
    const existingNames = allOrgs.map(org => org.name);
    const missing = expectedNames.filter(name => !existingNames.includes(name));
    
    if (missing.length === 0) {
      console.log('\n✅ ALL 4 ORGANIZATIONS ARE NOW PRESENT!');
      
      // Identify special organizations
      const innovareAI = allOrgs.find(org => org.name === 'InnovareAI');
      const wtMatchmaker = allOrgs.find(org => org.name === 'WT Matchmaker');
      
      console.log('\n🔑 SPECIAL ORGANIZATIONS:');
      if (innovareAI) {
        console.log(`   • InnovareAI (ADMIN): ${innovareAI.id}`);
      }
      if (wtMatchmaker) {
        console.log(`   • WT Matchmaker: ${wtMatchmaker.id}`);
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
  const created = await createWTMatchmaker();
  
  if (created) {
    const allComplete = await verifyAllOrganizations();
    
    if (allComplete) {
      console.log('\n🎉 ORGANIZATION RESTORATION COMPLETE!');
      console.log('====================================');
      console.log('✅ ALL 4 ORGANIZATIONS SUCCESSFULLY RESTORED:');
      console.log('   • Sendingcell - Ready for use');
      console.log('   • 3cubed - Ready for use');
      console.log('   • InnovareAI - ADMIN ORGANIZATION');
      console.log('   • WT Matchmaker - Ready for use');
      console.log('\n📝 All organizations are now ready for user assignment');
    } else {
      console.log('\n⚠️  Organization restoration incomplete');
    }
  } else {
    console.log('\n❌ Failed to create WT Matchmaker organization');
  }
}

main().catch(console.error);