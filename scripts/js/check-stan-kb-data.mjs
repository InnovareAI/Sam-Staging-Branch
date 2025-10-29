#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08'; // Blue Label Labs
const stanUserId = '6a927440-ebe1-49b4-ae5e-fbee5d27944d';

console.log('🔍 Checking Stan\'s Blue Label Labs Data\n');

// 1. Check campaigns created
console.log('📋 Campaigns:');
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name, created_at, status, campaign_type, message_templates')
  .eq('workspace_id', workspaceId)
  .order('created_at', { ascending: false });

if (campaigns && campaigns.length > 0) {
  console.log(`   Found ${campaigns.length} campaigns:`);
  campaigns.forEach(c => {
    console.log(`   - "${c.name}" (${c.status}) - ${new Date(c.created_at).toLocaleDateString()}`);
    console.log(`     Type: ${c.campaign_type || 'N/A'}`);
    console.log(`     Templates: ${c.message_templates ? 'Yes' : 'No'}`);
  });
} else {
  console.log('   ❌ No campaigns found');
}

// 2. Check knowledge base entries
console.log('\n📚 Knowledge Base:');
const { data: kb } = await supabase
  .from('knowledge_base')
  .select('id, title, content_type, created_at')
  .eq('workspace_id', workspaceId)
  .order('created_at', { ascending: false })
  .limit(10);

if (kb && kb.length > 0) {
  console.log(`   Found ${kb.length} KB entries:`);
  kb.forEach(k => {
    console.log(`   - "${k.title}" (${k.content_type}) - ${new Date(k.created_at).toLocaleDateString()}`);
  });
} else {
  console.log('   ❌ No knowledge base entries found');
}

// 3. Check SAM conversation threads
console.log('\n💬 SAM Conversation Threads:');
const { data: threads } = await supabase
  .from('sam_conversation_threads')
  .select('id, title, created_at, last_active_at, thread_type')
  .eq('workspace_id', workspaceId)
  .order('created_at', { ascending: false })
  .limit(10);

if (threads && threads.length > 0) {
  console.log(`   Found ${threads.length} conversation threads:`);
  threads.forEach(t => {
    console.log(`   - "${t.title}" (${t.thread_type})`);
    console.log(`     Created: ${new Date(t.created_at).toLocaleDateString()}`);
    console.log(`     Last active: ${new Date(t.last_active_at).toLocaleDateString()}`);
  });
} else {
  console.log('   ❌ No conversation threads found');
}

// 4. Check ICP configurations
console.log('\n🎯 ICP Configurations:');
const { data: icps } = await supabase
  .from('icp_configurations')
  .select('id, name, target_titles, target_industries, created_at')
  .eq('workspace_id', workspaceId)
  .order('created_at', { ascending: false });

if (icps && icps.length > 0) {
  console.log(`   Found ${icps.length} ICP configs:`);
  icps.forEach(i => {
    console.log(`   - "${i.name}" - ${new Date(i.created_at).toLocaleDateString()}`);
    console.log(`     Titles: ${i.target_titles?.slice(0, 3).join(', ') || 'N/A'}`);
    console.log(`     Industries: ${i.target_industries?.slice(0, 3).join(', ') || 'N/A'}`);
  });
} else {
  console.log('   ❌ No ICP configurations found');
}

// 5. Check prospect approval data (from Sam search)
console.log('\n🔍 Prospect Approval Data (Sam Search Results):');
const { data: approvals } = await supabase
  .from('prospect_approval_data')
  .select('id, created_at, data')
  .eq('workspace_id', workspaceId)
  .order('created_at', { ascending: false })
  .limit(5);

if (approvals && approvals.length > 0) {
  console.log(`   Found ${approvals.length} search result sets:`);
  approvals.forEach(a => {
    const contacts = a.data?.contacts?.length || 0;
    console.log(`   - ${new Date(a.created_at).toLocaleDateString()}: ${contacts} contacts`);
  });
} else {
  console.log('   ❌ No prospect approval data found');
}

console.log('\n\n📊 Summary:');
console.log(`   Campaigns: ${campaigns?.length || 0}`);
console.log(`   KB Entries: ${kb?.length || 0}`);
console.log(`   Conversation Threads: ${threads?.length || 0}`);
console.log(`   ICP Configs: ${icps?.length || 0}`);
console.log(`   Search Results: ${approvals?.length || 0}`);
console.log(`   Prospects: 97 (verified earlier)`);

console.log('\n🔍 CONCLUSION:');
if (!campaigns?.length && !kb?.length && !threads?.length && !icps?.length && !approvals?.length) {
  console.log('   ❌ NO DATA WAS SAVED from Stan\'s Sam AI conversation');
  console.log('   ⚠️  All ICP discovery, message templates, and campaign data was LOST');
  console.log('   💡 Only the 97 prospects remain in workspace_prospects table');
} else {
  console.log('   ✅ Some data was saved:');
  if (campaigns?.length) console.log('      - Campaigns exist');
  if (kb?.length) console.log('      - Knowledge base has entries');
  if (threads?.length) console.log('      - Conversation history preserved');
  if (icps?.length) console.log('      - ICP configurations saved');
  if (approvals?.length) console.log('      - Search results saved');
}
