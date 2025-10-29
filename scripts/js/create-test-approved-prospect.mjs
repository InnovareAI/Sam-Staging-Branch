#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🧪 Creating test approved prospect\n');

// Get workspace and user
const { data: user } = await supabase
  .from('users')
  .select('id, current_workspace_id')
  .eq('email', 'tl@innovareai.com')
  .single();

if (!user) {
  console.error('❌ User not found');
  process.exit(1);
}

console.log(`User: ${user.id}`);
console.log(`Workspace: ${user.current_workspace_id}\n`);

// Create or get session
const { data: session, error: sessionError } = await supabase
  .from('prospect_approval_sessions')
  .insert({
    batch_number: Math.floor(Math.random() * 100000),
    workspace_id: user.current_workspace_id,
    user_id: user.id,
    campaign_name: 'Test Campaign - Do Not Delete',
    campaign_tag: 'test-campaign',
    prospect_source: 'manual-test',
    total_prospects: 2,
    pending_count: 0,
    approved_count: 2,
    status: 'active'
  })
  .select()
  .single();

if (sessionError) {
  console.error('❌ Error creating session:', sessionError);
  process.exit(1);
}

console.log(`✅ Created session: ${session.id}\n`);

// Create 2 test prospects
const testProspects = [
  {
    session_id: session.id,
    prospect_id: `test_${Date.now()}_1`,
    name: 'John Test Prospect',
    title: 'CEO',
    company: { name: 'Test Company Inc', industry: ['Technology'] },
    location: 'San Francisco, CA',
    contact: {
      email: 'john@testcompany.com',
      linkedin_url: 'https://linkedin.com/in/johntest'
    },
    connection_degree: 2,
    enrichment_score: 85,
    source: 'manual-test',
    approval_status: 'approved'
  },
  {
    session_id: session.id,
    prospect_id: `test_${Date.now()}_2`,
    name: 'Sarah Test Prospect',
    title: 'VP of Sales',
    company: { name: 'Demo Corp', industry: ['SaaS'] },
    location: 'New York, NY',
    contact: {
      email: 'sarah@democorp.com',
      linkedin_url: 'https://linkedin.com/in/sarahtest'
    },
    connection_degree: 2,
    enrichment_score: 90,
    source: 'manual-test',
    approval_status: 'approved'
  }
];

const { data: prospects, error: prospectError } = await supabase
  .from('prospect_approval_data')
  .insert(testProspects)
  .select();

if (prospectError) {
  console.error('❌ Error creating prospects:', prospectError);
  process.exit(1);
}

console.log(`✅ Created ${prospects.length} test prospects:\n`);
prospects.forEach((p, i) => {
  console.log(`${i + 1}. ${p.name}`);
  console.log(`   Company: ${p.company.name}`);
  console.log(`   LinkedIn: ${p.contact.linkedin_url}`);
  console.log(`   prospect_id: ${p.prospect_id}\n`);
});

console.log('\n✅ Test data created!');
console.log('\n💡 Next steps:');
console.log('   1. Open Campaign Hub in browser');
console.log('   2. Look for "Test Campaign - Do Not Delete"');
console.log('   3. Create campaign with these prospects');
console.log('   4. Check if they get added to campaign_prospects with LinkedIn URLs\n');
