#!/usr/bin/env node
/**
 * 🚀 ULTRAHARD: Deep Check All Account Tables
 */
import 'dotenv/config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 DEEP ACCOUNT CHECK\n');

// Check workspace_accounts table
console.log('1️⃣ Checking workspace_accounts table...');
const accountsRes = await fetch(`${SUPABASE_URL}/rest/v1/workspace_accounts?select=*`, {
  headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
});
const accounts = await accountsRes.json();
console.log(`Found ${Array.isArray(accounts) ? accounts.length : 0} accounts`);
if (Array.isArray(accounts)) {
  accounts.forEach(acc => {
    console.log(`  - ${acc.account_name || acc.id} | Provider: ${acc.provider} | Workspace: ${acc.workspace_id}`);
  });
}

// Check user_unipile_accounts table (legacy?)
console.log('\n2️⃣ Checking user_unipile_accounts table...');
const userAccountsRes = await fetch(`${SUPABASE_URL}/rest/v1/user_unipile_accounts?select=*`, {
  headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
});
const userAccounts = await userAccountsRes.json();
if (userAccounts && !userAccounts.message) {
  console.log(`Found ${Array.isArray(userAccounts) ? userAccounts.length : 0} user accounts`);
  if (Array.isArray(userAccounts)) {
    userAccounts.forEach(acc => {
      console.log(`  - User: ${acc.user_id} | Unipile: ${acc.unipile_account_id} | Provider: ${acc.provider}`);
    });
  }
} else {
  console.log('Table does not exist or error:', userAccounts.message);
}

// Check if there's a different accounts table
console.log('\n3️⃣ Checking all tables with "account" in name...');
const tablesRes = await fetch(`${SUPABASE_URL}/rest/v1/`, {
  headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
});

// Try unipile_linkedin_accounts
console.log('\n4️⃣ Checking unipile_linkedin_accounts...');
const unipileLinkedinRes = await fetch(`${SUPABASE_URL}/rest/v1/unipile_linkedin_accounts?select=*`, {
  headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
});
const unipileLinkedin = await unipileLinkedinRes.json();
if (unipileLinkedin && !unipileLinkedin.message) {
  console.log(`Found ${Array.isArray(unipileLinkedin) ? unipileLinkedin.length : 0} unipile linkedin accounts`);
  if (Array.isArray(unipileLinkedin)) {
    unipileLinkedin.forEach(acc => {
      console.log(`  - ${acc.account_name} | Unipile ID: ${acc.unipile_account_id} | Workspace: ${acc.workspace_id || 'N/A'}`);
    });
  }
} else {
  console.log('Table does not exist or error');
}

// Check campaigns to see what account they're referencing
console.log('\n5️⃣ Checking recent campaigns for account references...');
const campaignsRes = await fetch(
  `${SUPABASE_URL}/rest/v1/campaigns?select=id,name,workspace_id,settings,metadata&order=created_at.desc&limit=5`,
  { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
);
const campaigns = await campaignsRes.json();
if (Array.isArray(campaigns)) {
  campaigns.forEach(c => {
    console.log(`\n  Campaign: ${c.name}`);
    console.log(`    Workspace: ${c.workspace_id}`);
    if (c.settings) {
      console.log(`    Settings:`, JSON.stringify(c.settings, null, 2));
    }
    if (c.metadata) {
      console.log(`    Metadata:`, JSON.stringify(c.metadata, null, 2));
    }
  });
}

console.log('\n');
