#!/usr/bin/env node

/**
 * Test N8N MCP Enrichment Integration
 *
 * Tests the complete enrichment flow:
 * 1. Creates enrichment job
 * 2. Triggers N8N workflow via MCP
 * 3. Polls for completion
 * 4. Shows enriched data
 */

import 'dotenv/config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(emoji, message, color = colors.reset) {
  console.log(`${color}${emoji} ${message}${colors.reset}`);
}

async function getTestProspect() {
  log('🔍', 'Finding test prospect with LinkedIn URL...', colors.blue);

  const response = await fetch(`${SUPABASE_URL}/rest/v1/workspace_prospects?select=id,first_name,last_name,linkedin_profile_url,company_name,location,industry&linkedin_profile_url=not.is.null&limit=1`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });

  const prospects = await response.json();

  if (!prospects || prospects.length === 0) {
    throw new Error('No prospects with LinkedIn URL found');
  }

  const prospect = prospects[0];
  log('✅', `Found prospect: ${prospect.first_name} ${prospect.last_name}`, colors.green);
  log('📍', `LinkedIn: ${prospect.linkedin_profile_url}`, colors.cyan);
  log('🏢', `Current company: ${prospect.company_name || 'Not set'}`, colors.cyan);

  return prospect;
}

async function createEnrichmentJob(prospectId, workspaceId) {
  log('📋', 'Creating enrichment job...', colors.blue);

  const response = await fetch(`${API_URL}/api/prospects/enrich-async`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': 'your-auth-cookie-here' // Will use service role in prod
    },
    body: JSON.stringify({
      prospectIds: [prospectId],
      workspaceId: workspaceId
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create job: ${response.status} ${error}`);
  }

  const result = await response.json();
  log('✅', `Job created: ${result.job_id}`, colors.green);
  log('🔗', `Poll URL: ${result.poll_url}`, colors.cyan);

  return result.job_id;
}

async function pollJobStatus(jobId) {
  log('⏳', 'Polling for job completion...', colors.yellow);

  let attempts = 0;
  const maxAttempts = 60; // 2 minutes max

  while (attempts < maxAttempts) {
    attempts++;

    const response = await fetch(`${SUPABASE_URL}/rest/v1/enrichment_jobs?select=*&id=eq.${jobId}&limit=1`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    const jobs = await response.json();

    if (!jobs || jobs.length === 0) {
      throw new Error('Job not found');
    }

    const job = jobs[0];

    // Show progress
    const progress = job.total_prospects > 0
      ? Math.round((job.processed_count / job.total_prospects) * 100)
      : 0;

    process.stdout.write(`\r${colors.cyan}⏳ Status: ${job.status} | Progress: ${progress}% (${job.processed_count}/${job.total_prospects})${colors.reset}`);

    // Check if complete
    if (job.status === 'completed') {
      console.log(); // New line
      log('✅', 'Job completed!', colors.green);
      log('📊', `Processed: ${job.processed_count}, Failed: ${job.failed_count}`, colors.cyan);
      return job;
    }

    if (job.status === 'failed') {
      console.log(); // New line
      log('❌', `Job failed: ${job.error_message}`, colors.red);
      return job;
    }

    // Wait 2 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error('Polling timeout after 2 minutes');
}

async function showEnrichedData(prospectId) {
  log('📊', 'Fetching enriched prospect data...', colors.blue);

  const response = await fetch(`${SUPABASE_URL}/rest/v1/workspace_prospects?select=*&id=eq.${prospectId}&limit=1`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });

  const prospects = await response.json();
  const prospect = prospects[0];

  console.log();
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '', colors.cyan);
  log('📝', 'ENRICHED PROSPECT DATA', colors.green);
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '', colors.cyan);
  console.log(`
  Name:         ${prospect.first_name} ${prospect.last_name}
  Company:      ${prospect.company_name || 'N/A'}
  Location:     ${prospect.location || 'N/A'}
  Industry:     ${prospect.industry || 'N/A'}
  LinkedIn:     ${prospect.linkedin_profile_url}
  Email:        ${prospect.email_address || 'N/A'}
  `);
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '', colors.cyan);

  return prospect;
}

async function main() {
  try {
    console.log();
    log('🚀', 'N8N MCP Enrichment Test', colors.green);
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '', colors.cyan);
    console.log();

    // Get test prospect
    const prospect = await getTestProspect();

    // Get workspace ID (use first workspace)
    log('🏢', 'Getting workspace...', colors.blue);
    const workspaceResponse = await fetch(`${SUPABASE_URL}/rest/v1/workspaces?select=id&limit=1`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    const workspaces = await workspaceResponse.json();
    const workspaceId = workspaces[0].id;
    log('✅', `Workspace ID: ${workspaceId}`, colors.green);
    console.log();

    // Create enrichment job (this triggers N8N via MCP)
    const jobId = await createEnrichmentJob(prospect.id, workspaceId);
    console.log();

    // Poll for completion
    const completedJob = await pollJobStatus(jobId);
    console.log();

    // Show enriched data
    if (completedJob.status === 'completed' && completedJob.processed_count > 0) {
      await showEnrichedData(prospect.id);

      // Show enrichment results
      if (completedJob.enrichment_results && completedJob.enrichment_results.length > 0) {
        console.log();
        log('🔍', 'RAW ENRICHMENT RESULTS:', colors.yellow);
        console.log(JSON.stringify(completedJob.enrichment_results, null, 2));
      }
    }

    console.log();
    log('✅', 'Test completed successfully!', colors.green);
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '', colors.cyan);
    console.log();

  } catch (error) {
    console.log();
    log('❌', `Test failed: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  }
}

main();
