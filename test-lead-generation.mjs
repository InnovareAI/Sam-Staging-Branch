#!/usr/bin/env node

/**
 * SAM AI Lead Generation Process - Automated Test Suite
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const testResults = { passed: 0, failed: 0, skipped: 0, tests: [] };

function logTest(testId, testName, status, message = '') {
  testResults.tests.push({ id: testId, name: testName, status, message, timestamp: new Date().toISOString() });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${icon} ${testId}: ${testName}`);
  if (message) console.log(`   ${message}`);
  if (status === 'PASS') testResults.passed++;
  else if (status === 'FAIL') testResults.failed++;
  else testResults.skipped++;
}

async function testDatabaseConnectivity() {
  console.log('\n📊 PHASE 1: Database Connectivity Tests\n');
  
  try {
    const { error } = await supabase.from('customer_profile').select('count').limit(1);
    logTest('TC-091', 'Verify customer_profile table access', error ? 'FAIL' : 'PASS', error?.message || 'Table accessible');
  } catch (err) {
    logTest('TC-091', 'Verify customer_profile table access', 'FAIL', err.message);
  }
  
  try {
    const { error } = await supabase.from('campaigns').select('count').limit(1);
    logTest('TC-092', 'Check campaigns table operations', error ? 'FAIL' : 'PASS', error?.message || 'Table accessible');
  } catch (err) {
    logTest('TC-092', 'Check campaigns table operations', 'FAIL', err.message);
  }
  
  try {
    const { error } = await supabase.from('lead_profiles').select('count').limit(1);
    logTest('TC-093', 'Validate lead_profiles storage', error ? 'FAIL' : 'PASS', error?.message || 'Table accessible');
  } catch (err) {
    logTest('TC-093', 'Validate lead_profiles storage', 'FAIL', err.message);
  }
}

async function testOnboardingFlow() {
  console.log('\n🎯 PHASE 2: Onboarding Flow Tests\n');
  
  const testWorkspaceId = 'test-workspace-' + Date.now();
  const testUserId = 'test-user-' + Date.now();
  
  try {
    const businessContext = {
      workspace_id: testWorkspaceId,
      user_id: testUserId,
      industry: 'SaaS',
      business_description: 'AI-powered sales automation platform',
      business_model: 'B2B SaaS',
      company_size: '10-50',
      sales_team_size: '5',
      completed_stages: 1,
      stage_1_business_context: { industry: 'SaaS', description: 'AI-powered sales automation', model: 'B2B SaaS', size: '10-50', team: '5' }
    };
    
    const { data, error } = await supabase.from('customer_profile').insert(businessContext).select().single();
    
    if (error) {
      logTest('TC-001', 'Stage 1: Business Context Discovery', 'FAIL', error.message);
    } else {
      logTest('TC-001', 'Stage 1: Business Context Discovery', 'PASS', 'Business context saved');
      
      const icpData = { target_company_size: '50-200 employees', target_industries: ['SaaS', 'FinTech', 'HealthTech'], decision_makers: ['VP Sales', 'CRO', 'CEO'], geography: 'North America', pain_points: ['Manual prospecting', 'Low reply rates', 'High SDR costs'], buying_behavior: 'Annual budget cycles' };
      const { error: icpError } = await supabase.from('customer_profile').update({ completed_stages: 2, stage_2_icp: icpData }).eq('workspace_id', testWorkspaceId);
      logTest('TC-005', 'Stage 2: ICP Extraction', icpError ? 'FAIL' : 'PASS', icpError?.message || 'ICP data saved');
      
      const competitiveData = { direct_competitors: ['Outreach.io', 'SalesLoft', 'Apollo'], indirect_competitors: ['Manual SDRs', 'In-house tools'], differentiation: ['AI orchestration', 'Multi-agent system', 'Faster ROI'], value_proposition: 'Agentic outreach automation with 10x cost savings' };
      const { error: compError } = await supabase.from('customer_profile').update({ completed_stages: 3, stage_3_competitive: competitiveData }).eq('workspace_id', testWorkspaceId);
      logTest('TC-010', 'Stage 3: Competitive Intelligence', compError ? 'FAIL' : 'PASS', compError?.message || 'Competitive data saved');
      
      const salesProcessData = { lead_generation: ['LinkedIn', 'Cold email', 'Referrals'], outreach_methods: ['Manual outreach', 'Email sequences'], current_performance: { reply_rate: '15%', meeting_rate: '5%', cost_per_meeting: '$150' }, bottlenecks: ['Manual prospecting', 'Slow follow-up', 'Inconsistent messaging'] };
      const { error: salesError } = await supabase.from('customer_profile').update({ completed_stages: 4, stage_4_sales_process: salesProcessData }).eq('workspace_id', testWorkspaceId);
      logTest('TC-015', 'Stage 4: Sales Process Analysis', salesError ? 'FAIL' : 'PASS', salesError?.message || 'Sales process data saved');
      
      const successMetrics = { baseline: { reply_rate: '15%', meeting_rate: '5%', cost_per_meeting: '$150' }, targets: { reply_rate: '30%', meeting_rate: '15%', cost_per_meeting: '$50' }, timeline: '90 days', roi_expectations: '3x ROI' };
      const { error: metricsError } = await supabase.from('customer_profile').update({ completed_stages: 5, stage_5_success_metrics: successMetrics }).eq('workspace_id', testWorkspaceId);
      logTest('TC-020', 'Stage 5: Success Metrics', metricsError ? 'FAIL' : 'PASS', metricsError?.message || 'Success metrics saved');
      
      const techRequirements = { crm: 'HubSpot', email_platform: 'Gmail', sales_tools: ['LinkedIn Sales Navigator', 'Apollo'], integration_needs: ['CRM sync', 'Email tracking'], technical_constraints: [] };
      const { error: techError } = await supabase.from('customer_profile').update({ completed_stages: 6, stage_6_technical: techRequirements }).eq('workspace_id', testWorkspaceId);
      logTest('TC-025', 'Stage 6: Technical Requirements', techError ? 'FAIL' : 'PASS', techError?.message || 'Technical requirements saved');
      
      const contentData = { sales_materials: ['Sales deck', 'Case studies', 'Product demo'], brand_voice: 'Professional, consultative, data-driven', successful_content: ['ROI calculator', 'Comparison guide'], messaging_framework: 'Value-based selling' };
      const { error: contentError } = await supabase.from('customer_profile').update({ completed_stages: 7, stage_7_content: contentData, onboarding_complete: true }).eq('workspace_id', testWorkspaceId);
      logTest('TC-030', 'Stage 7: Content Collection', contentError ? 'FAIL' : 'PASS', contentError?.message || 'Content data saved - Onboarding complete!');
      
      await supabase.from('customer_profile').delete().eq('workspace_id', testWorkspaceId);
    }
  } catch (err) {
    logTest('TC-001', 'Stage 1: Business Context Discovery', 'FAIL', err.message);
  }
}

async function testCampaignCreation() {
  console.log('\n🚀 PHASE 3: Campaign Creation Tests\n');
  
  const testWorkspaceId = 'test-workspace-' + Date.now();
  const testUserId = 'test-user-' + Date.now();
  
  try {
    const campaignData = {
      workspace_id: testWorkspaceId,
      user_id: testUserId,
      name: 'Test Campaign - Lead Discovery',
      description: 'Testing lead discovery agent deployment',
      status: 'draft',
      target_audience: { industries: ['SaaS', 'FinTech'], company_size: '50-200', decision_makers: ['VP Sales', 'CRO'] },
      messaging: { value_proposition: 'AI-powered sales automation', pain_points: ['Manual prospecting', 'Low reply rates'], differentiation: ['10x cost savings', 'Faster ROI'] },
      channels: ['linkedin', 'email'],
      created_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase.from('campaigns').insert(campaignData).select().single();
    
    if (error) {
      logTest('TC-124', 'Create new campaign', 'FAIL', error.message);
    } else {
      logTest('TC-124', 'Create new campaign', 'PASS', `Campaign created: ${data.id}`);
      await supabase.from('campaigns').delete().eq('id', data.id);
    }
  } catch (err) {
    logTest('TC-124', 'Create new campaign', 'FAIL', err.message);
  }
}

async function testLeadEnrichment() {
  console.log('\n💎 PHASE 4: Lead Enrichment Tests\n');
  
  logTest('TC-083', 'Test BrightData integration', 'SKIP', 'Requires API key');
  logTest('TC-084', 'Test Apollo.io integration', 'SKIP', 'Requires API key');
  logTest('TC-085', 'Test ZoomInfo integration', 'SKIP', 'Requires API key');
  logTest('TC-086', 'Test Hunter.io integration', 'SKIP', 'Requires API key');
  
  try {
    const { error } = await supabase.from('enrichment_cache').select('count').limit(1);
    logTest('TC-088', 'Check cache functionality', (error && error.code !== 'PGRST116') ? 'FAIL' : 'PASS', error?.message || 'Cache table accessible');
  } catch (err) {
    logTest('TC-088', 'Check cache functionality', 'FAIL', err.message);
  }
}

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   SAM AI Lead Generation Process - Test Suite             ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n🕐 Started: ${new Date().toLocaleString()}\n`);
  
  await testDatabaseConnectivity();
  await testOnboardingFlow();
  await testCampaignCreation();
  await testLeadEnrichment();
  
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                     TEST SUMMARY                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log(`✅ Passed:  ${testResults.passed}`);
  console.log(`❌ Failed:  ${testResults.failed}`);
  console.log(`⏭️  Skipped: ${testResults.skipped}`);
  console.log(`📊 Total:   ${testResults.tests.length}`);
  
  const passRate = ((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1);
  console.log(`\n📈 Pass Rate: ${passRate}%`);
  console.log(`\n🕐 Completed: ${new Date().toLocaleString()}\n`);
  
  process.exit(testResults.failed > 0 ? 1 : 0);
}

runAllTests().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
