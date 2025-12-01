#!/usr/bin/env node

/**
 * Comprehensive Supabase Tables and Fields Verification
 * Checks all key tables exist and have expected columns
 * Run: node scripts/verify-supabase-tables.cjs
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Define expected tables and their key columns
const EXPECTED_TABLES = {
  // Core multi-tenant tables
  workspaces: ['id', 'name', 'created_at'],
  workspace_members: ['id', 'workspace_id', 'user_id', 'role', 'status'],
  workspace_tiers: ['id', 'workspace_id', 'tier_name'],
  workspace_accounts: ['id', 'workspace_id', 'account_type', 'connection_status'],

  // Campaign system
  campaigns: ['id', 'workspace_id', 'name', 'status', 'campaign_type', 'message_templates'],
  campaign_prospects: ['id', 'campaign_id', 'workspace_id', 'first_name', 'last_name', 'linkedin_url', 'status'],
  campaign_messages: ['id', 'campaign_id', 'prospect_id'],

  // Queue system
  send_queue: ['id', 'campaign_id', 'prospect_id', 'linkedin_user_id', 'message', 'scheduled_for', 'status'],
  linkedin_message_queue: ['id', 'prospect_id', 'message', 'status'],

  // LinkedIn Commenting Agent
  linkedin_post_monitors: ['id', 'workspace_id', 'target_type', 'target_identifier', 'status'],
  linkedin_posts_discovered: ['id', 'monitor_id', 'post_url', 'status'],
  linkedin_post_comments: ['id', 'post_id', 'comment_text', 'status'],
  linkedin_comment_replies: ['id', 'comment_id', 'reply_text'],

  // User & Auth
  users: ['id', 'email'],

  // Knowledge Base (RAG)
  knowledge_base: ['id', 'workspace_id', 'title', 'content'],

  // Prospect approval
  prospect_approval_sessions: ['id', 'workspace_id', 'campaign_id', 'status'],
  prospect_approval_data: ['id', 'session_id', 'raw_data'],

  // Activity & Analytics
  activity_logs: ['id', 'workspace_id', 'action_type'],

  // SAM AI
  sam_threads: ['id', 'workspace_id', 'user_id'],
  sam_conversation_messages: ['id', 'thread_id', 'role', 'content'],
};

// Track results
const results = {
  passed: [],
  failed: [],
  warnings: [],
};

async function checkTable(tableName, expectedColumns) {
  try {
    // Try to select from the table with expected columns
    const { data, error } = await supabase
      .from(tableName)
      .select(expectedColumns.join(','))
      .limit(1);

    if (error) {
      // Check if it's a column doesn't exist error
      if (error.message.includes('does not exist') || error.code === '42703') {
        results.failed.push({
          table: tableName,
          error: `Missing column: ${error.message}`,
        });
        return false;
      }
      // Table doesn't exist
      if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist')) {
        results.failed.push({
          table: tableName,
          error: `Table does not exist: ${error.message}`,
        });
        return false;
      }
      // Other error
      results.warnings.push({
        table: tableName,
        warning: `Query error (may be RLS): ${error.message}`,
      });
      return null;
    }

    // Get count
    const { count, error: countError } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    results.passed.push({
      table: tableName,
      columns: expectedColumns,
      rowCount: count || 0,
    });
    return true;
  } catch (err) {
    results.failed.push({
      table: tableName,
      error: `Exception: ${err.message}`,
    });
    return false;
  }
}

async function checkDatabaseConnection() {
  console.log('\n===========================================');
  console.log('   SUPABASE DATABASE VERIFICATION');
  console.log('===========================================\n');

  console.log(`Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log(`Service Role Key: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '***' + process.env.SUPABASE_SERVICE_ROLE_KEY.slice(-8) : 'NOT SET'}\n`);

  // Test basic connection
  try {
    const { data, error } = await supabase.from('workspaces').select('count').limit(1);
    if (error && error.code === '42P01') {
      console.log('CRITICAL: Cannot connect to database or workspaces table missing\n');
      return false;
    }
    console.log('Database connection: OK\n');
    return true;
  } catch (err) {
    console.log(`CRITICAL: Database connection failed: ${err.message}\n`);
    return false;
  }
}

async function runVerification() {
  const connected = await checkDatabaseConnection();
  if (!connected) {
    process.exit(1);
  }

  console.log('Checking tables...\n');
  console.log('-------------------------------------------');

  for (const [tableName, columns] of Object.entries(EXPECTED_TABLES)) {
    const status = await checkTable(tableName, columns);
    const symbol = status === true ? '✅' : status === false ? '❌' : '⚠️';
    const statusText = status === true ? 'OK' : status === false ? 'FAIL' : 'WARN';
    console.log(`${symbol} ${tableName.padEnd(30)} [${statusText}]`);
  }

  console.log('\n-------------------------------------------');
  console.log('SUMMARY');
  console.log('-------------------------------------------\n');

  // Passed tables
  if (results.passed.length > 0) {
    console.log(`✅ PASSED: ${results.passed.length} tables`);
    for (const p of results.passed) {
      console.log(`   ${p.table}: ${p.rowCount} rows`);
    }
    console.log('');
  }

  // Warnings (usually RLS issues)
  if (results.warnings.length > 0) {
    console.log(`⚠️  WARNINGS: ${results.warnings.length} tables`);
    for (const w of results.warnings) {
      console.log(`   ${w.table}: ${w.warning}`);
    }
    console.log('');
  }

  // Failed tables
  if (results.failed.length > 0) {
    console.log(`❌ FAILED: ${results.failed.length} tables`);
    for (const f of results.failed) {
      console.log(`   ${f.table}: ${f.error}`);
    }
    console.log('');
  }

  // Final status
  console.log('-------------------------------------------');
  if (results.failed.length === 0) {
    console.log('✅ ALL TABLES VERIFIED SUCCESSFULLY');
  } else {
    console.log(`❌ VERIFICATION COMPLETED WITH ${results.failed.length} FAILURES`);
  }
  console.log('-------------------------------------------\n');

  return results.failed.length === 0;
}

// Additional checks
async function checkCriticalData() {
  console.log('\n===========================================');
  console.log('   CRITICAL DATA VERIFICATION');
  console.log('===========================================\n');

  // Check workspaces
  const { data: workspaces, error: wsError } = await supabase
    .from('workspaces')
    .select('id, name')
    .limit(10);

  if (wsError) {
    console.log(`Workspaces: ❌ ERROR - ${wsError.message}`);
  } else {
    console.log(`Workspaces: ${workspaces?.length || 0} found`);
    workspaces?.forEach(ws => {
      console.log(`   - ${ws.name} (${ws.id.substring(0, 8)}...)`);
    });
  }
  console.log('');

  // Check InnovareAI workspace specifically
  const innovareId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
  const { data: innovare } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('id', innovareId)
    .single();

  if (innovare) {
    console.log(`InnovareAI (IA1): ✅ FOUND`);
  } else {
    console.log(`InnovareAI (IA1): ❌ NOT FOUND`);
  }

  // Check active campaigns
  const { count: campaignCount } = await supabase
    .from('campaigns')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  console.log(`Active campaigns: ${campaignCount || 0}`);

  // Check send queue status breakdown
  const { data: pendingQueue } = await supabase
    .from('send_queue')
    .select('status')
    .eq('status', 'pending');

  const { data: sentQueue } = await supabase
    .from('send_queue')
    .select('status')
    .eq('status', 'sent');

  console.log(`Send queue: pending=${pendingQueue?.length || 0}, sent=${sentQueue?.length || 0}`);

  // Check LinkedIn accounts
  const { data: linkedinAccounts } = await supabase
    .from('workspace_accounts')
    .select('id, account_name, connection_status')
    .eq('account_type', 'linkedin')
    .eq('connection_status', 'connected');

  console.log(`Connected LinkedIn accounts: ${linkedinAccounts?.length || 0}`);
  if (linkedinAccounts && linkedinAccounts.length > 0) {
    linkedinAccounts.slice(0, 5).forEach(acc => {
      console.log(`   - ${acc.account_name}`);
    });
  }

  // Check commenting monitors
  const { count: monitorCount } = await supabase
    .from('linkedin_post_monitors')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  console.log(`Active commenting monitors: ${monitorCount || 0}`);

  // Check prospect counts
  const { count: prospectCount } = await supabase
    .from('campaign_prospects')
    .select('*', { count: 'exact', head: true });

  console.log(`Total campaign prospects: ${prospectCount || 0}`);

  // Check SAM threads
  const { count: threadCount } = await supabase
    .from('sam_threads')
    .select('*', { count: 'exact', head: true });

  console.log(`SAM conversation threads: ${threadCount || 0}`);

  console.log('\n-------------------------------------------\n');
}

// Run everything
async function main() {
  try {
    const success = await runVerification();
    await checkCriticalData();
    process.exit(success ? 0 : 1);
  } catch (err) {
    console.error('Verification failed:', err);
    process.exit(1);
  }
}

main();
