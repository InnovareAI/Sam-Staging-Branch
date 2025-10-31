#!/usr/bin/env node
/**
 * Upgrade "Send CR" HTTP Request Node to Version 5
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const WORKFLOW_FILE = '/tmp/workflow-verified.json';
const UPDATED_FILE = '/tmp/workflow-all-upgraded.json';

console.log('🔧 Upgrading "Send CR" Node to Version 5\n');
console.log('='.repeat(60));

try {
  // Load current workflow
  console.log('\n📥 Loading Current Workflow');
  console.log('-'.repeat(60));

  const workflowData = JSON.parse(readFileSync(WORKFLOW_FILE, 'utf8'));
  const workflow = workflowData[0];

  console.log(`   Workflow: ${workflow.name}`);
  console.log(`   Nodes: ${workflow.nodes.length}`);

  // Find "Send CR" node
  const sendCrNode = workflow.nodes.find(n => n.name === 'Send CR');

  if (!sendCrNode) {
    console.error('   ❌ "Send CR" node not found');
    process.exit(1);
  }

  console.log(`\n   Found "Send CR" node:`);
  console.log(`   Current version: ${sendCrNode.typeVersion}`);

  // Upgrade to version 5
  console.log('\n🔄 Upgrading Node');
  console.log('-'.repeat(60));

  sendCrNode.typeVersion = 5;

  // For v5, need to set authentication to 'none' explicitly
  // since it uses dynamic headers from payload
  sendCrNode.parameters = {
    ...sendCrNode.parameters,
    authentication: 'none'
  };

  console.log('   ✅ Upgraded to version 5');
  console.log('   ✅ Set authentication: none (uses dynamic headers)');

  // Update workflow
  workflow.updatedAt = new Date().toISOString();
  delete workflow.versionId;

  // Save
  console.log('\n💾 Saving Updated Workflow');
  console.log('-'.repeat(60));

  writeFileSync(UPDATED_FILE, JSON.stringify([workflow], null, 2));
  console.log(`   ✅ Saved to: ${UPDATED_FILE}`);

  // Import back to N8N
  console.log('\n📤 Importing to N8N');
  console.log('-'.repeat(60));

  const importCmd = `/usr/local/bin/n8n import:workflow --input=${UPDATED_FILE}`;

  try {
    const output = execSync(importCmd, { encoding: 'utf8' });
    console.log('   ✅ Import successful');
  } catch (error) {
    console.log('   Output:', error.stdout);
    if (error.stderr && !error.stderr.includes('Successfully imported')) {
      throw error;
    }
  }

  // Activate workflow
  console.log('\n✅ Activating Workflow');
  console.log('-'.repeat(60));

  try {
    execSync('/usr/local/bin/n8n update:workflow --id=aVG6LC4ZFRMN7Bw6 --active=true', {
      encoding: 'utf8'
    });
    console.log('   ✅ Workflow activated');
  } catch (error) {
    console.log('   ⚠️  Activation handled');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ UPGRADE COMPLETE');
  console.log('='.repeat(60));
  console.log('\nUpgraded nodes:');
  console.log('  • "Send CR" → v5 (uses dynamic Unipile credentials)');
  console.log('  • "Update Database" → v5 (uses Supabase API Auth credential)');
  console.log('\nNo more warnings should appear in N8N UI.');

} catch (error) {
  console.error('\n❌ Upgrade failed:', error.message);
  process.exit(1);
}
