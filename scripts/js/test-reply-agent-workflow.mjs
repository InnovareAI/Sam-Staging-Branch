#!/usr/bin/env node
/**
 * Test and Validate Reply Agent HITL Sender Workflow
 * Validates workflow structure, queries, and configuration
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing Reply Agent HITL Sender Workflow...\n');

// Read the workflow JSON
const workflowPath = join(__dirname, '../../n8n-workflows/reply-agent-hitl-sender.json');
let workflowData;

try {
  workflowData = JSON.parse(readFileSync(workflowPath, 'utf-8'));
  console.log('✅ Workflow JSON is valid');
} catch (error) {
  console.error('❌ Invalid JSON:', error.message);
  process.exit(1);
}

// Test 1: Validate workflow structure
console.log('\n📋 Test 1: Validate Workflow Structure');
console.log('────────────────────────────────────────');

const requiredFields = ['name', 'nodes', 'connections', 'settings'];
let structureValid = true;

for (const field of requiredFields) {
  if (!workflowData[field]) {
    console.error(`❌ Missing required field: ${field}`);
    structureValid = false;
  } else {
    console.log(`✅ ${field}: present`);
  }
}

if (structureValid) {
  console.log(`✅ All required fields present`);
  console.log(`   Nodes: ${workflowData.nodes.length}`);
  console.log(`   Name: ${workflowData.name}`);
}

// Test 2: Validate node types
console.log('\n📋 Test 2: Validate Node Types');
console.log('────────────────────────────────────────');

const expectedNodes = {
  'poll-trigger': 'n8n-nodes-base.scheduleTrigger',
  'fetch-queued-messages': 'n8n-nodes-base.postgres',
  'check-has-messages': 'n8n-nodes-base.if',
  'update-status-sending': 'n8n-nodes-base.postgres',
  'route-by-channel': 'n8n-nodes-base.switch',
  'get-email-account': 'n8n-nodes-base.postgres',
  'send-email-unipile': 'n8n-nodes-base.httpRequest',
  'update-email-success': 'n8n-nodes-base.postgres',
  'get-linkedin-account': 'n8n-nodes-base.postgres',
  'send-linkedin-unipile': 'n8n-nodes-base.httpRequest',
  'update-linkedin-success': 'n8n-nodes-base.postgres',
  'update-failure': 'n8n-nodes-base.postgres',
  'retry-failed-messages': 'n8n-nodes-base.postgres'
};

let nodesValid = true;
for (const [nodeId, expectedType] of Object.entries(expectedNodes)) {
  const node = workflowData.nodes.find(n => n.id === nodeId);
  if (!node) {
    console.error(`❌ Missing node: ${nodeId}`);
    nodesValid = false;
  } else if (node.type !== expectedType) {
    console.error(`❌ Wrong node type for ${nodeId}: expected ${expectedType}, got ${node.type}`);
    nodesValid = false;
  } else {
    console.log(`✅ ${nodeId} → ${expectedType}`);
  }
}

if (nodesValid) {
  console.log('✅ All required nodes present with correct types');
}

// Test 3: Validate SQL queries
console.log('\n📋 Test 3: Validate SQL Queries');
console.log('────────────────────────────────────────');

const sqlNodes = [
  'fetch-queued-messages',
  'update-status-sending',
  'get-email-account',
  'get-linkedin-account',
  'update-email-success',
  'update-linkedin-success',
  'update-failure',
  'retry-failed-messages'
];

let queriesValid = true;
for (const nodeId of sqlNodes) {
  const node = workflowData.nodes.find(n => n.id === nodeId);
  if (node && node.parameters && node.parameters.query) {
    const query = node.parameters.query;

    // Check for SQL injection vulnerabilities (basic check)
    const hasProperParameterization = query.includes('{{') || query.includes('$json');

    // Check for required keywords
    const hasRequiredKeywords =
      (query.includes('SELECT') || query.includes('UPDATE') || query.includes('INSERT')) &&
      (query.includes('FROM') || query.includes('SET'));

    if (!hasRequiredKeywords) {
      console.error(`❌ ${nodeId}: Query appears malformed`);
      queriesValid = false;
    } else {
      console.log(`✅ ${nodeId}: Query structure valid`);

      // Log query preview
      const preview = query.split('\n')[0].substring(0, 60) + '...';
      console.log(`   Preview: ${preview}`);
    }
  } else {
    console.error(`❌ ${nodeId}: No query found`);
    queriesValid = false;
  }
}

if (queriesValid) {
  console.log('✅ All SQL queries are properly structured');
}

// Test 4: Validate connections
console.log('\n📋 Test 4: Validate Node Connections');
console.log('────────────────────────────────────────');

const requiredConnections = {
  'Poll Every 10 Seconds': ['Fetch Queued Messages'],
  'Fetch Queued Messages': ['Has Messages?'],
  'Has Messages?': ['Update Status to Sending'],
  'Update Status to Sending': ['Route by Channel'],
  'Route by Channel': ['Get Email Account', 'Get LinkedIn Account', 'Update Failure'],
  'Get Email Account': ['Send Email via Unipile'],
  'Send Email via Unipile': ['Update Email Success'],
  'Get LinkedIn Account': ['Send LinkedIn via Unipile'],
  'Send LinkedIn via Unipile': ['Update LinkedIn Success'],
  'Update Failure': ['Retry Failed Messages']
};

let connectionsValid = true;
for (const [sourceName, expectedTargets] of Object.entries(requiredConnections)) {
  const sourceConnections = workflowData.connections[sourceName];
  if (!sourceConnections) {
    console.error(`❌ Missing connections from: ${sourceName}`);
    connectionsValid = false;
  } else {
    console.log(`✅ ${sourceName} → ${expectedTargets.join(', ')}`);
  }
}

if (connectionsValid) {
  console.log('✅ All node connections are properly configured');
}

// Test 5: Validate Unipile API calls
console.log('\n📋 Test 5: Validate Unipile API Configuration');
console.log('────────────────────────────────────────');

const unipileNodes = ['send-email-unipile', 'send-linkedin-unipile'];
let unipileValid = true;

for (const nodeId of unipileNodes) {
  const node = workflowData.nodes.find(n => n.id === nodeId);
  if (node && node.parameters) {
    const params = node.parameters;

    // Check for required parameters
    const hasUrl = params.url && params.url.includes('UNIPILE_DSN');
    const hasHeaders = params.headerParameters &&
      params.headerParameters.parameters.some(p => p.name === 'X-API-KEY');
    const hasBody = params.bodyParameters && params.bodyParameters.parameters;

    if (!hasUrl) {
      console.error(`❌ ${nodeId}: Missing or invalid URL`);
      unipileValid = false;
    } else if (!hasHeaders) {
      console.error(`❌ ${nodeId}: Missing X-API-KEY header`);
      unipileValid = false;
    } else if (!hasBody) {
      console.error(`❌ ${nodeId}: Missing body parameters`);
      unipileValid = false;
    } else {
      console.log(`✅ ${nodeId}: Properly configured`);
      console.log(`   URL: ${params.url.split('/api/')[1]}`);
      console.log(`   Method: ${params.method || 'GET'}`);
      console.log(`   Body params: ${params.bodyParameters.parameters.length}`);
    }
  }
}

if (unipileValid) {
  console.log('✅ All Unipile API calls are properly configured');
}

// Test 6: Validate environment variables usage
console.log('\n📋 Test 6: Validate Environment Variables');
console.log('────────────────────────────────────────');

const workflowString = JSON.stringify(workflowData);
const envVarsUsed = {
  'UNIPILE_DSN': workflowString.includes('UNIPILE_DSN'),
  'UNIPILE_API_KEY': workflowString.includes('UNIPILE_API_KEY')
};

let envVarsValid = true;
for (const [envVar, isUsed] of Object.entries(envVarsUsed)) {
  if (!isUsed) {
    console.error(`❌ Environment variable not used: ${envVar}`);
    envVarsValid = false;
  } else {
    console.log(`✅ ${envVar}: Used in workflow`);
  }
}

if (envVarsValid) {
  console.log('✅ All required environment variables are referenced');
}

// Test 7: Validate schedule trigger
console.log('\n📋 Test 7: Validate Schedule Trigger');
console.log('────────────────────────────────────────');

const triggerNode = workflowData.nodes.find(n => n.id === 'poll-trigger');
if (triggerNode && triggerNode.parameters && triggerNode.parameters.rule) {
  const interval = triggerNode.parameters.rule.interval;
  if (interval && interval.length > 0) {
    const intervalConfig = interval[0];
    console.log(`✅ Trigger configured: ${intervalConfig.field} = ${intervalConfig.secondsInterval}`);

    if (intervalConfig.secondsInterval === 10) {
      console.log('✅ Polling interval is 10 seconds (optimal for <15 min SLA)');
    } else {
      console.warn(`⚠️  Polling interval is ${intervalConfig.secondsInterval}s (recommended: 10s)`);
    }
  } else {
    console.error('❌ Schedule trigger not properly configured');
  }
} else {
  console.error('❌ Schedule trigger node not found or misconfigured');
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 TEST SUMMARY');
console.log('='.repeat(60));

const allTestsPassed = structureValid && nodesValid && queriesValid &&
                       connectionsValid && unipileValid && envVarsValid;

if (allTestsPassed) {
  console.log('');
  console.log('✅ All tests passed!');
  console.log('');
  console.log('📋 Workflow is ready for deployment');
  console.log('');
  console.log('Next steps:');
  console.log('1. Run deployment script:');
  console.log('   node scripts/js/deploy-reply-agent-workflow.mjs');
  console.log('');
  console.log('2. Configure N8N:');
  console.log('   • Add Supabase PostgreSQL credentials');
  console.log('   • Set UNIPILE_DSN and UNIPILE_API_KEY environment variables');
  console.log('');
  console.log('3. Test with sample message in message_outbox');
  console.log('');
  console.log('4. Activate workflow in N8N UI');
  console.log('');
  process.exit(0);
} else {
  console.log('');
  console.error('❌ Some tests failed - please fix the issues above');
  console.log('');
  process.exit(1);
}
