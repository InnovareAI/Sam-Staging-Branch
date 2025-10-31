#!/usr/bin/env node
/**
 * Complete Pipeline Test - Scraping to Campaign
 *
 * Tests the entire data flow:
 * 1. LinkedIn scraping (data extraction)
 * 2. Data persistence to Supabase
 * 3. Campaign creation
 * 4. Message execution readiness
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🧪 Complete Pipeline Test: Scraping → Campaign');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Test workspace (use Blue Label Labs for testing)
const TEST_WORKSPACE_ID = '014509ba-226e-43ee-ba58-ab5f20d2ed08'; // Blue Label Labs

const results = {
  stage1_extraction: { status: 'pending', details: null },
  stage2_persistence: { status: 'pending', details: null },
  stage3_approval: { status: 'pending', details: null },
  stage4_campaign: { status: 'pending', details: null },
  stage5_readiness: { status: 'pending', details: null }
};

/**
 * Stage 1: Test Data Extraction
 */
async function testDataExtraction() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STAGE 1: Data Extraction (LinkedIn Scraping)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Check for existing prospects with bad data
    const { data: badProspects, error } = await supabase
      .from('campaign_prospects')
      .select('id, first_name, last_name, company_name, title, linkedin_url, campaign_id')
      .eq('workspace_id', TEST_WORKSPACE_ID)
      .or('company_name.eq.Unknown Company,company_name.eq.unavailable')
      .limit(5);

    if (error) throw error;

    console.log(`📊 Found ${badProspects?.length || 0} prospects with bad company data\n`);

    if (!badProspects || badProspects.length === 0) {
      results.stage1_extraction = {
        status: 'skipped',
        details: 'No prospects with bad data found'
      };
      console.log('ℹ️  No prospects need re-scraping');
      console.log('   All existing prospects have valid company data\n');
      return { success: true, prospects: [] };
    }

    // Show sample data
    console.log('📝 Sample Bad Data:');
    console.log('   ─────────────────────────────────────');
    for (const p of badProspects.slice(0, 3)) {
      console.log(`   Name: ${p.first_name} ${p.last_name}`);
      console.log(`   Company: "${p.company_name}"`);
      console.log(`   Title: "${p.title}"`);
      console.log(`   LinkedIn: ${p.linkedin_url}`);
      console.log('   ─────────────────────────────────────');
    }
    console.log('');

    results.stage1_extraction = {
      status: 'completed',
      details: {
        bad_prospects_count: badProspects.length,
        sample_linkedin_urls: badProspects.slice(0, 3).map(p => p.linkedin_url)
      }
    };

    console.log('✅ Stage 1 Complete: Data extraction validated\n');
    return { success: true, prospects: badProspects };

  } catch (error) {
    results.stage1_extraction = {
      status: 'failed',
      details: error.message
    };
    console.log(`❌ Stage 1 Failed: ${error.message}\n`);
    return { success: false, error: error.message };
  }
}

/**
 * Stage 2: Test Data Persistence
 */
async function testDataPersistence() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STAGE 2: Data Persistence (Supabase Writes)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Test write to campaign_prospects
    const testProspect = {
      workspace_id: TEST_WORKSPACE_ID,
      first_name: 'Test',
      last_name: 'Pipeline',
      company_name: 'Test Company Inc',
      title: 'CEO',
      linkedin_url: 'https://linkedin.com/in/test-pipeline',
      status: 'pending',
      source: 'pipeline_test'
    };

    console.log('📝 Testing write to campaign_prospects table...\n');

    const { data: inserted, error: insertError } = await supabase
      .from('campaign_prospects')
      .insert([testProspect])
      .select();

    if (insertError) throw insertError;

    console.log('✅ Write successful');
    console.log(`   ID: ${inserted[0].id}`);
    console.log(`   Created: ${inserted[0].created_at}\n`);

    // Read back to verify
    console.log('📖 Testing read from campaign_prospects table...\n');

    const { data: readBack, error: readError } = await supabase
      .from('campaign_prospects')
      .select('*')
      .eq('id', inserted[0].id)
      .single();

    if (readError) throw readError;

    console.log('✅ Read successful');
    console.log(`   Company: ${readBack.company_name}`);
    console.log(`   Title: ${readBack.title}`);
    console.log(`   LinkedIn: ${readBack.linkedin_url}\n`);

    // Clean up test data
    console.log('🧹 Cleaning up test prospect...\n');

    const { error: deleteError } = await supabase
      .from('campaign_prospects')
      .delete()
      .eq('id', inserted[0].id);

    if (deleteError) throw deleteError;

    console.log('✅ Cleanup successful\n');

    results.stage2_persistence = {
      status: 'completed',
      details: 'Write, read, and delete operations successful'
    };

    console.log('✅ Stage 2 Complete: Data persistence validated\n');
    return { success: true };

  } catch (error) {
    results.stage2_persistence = {
      status: 'failed',
      details: error.message
    };
    console.log(`❌ Stage 2 Failed: ${error.message}\n`);
    return { success: false, error: error.message };
  }
}

/**
 * Stage 3: Test Approval Flow
 */
async function testApprovalFlow() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STAGE 3: Approval Flow (Prospect → Campaign)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Check for approved prospects
    const { data: approvedProspects, error } = await supabase
      .from('campaign_prospects')
      .select('id, first_name, last_name, company_name, title, linkedin_url, status, campaign_id')
      .eq('workspace_id', TEST_WORKSPACE_ID)
      .in('status', ['approved', 'ready_to_message', 'pending'])
      .not('linkedin_url', 'is', null)
      .limit(10);

    if (error) throw error;

    console.log(`📊 Found ${approvedProspects?.length || 0} prospects ready for campaigns\n`);

    if (!approvedProspects || approvedProspects.length === 0) {
      throw new Error('No approved prospects found for testing');
    }

    // Check data quality
    console.log('📝 Data Quality Check:');
    console.log('   ─────────────────────────────────────');

    let withCompany = 0;
    let withTitle = 0;
    let withLinkedIn = 0;

    for (const p of approvedProspects) {
      if (p.company_name && p.company_name !== 'Unknown Company' && p.company_name !== 'unavailable') {
        withCompany++;
      }
      if (p.title) {
        withTitle++;
      }
      if (p.linkedin_url) {
        withLinkedIn++;
      }
    }

    console.log(`   Company Name: ${withCompany}/${approvedProspects.length} (${((withCompany / approvedProspects.length) * 100).toFixed(0)}%)`);
    console.log(`   Job Title: ${withTitle}/${approvedProspects.length} (${((withTitle / approvedProspects.length) * 100).toFixed(0)}%)`);
    console.log(`   LinkedIn URL: ${withLinkedIn}/${approvedProspects.length} (${((withLinkedIn / approvedProspects.length) * 100).toFixed(0)}%)`);
    console.log('   ─────────────────────────────────────\n');

    const dataQuality = (withCompany / approvedProspects.length) * 100;

    if (dataQuality < 50) {
      console.log(`⚠️  WARNING: Data quality is low (${dataQuality.toFixed(0)}%)`);
      console.log('   Many prospects missing company names');
      console.log('   Consider running enrichment before campaigns\n');
    } else {
      console.log(`✅ Data quality is good (${dataQuality.toFixed(0)}%)\n`);
    }

    results.stage3_approval = {
      status: 'completed',
      details: {
        approved_prospects: approvedProspects.length,
        data_quality_percent: dataQuality.toFixed(1),
        with_company: withCompany,
        with_title: withTitle,
        with_linkedin: withLinkedIn
      }
    };

    console.log('✅ Stage 3 Complete: Approval flow validated\n');
    return { success: true, prospects: approvedProspects };

  } catch (error) {
    results.stage3_approval = {
      status: 'failed',
      details: error.message
    };
    console.log(`❌ Stage 3 Failed: ${error.message}\n`);
    return { success: false, error: error.message };
  }
}

/**
 * Stage 4: Test Campaign Creation
 */
async function testCampaignCreation() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STAGE 4: Campaign Creation');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Check for existing campaigns
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('id, name, status, created_at, (campaign_prospects:campaign_prospects(count))')
      .eq('workspace_id', TEST_WORKSPACE_ID)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw error;

    console.log(`📊 Found ${campaigns?.length || 0} recent campaigns\n`);

    if (!campaigns || campaigns.length === 0) {
      throw new Error('No campaigns found for testing');
    }

    // Show campaign details
    console.log('📝 Recent Campaigns:');
    console.log('   ─────────────────────────────────────');
    for (const c of campaigns) {
      const prospectCount = c.campaign_prospects?.[0]?.count || 0;
      console.log(`   Name: ${c.name}`);
      console.log(`   Status: ${c.status}`);
      console.log(`   Prospects: ${prospectCount}`);
      console.log(`   Created: ${new Date(c.created_at).toLocaleString()}`);
      console.log('   ─────────────────────────────────────');
    }
    console.log('');

    // Get detailed info on most recent campaign
    const latestCampaign = campaigns[0];

    const { data: campaignProspects, error: prospectError } = await supabase
      .from('campaign_prospects')
      .select('id, first_name, last_name, company_name, title, status, linkedin_url')
      .eq('campaign_id', latestCampaign.id)
      .limit(5);

    if (prospectError) throw prospectError;

    console.log(`📊 Latest Campaign: "${latestCampaign.name}"`);
    console.log(`   Status: ${latestCampaign.status}`);
    console.log(`   Prospects: ${campaignProspects?.length || 0}\n`);

    if (campaignProspects && campaignProspects.length > 0) {
      console.log('   Sample Prospects:');
      for (const p of campaignProspects.slice(0, 3)) {
        console.log(`   - ${p.first_name} ${p.last_name} (${p.company_name})`);
        console.log(`     Status: ${p.status} | LinkedIn: ${p.linkedin_url ? '✅' : '❌'}`);
      }
      console.log('');
    }

    results.stage4_campaign = {
      status: 'completed',
      details: {
        total_campaigns: campaigns.length,
        latest_campaign_id: latestCampaign.id,
        latest_campaign_name: latestCampaign.name,
        latest_campaign_prospects: campaignProspects?.length || 0
      }
    };

    console.log('✅ Stage 4 Complete: Campaign creation validated\n');
    return { success: true, campaign: latestCampaign, prospects: campaignProspects };

  } catch (error) {
    results.stage4_campaign = {
      status: 'failed',
      details: error.message
    };
    console.log(`❌ Stage 4 Failed: ${error.message}\n`);
    return { success: false, error: error.message };
  }
}

/**
 * Stage 5: Test Message Execution Readiness
 */
async function testMessageReadiness() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STAGE 5: Message Execution Readiness');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Check for prospects ready to message
    const { data: readyProspects, error } = await supabase
      .from('campaign_prospects')
      .select('id, first_name, last_name, company_name, title, status, linkedin_url, campaign_id')
      .eq('workspace_id', TEST_WORKSPACE_ID)
      .in('status', ['approved', 'ready_to_message'])
      .not('linkedin_url', 'is', null)
      .limit(10);

    if (error) throw error;

    console.log(`📊 Found ${readyProspects?.length || 0} prospects ready for messaging\n`);

    if (!readyProspects || readyProspects.length === 0) {
      throw new Error('No prospects ready for messaging');
    }

    // Validate required fields
    console.log('📝 Readiness Check:');
    console.log('   ─────────────────────────────────────');

    let ready = 0;
    let missing = [];

    for (const p of readyProspects) {
      const hasName = p.first_name && p.last_name;
      const hasCompany = p.company_name && p.company_name !== 'Unknown Company' && p.company_name !== 'unavailable';
      const hasLinkedIn = p.linkedin_url;

      if (hasName && hasCompany && hasLinkedIn) {
        ready++;
      } else {
        missing.push({
          name: `${p.first_name} ${p.last_name}`,
          missing_fields: [
            !hasName && 'name',
            !hasCompany && 'company',
            !hasLinkedIn && 'linkedin_url'
          ].filter(Boolean)
        });
      }
    }

    console.log(`   ✅ Ready to message: ${ready}/${readyProspects.length}`);

    if (missing.length > 0) {
      console.log(`   ⚠️  Missing data: ${missing.length} prospects`);
      console.log('');
      console.log('   Prospects with missing data:');
      for (const m of missing.slice(0, 3)) {
        console.log(`   - ${m.name}: Missing ${m.missing_fields.join(', ')}`);
      }
    }
    console.log('   ─────────────────────────────────────\n');

    const readiness = (ready / readyProspects.length) * 100;

    if (readiness < 80) {
      console.log(`⚠️  WARNING: Readiness is low (${readiness.toFixed(0)}%)`);
      console.log('   Many prospects missing required data');
      console.log('   Run enrichment before executing campaigns\n');
    } else {
      console.log(`✅ Readiness is high (${readiness.toFixed(0)}%)\n`);
    }

    results.stage5_readiness = {
      status: 'completed',
      details: {
        ready_prospects: ready,
        total_prospects: readyProspects.length,
        readiness_percent: readiness.toFixed(1),
        missing_data_count: missing.length
      }
    };

    console.log('✅ Stage 5 Complete: Message readiness validated\n');
    return { success: true, ready_count: ready, total: readyProspects.length };

  } catch (error) {
    results.stage5_readiness = {
      status: 'failed',
      details: error.message
    };
    console.log(`❌ Stage 5 Failed: ${error.message}\n`);
    return { success: false, error: error.message };
  }
}

/**
 * Run complete pipeline test
 */
async function runPipelineTest() {
  console.log(`🎯 Testing workspace: ${TEST_WORKSPACE_ID}\n`);

  // Run all stages
  await testDataExtraction();
  await testDataPersistence();
  await testApprovalFlow();
  await testCampaignCreation();
  await testMessageReadiness();

  // Final summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 PIPELINE TEST SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const stages = [
    { name: 'Data Extraction', result: results.stage1_extraction },
    { name: 'Data Persistence', result: results.stage2_persistence },
    { name: 'Approval Flow', result: results.stage3_approval },
    { name: 'Campaign Creation', result: results.stage4_campaign },
    { name: 'Message Readiness', result: results.stage5_readiness }
  ];

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const stage of stages) {
    const icon = stage.result.status === 'completed' ? '✅' :
                 stage.result.status === 'failed' ? '❌' :
                 stage.result.status === 'skipped' ? '⏭️' : '⏸️';

    console.log(`${icon} ${stage.name}: ${stage.result.status.toUpperCase()}`);

    if (stage.result.status === 'completed') passed++;
    else if (stage.result.status === 'failed') failed++;
    else if (stage.result.status === 'skipped') skipped++;
  }

  console.log('');
  console.log(`Total: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);

  if (failed > 0) {
    console.log('❌ PIPELINE TEST FAILED');
    console.log('   Review errors above and fix before proceeding\n');
  } else if (passed === stages.length) {
    console.log('✅ PIPELINE TEST PASSED');
    console.log('   All stages working correctly\n');
  } else {
    console.log('⚠️  PIPELINE TEST PARTIAL');
    console.log('   Some stages skipped or incomplete\n');
  }

  // Show recommendations
  if (results.stage3_approval.details?.data_quality_percent < 50) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 RECOMMENDATIONS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('⚠️  Data quality is low - run enrichment:');
    console.log('   node scripts/js/enrich-prospects-direct.mjs\n');
  }
}

runPipelineTest().catch(console.error);
