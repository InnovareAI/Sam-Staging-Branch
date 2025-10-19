#!/usr/bin/env node

/**
 * Test All Search Routing Scenarios
 * Shows what happens with different LinkedIn account types
 */

console.log(`
╔══════════════════════════════════════════════════════════════╗
║         COST-OPTIMIZED ROUTING - ALL SCENARIOS TEST          ║
╚══════════════════════════════════════════════════════════════╝
`);

const scenarios = [
  {
    name: 'Sales Navigator - 2nd Degree (No Emails)',
    accountType: 'sales_navigator',
    connectionDegree: '2nd',
    needsEmails: false,
    expectedProvider: 'unipile',
    expectedCost: 'FREE',
    reasoning: 'Sales Nav can search all degrees via Unipile for FREE'
  },
  {
    name: 'Sales Navigator - 2nd Degree (With Emails)',
    accountType: 'sales_navigator',
    connectionDegree: '2nd',
    needsEmails: true,
    expectedProvider: 'unipile + brightdata',
    expectedCost: 'FREE search + PAID enrichment',
    reasoning: 'LinkedIn doesn\'t provide emails - need BrightData enrichment'
  },
  {
    name: 'Sales Navigator - 1st Degree',
    accountType: 'sales_navigator',
    connectionDegree: '1st',
    needsEmails: false,
    expectedProvider: 'unipile',
    expectedCost: 'FREE',
    reasoning: 'Sales Nav can search 1st degree connections via Unipile'
  },
  {
    name: 'Premium - 2nd Degree (No Emails)',
    accountType: 'premium_career',
    connectionDegree: '2nd',
    needsEmails: false,
    expectedProvider: 'unipile',
    expectedCost: 'FREE',
    reasoning: 'Premium can use Unipile for 2nd/3rd degree'
  },
  {
    name: 'Premium - 1st Degree (No Emails)',
    accountType: 'premium_career',
    connectionDegree: '1st',
    needsEmails: false,
    expectedProvider: 'brightdata',
    expectedCost: 'PAID',
    reasoning: '1st degree uses different LinkedIn URL (My Network page) - requires BrightData'
  },
  {
    name: 'Premium - 2nd Degree (With Emails)',
    accountType: 'premium_career',
    connectionDegree: '2nd',
    needsEmails: true,
    expectedProvider: 'unipile + brightdata',
    expectedCost: 'FREE search + PAID enrichment',
    reasoning: 'Search via Unipile (FREE), then enrich emails via BrightData (PAID)'
  },
  {
    name: 'Classic - 2nd Degree',
    accountType: 'classic',
    connectionDegree: '2nd',
    needsEmails: false,
    expectedProvider: 'brightdata',
    expectedCost: 'PAID',
    reasoning: 'Classic LinkedIn has severe search limits - use BrightData'
  },
  {
    name: 'Classic - 2nd Degree (With Emails)',
    accountType: 'classic',
    connectionDegree: '2nd',
    needsEmails: true,
    expectedProvider: 'brightdata',
    expectedCost: 'PAID (emails included)',
    reasoning: 'Already using BrightData for search - emails included at no extra cost'
  }
];

console.log('┌─────────────────────────────────────────────────────────────┐');
console.log('│ SCENARIO                          │ PROVIDER     │ COST      │');
console.log('├─────────────────────────────────────────────────────────────┤');

scenarios.forEach(scenario => {
  const name = scenario.name.padEnd(33);
  const provider = scenario.expectedProvider.padEnd(12);
  const cost = scenario.expectedCost.padEnd(9);
  console.log(`│ ${name} │ ${provider} │ ${cost} │`);
});

console.log('└─────────────────────────────────────────────────────────────┘');

console.log('\n' + '═'.repeat(65));
console.log('DETAILED SCENARIO EXPLANATIONS:');
console.log('═'.repeat(65) + '\n');

scenarios.forEach((scenario, i) => {
  console.log(`${i + 1}. ${scenario.name}`);
  console.log(`   Account: ${scenario.accountType}`);
  console.log(`   Connection: ${scenario.connectionDegree}`);
  console.log(`   Needs Emails: ${scenario.needsEmails ? 'Yes' : 'No'}`);
  console.log(`   → Provider: ${scenario.expectedProvider}`);
  console.log(`   → Cost: ${scenario.expectedCost}`);
  console.log(`   💡 ${scenario.reasoning}`);
  console.log('');
});

console.log('═'.repeat(65));
console.log('YOUR ACCOUNT (Sales Navigator):');
console.log('═'.repeat(65));
console.log(`
✅ All searches: FREE (via Unipile)
✅ All connection degrees: FREE (1st, 2nd, 3rd)
⚠️  Email enrichment: PAID (BrightData only if needed)

Your Cost Savings:
- 100% FREE for LinkedIn profile searches
- 67% savings if you need emails (vs full BrightData)
- Unlimited searches (no per-prospect cost)

Example Costs (20 prospects):
- Search only: $0 (Unipile)
- Search + emails: ~$25 (Unipile FREE + BrightData emails)
- Full BrightData: ~$75 (if you had Classic account)
`);

console.log('═'.repeat(65));
console.log('TO TEST YOUR ACTUAL ROUTING:');
console.log('═'.repeat(65));
console.log(`
Run in browser console (while logged in):

// Test FREE search (your normal use case)
fetch('/api/linkedin/search-router', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    search_criteria: {
      title: 'CEO',
      keywords: 'startup',
      location: 'Seattle',
      connectionDegree: '2nd'
    },
    target_count: 10,
    needs_emails: false
  })
}).then(r => r.json()).then(data => {
  console.log('Provider:', data.routing_info?.search_provider); // "unipile"
  console.log('Cost:', data.cost_breakdown); // { unipile_search: "FREE" }
});

// Test with email enrichment (to see BrightData integration)
fetch('/api/linkedin/search-router', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    search_criteria: {
      title: 'CEO',
      keywords: 'startup',
      location: 'Seattle',
      connectionDegree: '2nd'
    },
    target_count: 10,
    needs_emails: true  // ← This triggers BrightData enrichment
  })
}).then(r => r.json()).then(data => {
  console.log('Provider:', data.routing_info?.search_provider); // "unipile"
  console.log('Enrichment:', data.email_enrichment); // "brightdata"
  console.log('Cost:', data.cost_breakdown);
  // { unipile_search: "FREE", brightdata_enrichment: "PAID" }
});
`);

console.log('═'.repeat(65));
