#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 ASSESSING FULL DATABASE DAMAGE');
console.log('=================================\n');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAllTables() {
  console.log('📋 Checking all application tables...');
  
  const criticalTables = [
    { name: 'users', description: 'User accounts' },
    { name: 'organizations', description: 'Organizations' },
    { name: 'workspaces', description: 'User workspaces' },
    { name: 'workspace_members', description: 'Workspace memberships' },
    { name: 'sam_conversation_threads', description: 'SAM chat threads' },
    { name: 'sam_conversation_messages', description: 'SAM chat messages' },
    { name: 'knowledge_base', description: 'Knowledge base entries' },
    { name: 'campaigns', description: 'Marketing campaigns' },
    { name: 'campaign_prospects', description: 'Campaign prospect data' },
    { name: 'integrations', description: 'Third-party integrations' },
    { name: 'workspace_accounts', description: 'Workspace account settings' },
    { name: 'linkedin_contacts', description: 'LinkedIn contact data' },
    { name: 'bulk_upload_sessions', description: 'Bulk upload history' }
  ];
  
  const tableStatus = [];
  
  for (const table of criticalTables) {
    try {
      const { data, error, count } = await supabase
        .from(table.name)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`❌ ${table.name}: ${error.message}`);
        tableStatus.push({ 
          ...table, 
          exists: false, 
          count: 0, 
          status: 'MISSING',
          error: error.message 
        });
      } else {
        const recordCount = count || 0;
        const status = recordCount > 0 ? 'HAS_DATA' : 'EMPTY';
        const icon = recordCount > 0 ? '✅' : '⚠️ ';
        
        console.log(`${icon} ${table.name}: ${recordCount} records (${status})`);
        tableStatus.push({ 
          ...table, 
          exists: true, 
          count: recordCount, 
          status 
        });
      }
    } catch (err) {
      console.log(`❌ ${table.name}: Exception - ${err.message}`);
      tableStatus.push({ 
        ...table, 
        exists: false, 
        count: 0, 
        status: 'ERROR',
        error: err.message 
      });
    }
  }
  
  return tableStatus;
}

async function summarizeDamage(tableStatus) {
  console.log('\n💥 DAMAGE ASSESSMENT SUMMARY');
  console.log('============================');
  
  const missing = tableStatus.filter(t => !t.exists);
  const empty = tableStatus.filter(t => t.exists && t.count === 0);
  const hasData = tableStatus.filter(t => t.exists && t.count > 0);
  
  console.log(`📊 Table Status:`);
  console.log(`   ❌ Missing tables: ${missing.length}`);
  console.log(`   ⚠️  Empty tables: ${empty.length}`);
  console.log(`   ✅ Tables with data: ${hasData.length}`);
  
  if (missing.length > 0) {
    console.log('\n❌ MISSING TABLES:');
    missing.forEach(table => {
      console.log(`   • ${table.name} (${table.description})`);
    });
  }
  
  if (empty.length > 0) {
    console.log('\n⚠️  EMPTY TABLES (structure exists, no data):');
    empty.forEach(table => {
      console.log(`   • ${table.name} (${table.description})`);
    });
  }
  
  if (hasData.length > 0) {
    console.log('\n✅ TABLES WITH DATA:');
    hasData.forEach(table => {
      console.log(`   • ${table.name}: ${table.count} records (${table.description})`);
    });
  }
}

async function assessApplicationImpact() {
  console.log('\n🚨 APPLICATION IMPACT ASSESSMENT');
  console.log('================================');
  
  console.log('CRITICAL FEATURES AFFECTED:');
  console.log('• 🔐 User Authentication - Users deleted, need recreation');
  console.log('• 🏢 Organization Management - Organizations restored');
  console.log('• 💬 SAM AI Conversations - All chat history lost');
  console.log('• 📚 Knowledge Base - All content lost');
  console.log('• 📧 Campaign Management - All campaigns lost');
  console.log('• 👥 Prospect Data - All prospects lost');
  console.log('• 🔗 LinkedIn Integrations - All connections lost');
  console.log('• ⚙️  User Settings - All preferences lost');
  console.log('• 🏠 Workspaces - All workspace data lost');
  
  console.log('\nREQUIRED RESTORATION:');
  console.log('1. 👥 Recreate all user accounts');
  console.log('2. 🏠 Recreate workspaces and assign users');
  console.log('3. 📚 Restore knowledge base content');
  console.log('4. 🔗 Reconnect LinkedIn integrations');
  console.log('5. 📧 Recreate any active campaigns');
  console.log('6. 👥 Re-import prospect databases');
  console.log('7. ⚙️  Reconfigure user settings');
}

async function main() {
  const tableStatus = await checkAllTables();
  await summarizeDamage(tableStatus);
  await assessApplicationImpact();
  
  console.log('\n🎯 IMMEDIATE ACTION REQUIRED');
  console.log('============================');
  console.log('This was a catastrophic data loss due to the database reset.');
  console.log('We need to systematically restore:');
  console.log('1. User accounts and authentication');
  console.log('2. Workspaces and organizational structure');
  console.log('3. Application data and configurations');
  console.log('4. Integration settings and connections');
  
  console.log('\n💡 Do you have backups or can provide the data to restore?');
}

main().catch(console.error);