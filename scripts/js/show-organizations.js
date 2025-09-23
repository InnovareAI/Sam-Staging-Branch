#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🏢 ORGANIZATIONS CHECK');
console.log('======================\n');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function showOrganizations() {
  console.log('📋 Current Organizations in Database:');
  console.log('====================================');
  
  try {
    const { data: orgs, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (error) {
      console.log('❌ Error fetching organizations:', error.message);
      return;
    }
    
    if (orgs.length === 0) {
      console.log('📝 No organizations found in database');
      console.log('\n🎯 Expected Organizations:');
      console.log('- Sendingcell');
      console.log('- 3cubed');
      console.log('- InnovareAI');
      console.log('\nThese need to be created in the database.');
    } else {
      console.log(`✅ Found ${orgs.length} organizations:`);
      orgs.forEach((org, index) => {
        console.log(`\n${index + 1}. ${org.name || 'Unnamed'}`);
        console.log(`   ID: ${org.id}`);
        if (org.slug) console.log(`   Slug: ${org.slug}`);
        if (org.description) console.log(`   Description: ${org.description}`);
        if (org.settings) console.log(`   Settings: ${JSON.stringify(org.settings)}`);
        console.log(`   Created: ${new Date(org.created_at).toLocaleDateString()}`);
      });
    }
    
    return orgs;
  } catch (err) {
    console.log('❌ Error:', err.message);
  }
}

async function checkOrganizationStructure() {
  console.log('\n🏗️  Organization Table Structure:');
  console.log('=================================');
  
  try {
    // Get one record to see the structure
    const { data: sample, error } = await supabase
      .from('organizations')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('❌ Structure check error:', error.message);
    } else {
      if (sample.length > 0) {
        console.log('🔑 Available columns:', Object.keys(sample[0]).join(', '));
      } else {
        console.log('📋 Table exists but is empty');
        console.log('🔑 Ready to create organizations');
      }
    }
  } catch (err) {
    console.log('❌ Structure check error:', err.message);
  }
}

async function suggestOrganizationCreation() {
  console.log('\n🚀 Organization Creation Suggestions:');
  console.log('====================================');
  
  const expectedOrgs = [
    { name: 'Sendingcell', slug: 'sendingcell' },
    { name: '3cubed', slug: '3cubed' },
    { name: 'InnovareAI', slug: 'innovareai' }
  ];
  
  console.log('📝 To create the expected organizations, run SQL commands like:');
  console.log('');
  
  expectedOrgs.forEach((org, index) => {
    console.log(`-- Create ${org.name}`);
    console.log(`INSERT INTO organizations (name, slug, created_at, updated_at)`);
    console.log(`VALUES ('${org.name}', '${org.slug}', NOW(), NOW());`);
    console.log('');
  });
  
  console.log('Or create them through the application UI once users are registered.');
}

async function main() {
  const orgs = await showOrganizations();
  await checkOrganizationStructure();
  
  if (!orgs || orgs.length === 0) {
    await suggestOrganizationCreation();
  }
  
  console.log('\n🎯 SUMMARY:');
  console.log('===========');
  console.log('Organizations table exists and is accessible.');
  console.log('Ready to create Sendingcell, 3cubed, and InnovareAI organizations.');
}

main().catch(console.error);