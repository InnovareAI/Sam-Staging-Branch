#!/usr/bin/env node
/**
 * 🚀 ULTRAHARD: Complete Campaign System Diagnosis
 * One script to rule them all - checks EVERYTHING
 */
import 'dotenv/config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const N8N_URL = process.env.N8N_API_URL || 'https://innovareai.app.n8n.cloud';
const N8N_KEY = process.env.N8N_API_KEY;

console.log('🚀 ULTRAHARD MODE: Campaign System Diagnosis\n');

const issues = [];
const fixes = [];

// 1. CHECK WORKSPACE LINKEDIN ACCOUNTS
console.log('1️⃣ Checking LinkedIn accounts...');
const accountsRes = await fetch(`${SUPABASE_URL}/rest/v1/workspace_accounts?select=*&provider=eq.linkedin`, {
  headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
});
const accounts = await accountsRes.json();

if (!Array.isArray(accounts) || accounts.length === 0) {
  issues.push('❌ NO LINKEDIN ACCOUNTS CONNECTED');
  fixes.push('→ Go to workspace settings and connect LinkedIn via Unipile');
} else {
  console.log(`✅ Found ${accounts.length} LinkedIn account(s)`);
  accounts.forEach(acc => {
    console.log(`   - ${acc.id} | Unipile ID: ${acc.unipile_account_id || 'MISSING'} | Status: ${acc.status || 'unknown'}`);
    if (!acc.unipile_account_id) {
      issues.push(`❌ Account ${acc.id} missing Unipile ID`);
      fixes.push('→ Reconnect this LinkedIn account through Unipile');
    }
  });
}

// 2. CHECK N8N WORKFLOWS
console.log('\n2️⃣ Checking N8N workflows...');
const workflowsRes = await fetch(`${N8N_URL}/api/v1/workflows`, {
  headers: { 'X-N8N-API-KEY': N8N_KEY }
});

if (workflowsRes.ok) {
  const workflows = await workflowsRes.json();
  const campaignWorkflow = workflows.data?.find(w =>
    w.name?.toLowerCase().includes('campaign') ||
    w.name?.toLowerCase().includes('linkedin')
  );

  if (campaignWorkflow) {
    console.log(`✅ Found campaign workflow: ${campaignWorkflow.name}`);
    console.log(`   - ID: ${campaignWorkflow.id}`);
    console.log(`   - Active: ${campaignWorkflow.active ? '✅ YES' : '❌ NO'}`);

    if (!campaignWorkflow.active) {
      issues.push('❌ Campaign workflow is INACTIVE');
      fixes.push(`→ Activate workflow: ${N8N_URL}/workflow/${campaignWorkflow.id}`);
    }
  } else {
    issues.push('❌ NO CAMPAIGN WORKFLOW FOUND');
    fixes.push('→ Import and configure campaign workflow in N8N');
  }
} else {
  issues.push('❌ Cannot connect to N8N API');
  fixes.push('→ Check N8N_API_KEY in environment variables');
}

// 3. CHECK RECENT CAMPAIGN EXECUTION
console.log('\n3️⃣ Checking recent campaign executions...');
const prospectsRes = await fetch(
  `${SUPABASE_URL}/rest/v1/campaign_prospects?select=*&order=contacted_at.desc.nullslast&limit=5`,
  { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
);
const prospects = await prospectsRes.json();

if (prospects && prospects.length > 0) {
  console.log(`✅ Found ${prospects.length} recent campaign prospects`);

  prospects.forEach(p => {
    const hasMessageId = p.personalization_data?.unipile_message_id;
    const hasContent = p.personalization_data?.message_content;
    const status = hasMessageId && hasContent ? '✅' : '⚠️';

    console.log(`   ${status} ${p.first_name} ${p.last_name} | Status: ${p.status} | Message ID: ${hasMessageId ? 'YES' : 'NO'}`);

    if (p.status === 'contacted' && !hasMessageId) {
      issues.push(`⚠️ Prospect ${p.first_name} ${p.last_name} marked contacted but no message ID`);
    }
  });
} else {
  console.log('⚠️ No recent campaign executions found');
}

// 4. CHECK API ROUTE
console.log('\n4️⃣ Checking campaign execution API...');
const apiCheck = await fetch('https://app.meet-sam.com/api/campaigns/linkedin/execute-live', {
  method: 'OPTIONS'
});
console.log(`   API endpoint status: ${apiCheck.status === 200 ? '✅ Reachable' : '❌ Not reachable'}`);

// 5. CHECK ENVIRONMENT VARIABLES
console.log('\n5️⃣ Checking environment variables...');
const requiredVars = {
  'N8N_API_KEY': N8N_KEY,
  'N8N_CAMPAIGN_WEBHOOK_URL': process.env.N8N_CAMPAIGN_WEBHOOK_URL,
  'UNIPILE_DSN': process.env.UNIPILE_DSN,
  'UNIPILE_API_KEY': process.env.UNIPILE_API_KEY
};

for (const [key, value] of Object.entries(requiredVars)) {
  if (value) {
    console.log(`   ✅ ${key}: Set`);
  } else {
    console.log(`   ❌ ${key}: MISSING`);
    issues.push(`❌ Missing environment variable: ${key}`);
    fixes.push(`→ Set ${key} in Netlify environment`);
  }
}

// SUMMARY
console.log('\n' + '━'.repeat(80));
console.log('📊 DIAGNOSIS SUMMARY');
console.log('━'.repeat(80));

if (issues.length === 0) {
  console.log('\n✅ ✅ ✅ ALL SYSTEMS OPERATIONAL!\n');
  console.log('Campaign messaging should be working. If not:');
  console.log('1. Check Netlify function logs for errors');
  console.log('2. Verify LinkedIn session is active in Unipile');
  console.log('3. Test with a single prospect campaign');
} else {
  console.log('\n❌ FOUND ISSUES:\n');
  issues.forEach(issue => console.log('   ' + issue));

  console.log('\n🔧 FIXES NEEDED:\n');
  fixes.forEach(fix => console.log('   ' + fix));
}

console.log('\n' + '━'.repeat(80));
console.log('🎯 NEXT STEPS:');
console.log('━'.repeat(80));
console.log('1. Fix the issues listed above');
console.log('2. Run a test campaign with 1 prospect');
console.log('3. Check N8N execution logs');
console.log('4. Verify message in LinkedIn');
console.log('');
