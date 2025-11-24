#!/usr/bin/env node

/**
 * Direct database insert: Add 5 prospects to JF's campaign
 * Campaign ID: 32aac815-cbde-43bf-977b-3e51c5c4133b
 *
 * Uses Supabase service role key to bypass auth
 */

import { createClient } from '@supabase/supabase-js';

const campaignId = '32aac815-cbde-43bf-977b-3e51c5c4133b';
const workspaceId = 'cd57981a-e63b-401c-bde1-ac71752c2293'; // IA5 workspace

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

async function addProspectsDirectly() {
  try {
    console.log('🚀 Adding 5 prospects to campaign:', campaignId);
    console.log('📧 Prospects:', prospects.map(p => `${p.first_name} ${p.last_name} (${p.email})`).join('\n   '));

    // Create Supabase client with service role key (bypasses RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Transform prospects to campaign_prospects format
    const campaignProspects = prospects.map(prospect => ({
      campaign_id: campaignId,
      workspace_id: workspaceId,
      first_name: prospect.first_name || 'Unknown',
      last_name: prospect.last_name || 'Unknown',
      email: prospect.email,
      company_name: prospect.company_name || '',
      title: prospect.title || '',
      location: prospect.location || null,
      industry: 'Not specified',
      status: 'pending',
      notes: null,
      linkedin_url: null,
      linkedin_user_id: null,
      added_by_unipile_account: null,
      personalization_data: {
        source: 'direct_upload',
        added_at: new Date().toISOString()
      }
    }));

    console.log('\n📝 Inserting prospects into campaign_prospects table...');

    // Insert into campaign_prospects
    const { data: insertedProspects, error: insertError } = await supabase
      .from('campaign_prospects')
      .insert(campaignProspects)
      .select();

    if (insertError) {
      console.error('❌ Insert error:', insertError);
      return;
    }

    console.log('✅ Success! Inserted', insertedProspects.length, 'prospects');
    console.log('\n📊 Prospect IDs:');
    insertedProspects.forEach(p => {
      console.log(`   ${p.first_name} ${p.last_name}: ${p.id}`);
    });

    // Verify the insert
    const { count, error: countError } = await supabase
      .from('campaign_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId);

    if (!countError) {
      console.log(`\n✅ Verification: Campaign now has ${count} prospects`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

addProspectsDirectly();
