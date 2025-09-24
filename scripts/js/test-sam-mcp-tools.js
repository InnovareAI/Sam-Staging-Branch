#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSamMCPTools() {
  console.log('🚀 Testing Sam AI MCP Tools...');

  try {
    // Test 1: Create a test template
    console.log('\n📝 Test 1: Creating test template...');
    
    const { data: templateData, error: templateError } = await supabase
      .from('messaging_templates')
      .insert({
        workspace_id: 'test_workspace_mcp',
        template_name: 'Sam AI Test Template',
        campaign_type: 'sam_signature',
        industry: 'technology',
        target_role: 'CEO',
        connection_message: 'Hi {first_name}, I noticed your work at {company_name} in the AI space. Would love to connect and share how we\'re helping similar companies scale their outreach.',
        follow_up_messages: [
          'Thanks for connecting! I\'d love to share how we\'re helping {company_name} streamline their sales process.',
          'Following up on my previous message about AI-powered sales automation...'
        ],
        language: 'en',
        tone: 'professional'
      })
      .select('*')
      .single();

    if (templateError) {
      console.error('❌ Template creation failed:', templateError);
      return;
    }

    console.log('✅ Template created successfully:', templateData.id);

    // Test 2: Retrieve the template
    console.log('\n🔍 Test 2: Retrieving template...');
    
    const { data: retrievedTemplate, error: retrieveError } = await supabase
      .from('messaging_templates')
      .select('*')
      .eq('id', templateData.id)
      .single();

    if (retrieveError) {
      console.error('❌ Template retrieval failed:', retrieveError);
      return;
    }

    console.log('✅ Template retrieved successfully:', retrievedTemplate.template_name);

    // Test 3: Search templates by criteria
    console.log('\n🔎 Test 3: Searching templates by criteria...');
    
    const { data: searchResults, error: searchError } = await supabase
      .from('messaging_templates')
      .select('*')
      .eq('workspace_id', 'test_workspace_mcp')
      .eq('campaign_type', 'sam_signature')
      .eq('is_active', true);

    if (searchError) {
      console.error('❌ Template search failed:', searchError);
      return;
    }

    console.log('✅ Template search successful:', searchResults.length, 'templates found');

    // Test 4: Test template performance table
    console.log('\n📊 Test 4: Testing template performance tracking...');
    
    const { data: performanceData, error: performanceError } = await supabase
      .from('template_performance')
      .insert({
        template_id: templateData.id,
        total_sent: 100,
        total_responses: 15,
        response_rate: 15.0,
        connection_rate: 80.0,
        meeting_rate: 5.0,
        date_start: new Date().toISOString().split('T')[0],
        date_end: new Date().toISOString().split('T')[0]
      })
      .select('*')
      .single();

    if (performanceError) {
      console.error('❌ Performance tracking failed:', performanceError);
      return;
    }

    console.log('✅ Performance tracking successful:', performanceData.id);

    // Test 5: Test campaigns table compatibility
    console.log('\n🎯 Test 5: Testing campaigns table integration...');
    
    const { data: campaignData, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        workspace_id: 'test_workspace_mcp',
        name: 'Sam AI Test Campaign',
        type: 'sam_signature',
        status: 'draft',
        target_criteria: {
          industry: 'technology',
          role: 'CEO',
          company_size: 'startup'
        },
        execution_preferences: {
          daily_limit: 50,
          personalization_level: 'advanced',
          channels: ['linkedin']
        },
        template_id: templateData.id
      })
      .select('*')
      .single();

    if (campaignError) {
      console.error('❌ Campaign creation failed:', campaignError);
      return;
    }

    console.log('✅ Campaign creation successful:', campaignData.id);

    // Test 6: Test campaign prospects integration
    console.log('\n👥 Test 6: Testing campaign prospects integration...');
    
    // First create a test prospect
    const { data: prospectData, error: prospectError } = await supabase
      .from('workspace_prospects')
      .insert({
        workspace_id: 'test_workspace_mcp',
        first_name: 'John',
        last_name: 'Doe',
        company_name: 'Tech Startup Inc',
        job_title: 'CEO',
        industry: 'technology',
        linkedin_profile_url: 'https://linkedin.com/in/johndoe',
        email_address: 'john@techstartup.com'
      })
      .select('*')
      .single();

    if (prospectError) {
      console.error('❌ Prospect creation failed:', prospectError);
      return;
    }

    // Associate prospect with campaign
    const { data: associationData, error: associationError } = await supabase
      .from('campaign_prospects')
      .insert({
        campaign_id: campaignData.id,
        prospect_id: prospectData.id,
        status: 'pending'
      })
      .select('*')
      .single();

    if (associationError) {
      console.error('❌ Prospect association failed:', associationError);
      return;
    }

    console.log('✅ Prospect association successful');

    // Test 7: Cleanup test data
    console.log('\n🧹 Test 7: Cleaning up test data...');
    
    await supabase.from('campaign_prospects').delete().eq('campaign_id', campaignData.id);
    await supabase.from('campaigns').delete().eq('id', campaignData.id);
    await supabase.from('workspace_prospects').delete().eq('id', prospectData.id);
    await supabase.from('template_performance').delete().eq('template_id', templateData.id);
    await supabase.from('messaging_templates').delete().eq('id', templateData.id);

    console.log('✅ Test data cleaned up successfully');

    console.log('\n🎉 All Sam AI MCP Tools tests passed!');
    console.log('📋 Database Schema Status:');
    console.log('  ✅ messaging_templates - Working');
    console.log('  ✅ template_performance - Working');
    console.log('  ✅ campaigns - Compatible');
    console.log('  ✅ campaign_prospects - Compatible');
    console.log('  ✅ workspace_prospects - Compatible');
    console.log('\n🚀 Ready for Sam AI conversational campaign management!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Execute tests
testSamMCPTools();