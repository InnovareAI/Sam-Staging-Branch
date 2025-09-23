#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🧠 KNOWLEDGE BASE DATABASE ASSESSMENT');
console.log('=====================================\n');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkKnowledgeBaseTables() {
  console.log('📚 KNOWLEDGE BASE TABLES CHECK:');
  console.log('===============================');
  
  const knowledgeBaseTables = [
    'knowledge_base_sections',
    'knowledge_base_content', 
    'knowledge_base_data',
    'icp_profiles',
    'knowledge_base',
    'kb_sections',
    'kb_content',
    'kb_data'
  ];
  
  const existingTables = [];
  
  for (const tableName of knowledgeBaseTables) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      if (!error) {
        existingTables.push(tableName);
        const columnCount = data.length > 0 ? Object.keys(data[0]).length : 0;
        console.log(`✅ ${tableName} EXISTS (${data.length} sample records, ${columnCount} columns)`);
        
        if (data.length > 0) {
          console.log(`   🔑 Columns: ${Object.keys(data[0]).join(', ')}`);
        }
        
        // Get count of total records
        const { count } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        console.log(`   📊 Total records: ${count || 0}`);
        console.log('');
      }
    } catch (err) {
      console.log(`❌ ${tableName}: DOES NOT EXIST`);
    }
  }
  
  if (existingTables.length === 0) {
    console.log('🚨 CRITICAL: NO KNOWLEDGE BASE TABLES FOUND!');
    console.log('All knowledge base data appears to be lost.');
  } else {
    console.log(`📊 Found ${existingTables.length} knowledge base tables:`, existingTables.join(', '));
  }
  
  return existingTables;
}

async function checkAllTables() {
  console.log('\n📋 CHECKING ALL AVAILABLE TABLES:');
  console.log('==================================');
  
  // Try to access all possible table names
  const possibleTables = [
    'users', 'workspaces', 'workspace_members', 'workspace_invitations',
    'organizations', 'sam_conversation_threads', 'sam_conversation_messages',
    'knowledge_base', 'knowledge_base_sections', 'knowledge_base_content', 'knowledge_base_data',
    'kb_sections', 'kb_content', 'kb_data', 'icp_profiles',
    'campaigns', 'campaign_prospects', 'integrations',
    'workspace_accounts', 'linkedin_contacts', 'bulk_upload_sessions',
    'user_unipile_accounts', 'linkedin_discovery_jobs', 'linkedin_contacts'
  ];
  
  const existingTables = [];
  const knowledgeTables = [];
  
  for (const tableName of possibleTables) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      if (!error) {
        existingTables.push(tableName);
        const columnCount = data.length > 0 ? Object.keys(data[0]).length : 0;
        const recordCount = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
          .then(({ count }) => count || 0);
        
        console.log(`✅ ${tableName} (${recordCount} records, ${columnCount} columns)`);
        
        // Check if this is a knowledge-related table
        if (tableName.includes('knowledge') || tableName.includes('kb') || tableName.includes('icp')) {
          knowledgeTables.push({ name: tableName, records: recordCount });
        }
      }
    } catch (err) {
      // Table doesn't exist or no access
    }
  }
  
  console.log(`\n📊 Total accessible tables: ${existingTables.length}`);
  console.log(`🧠 Knowledge-related tables: ${knowledgeTables.length}`);
  
  if (knowledgeTables.length > 0) {
    console.log('\n🧠 KNOWLEDGE BASE DATA SUMMARY:');
    knowledgeTables.forEach(table => {
      console.log(`   ${table.name}: ${table.records} records`);
    });
  }
  
  return { allTables: existingTables, knowledgeTables };
}

async function checkDocumentationFiles() {
  console.log('\n📄 DOCUMENTATION FILES CREATED IN LAST 24 HOURS:');
  console.log('================================================');
  
  // This would need to be implemented by checking file timestamps
  console.log('Note: File timestamp checking requires filesystem access.');
  console.log('Check manually with: find docs/ -name "*.md" -mtime -1');
}

async function generateDataLossReport() {
  console.log('\n🔍 DATA LOSS ASSESSMENT REPORT:');
  console.log('===============================');
  
  const { allTables, knowledgeTables } = await checkAllTables();
  const kbTables = await checkKnowledgeBaseTables();
  
  console.log('\n📋 SUMMARY:');
  console.log(`• Total database tables accessible: ${allTables.length}`);
  console.log(`• Knowledge base tables found: ${kbTables.length}`);
  console.log(`• Knowledge base data present: ${knowledgeTables.some(t => t.records > 0) ? 'YES' : 'NO'}`);
  
  if (kbTables.length === 0) {
    console.log('\n🚨 CRITICAL FINDINGS:');
    console.log('• ALL KNOWLEDGE BASE TABLES ARE MISSING');
    console.log('• Complete knowledge base data loss confirmed');
    console.log('• All KB documentation, ICP profiles, and SAM memory LOST');
    console.log('• Requires complete knowledge base reconstruction');
  } else {
    console.log('\n✅ POSITIVE FINDINGS:');
    console.log('• Some knowledge base tables still exist');
    console.log('• Data recovery may be possible');
  }
  
  console.log('\n🔧 RECOVERY RECOMMENDATIONS:');
  if (kbTables.length === 0) {
    console.log('• Check for database backups immediately');
    console.log('• Review migration files in /supabase/migrations/');
    console.log('• Recreate knowledge base schema from migrations');
    console.log('• Re-upload all KB documentation manually');
    console.log('• Rebuild ICP profiles from scratch');
  } else {
    console.log('• Analyze existing data for completeness');
    console.log('• Identify missing tables and data');
    console.log('• Restore from backups if available');
  }
}

async function main() {
  await checkKnowledgeBaseTables();
  await generateDataLossReport();
  await checkDocumentationFiles();
  
  console.log('\n🎯 KNOWLEDGE BASE ASSESSMENT COMPLETE');
  console.log('=====================================');
}

main().catch(console.error);