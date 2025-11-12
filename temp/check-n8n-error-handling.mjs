#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

console.log('🔍 Checking N8N Error Handling Configuration\n');

// Read the workflow file
const workflow = JSON.parse(readFileSync(join(__dirname, 'orchestrator-full.json'), 'utf8'));

// Check critical HTTP nodes for error handling
const criticalNodes = [
  'Get LinkedIn Profile',
  'Send CR',
  'Send Acceptance Message',
  'Send FU1',
  'Send FU2',
  'Send FU3',
  'Send FU4',
  'Send GB (Breakup)'
];

console.log('Error Handling Configuration:\n');
console.log('='.repeat(60));

criticalNodes.forEach(nodeName => {
  const node = workflow.nodes.find(n => n.name === nodeName);
  
  if (node) {
    console.log(`\n${nodeName}:`);
    console.log(`  Type: ${node.type}`);
    
    // Check for continue on fail
    const continueOnFail = node.continueOnFail || false;
    console.log(`  Continue on Fail: ${continueOnFail ? '✅ YES' : '❌ NO'}`);
    
    // Check for retry settings
    const retryOnFail = node.retryOnFail || false;
    const maxTries = node.maxTries || 1;
    const waitBetweenTries = node.waitBetween || 0;
    
    console.log(`  Retry on Fail: ${retryOnFail ? '✅ YES' : '❌ NO'}`);
    if (retryOnFail) {
      console.log(`    Max Tries: ${maxTries}`);
      console.log(`    Wait Between: ${waitBetweenTries}ms`);
    }
    
    // Check for error handling in options
    if (node.parameters?.options) {
      console.log(`  Options: ${JSON.stringify(node.parameters.options)}`);
    }
  } else {
    console.log(`\n${nodeName}: ❌ NODE NOT FOUND`);
  }
});

console.log('\n' + '='.repeat(60));
console.log('SUMMARY:');
console.log('='.repeat(60));
console.log('');
console.log('When Unipile returns a rate limit error (429 or similar):');
console.log('');
console.log('❌ If "Continue on Fail" is NO:');
console.log('   - Execution STOPS immediately');
console.log('   - Execution marked as "error"');
console.log('   - Prospect stays in current status');
console.log('   - No automatic retry');
console.log('');
console.log('✅ If "Continue on Fail" is YES:');
console.log('   - Execution continues to next node');
console.log('   - Error data passed to next node');
console.log('   - Can handle error gracefully');
console.log('');
console.log('💡 RECOMMENDATION:');
console.log('   Add error handling to HTTP nodes:');
console.log('   1. Enable "Continue on Fail"');
console.log('   2. Add "If" node to check for errors');
console.log('   3. If rate limited, wait and retry later');
console.log('   4. Update prospect status to "rate_limited"');
console.log('');
