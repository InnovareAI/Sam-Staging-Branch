#!/usr/bin/env node

/**
 * Execute: Add 5 prospects to JF's campaign via bypass endpoint
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

async function addProspects() {
  try {
    console.log('🚀 Adding 5 prospects to campaign:', campaignId);
    console.log('📧 Prospects:', prospects.map(p => `${p.first_name} ${p.last_name} (${p.email})`).join('\n   '));

    // Get Supabase session to authenticate
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Sign in as JF
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'jf@innovareai.com',
      password: 'TestDemo2024!'
    });

    if (authError) {
      console.error('❌ Auth error:', authError.message);
      return;
    }

    console.log('✅ Authenticated as:', authData.user.email);

    // Call bypass endpoint
    const response = await fetch(`${apiUrl}/api/campaigns/${campaignId}/add-prospects-direct`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authData.session.access_token}`
      },
      body: JSON.stringify({ prospects })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ API error:', result);
      return;
    }

    console.log('✅ Success!', result);
    console.log(`\n📊 Added ${result.added_count} prospects to campaign`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

addProspects();
