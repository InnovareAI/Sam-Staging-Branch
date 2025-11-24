#!/usr/bin/env node

/**
 * Emergency script: Add 5 test prospects to JF's campaign
 * Campaign ID: 32aac815-cbde-43bf-977b-3e51c5c4133b
 */

const campaignId = '32aac815-cbde-43bf-977b-3e51c5c4133b';
const apiUrl = 'https://app.meet-sam.com';

// Test prospects
const prospects = [
  {
    first_name: 'Sarah',
    last_name: 'Johnson',
    email: 'sarah.johnson@techstartup.com',
    company_name: 'TechStartup Inc',
    title: 'CEO',
    location: 'San Francisco, CA'
  },
  {
    first_name: 'Michael',
    last_name: 'Chen',
    email: 'michael.chen@innovate.io',
    company_name: 'Innovate.io',
    title: 'VP of Sales',
    location: 'New York, NY'
  },
  {
    first_name: 'Emily',
    last_name: 'Rodriguez',
    email: 'emily.rodriguez@growth.co',
    company_name: 'Growth Co',
    title: 'Head of Marketing',
    location: 'Austin, TX'
  },
  {
    first_name: 'David',
    last_name: 'Kim',
    email: 'david.kim@scaleup.com',
    company_name: 'ScaleUp',
    title: 'Founder',
    location: 'Los Angeles, CA'
  },
  {
    first_name: 'Lisa',
    last_name: 'Williams',
    email: 'lisa.williams@venture.ai',
    company_name: 'Venture AI',
    title: 'CTO',
    location: 'Seattle, WA'
  }
];

console.log('🚀 Adding 5 prospects to campaign:', campaignId);
console.log('📧 Prospects:', prospects.map(p => `${p.first_name} ${p.last_name} (${p.email})`).join('\n   '));
console.log('\n⚠️  This script requires authentication. Please run from authenticated context.');
console.log('\n📋 cURL command to run manually:');
console.log(`
curl -X POST ${apiUrl}/api/campaigns/${campaignId}/add-prospects-direct \\
  -H "Content-Type: application/json" \\
  -H "Cookie: <your-auth-cookie>" \\
  -d '${JSON.stringify({ prospects }, null, 2)}'
`);

console.log('\n✅ Bypass endpoint created: /api/campaigns/[id]/add-prospects-direct');
console.log('📖 Usage: POST with { prospects: [...] } in body');
