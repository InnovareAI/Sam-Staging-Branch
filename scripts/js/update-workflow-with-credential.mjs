#!/usr/bin/env node
/**
 * Update N8N Workflow to Use Credential
 * Modifies workflow JSON to reference Supabase credential and re-imports
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const WORKFLOW_FILE = '/tmp/current-workflow.json';
const UPDATED_FILE = '/tmp/workflow-with-credential.json';

console.log('🔧 Updating N8N Workflow Configuration\n');
console.log('='.repeat(60));

try {
  // Step 1: Load current workflow
  console.log('\n📥 STEP 1: Loading Current Workflow');
  console.log('-'.repeat(60));

  const workflowData = JSON.parse(readFileSync(WORKFLOW_FILE, 'utf8'));
  const workflow = workflowData[0]; // N8N export wraps in array

  console.log(`   Workflow: ${workflow.name}`);
  console.log(`   ID: ${workflow.id}`);
  console.log(`   Nodes: ${workflow.nodes.length}`);

  // Step 2: Find and update "Update Database" node
  console.log('\n🔍 STEP 2: Finding "Update Database" Node');
  console.log('-'.repeat(60));

  const updateDbNode = workflow.nodes.find(n => n.name === 'Update Database');

  if (!updateDbNode) {
    console.error('   ❌ "Update Database" node not found');
    process.exit(1);
  }

  console.log(`   ✅ Found node: ${updateDbNode.name}`);
  console.log(`   Type: ${updateDbNode.type}`);
  console.log(`   Current version: ${updateDbNode.typeVersion}`);

  // Step 3: Update node configuration
  console.log('\n🔄 STEP 3: Updating Node Configuration');
  console.log('-'.repeat(60));

  // Update to use predefined credential
  // Keep URL, query params, and body - only change authentication
  updateDbNode.parameters = {
    ...updateDbNode.parameters,
    authentication: 'predefinedCredentialType',
    nodeCredentialType: 'httpHeaderAuth',
    // Remove auth-related headers (they'll come from credential)
    sendHeaders: true,
    headerParameters: {
      parameters: [
        {
          name: 'Content-Type',
          value: 'application/json'
        },
        {
          name: 'Prefer',
          value: 'return=minimal'
        }
      ]
    }
  };

  // Add credential reference by name
  // N8N will resolve this to the actual credential ID when importing
  updateDbNode.credentials = {
    httpHeaderAuth: {
      name: 'Supabase API Auth'
    }
  };

  // Upgrade to latest HTTP Request node version
  updateDbNode.typeVersion = 5;

  console.log('   ✅ Node updated:');
  console.log('   - Authentication: Using httpHeaderAuth credential');
  console.log('   - Credential name: "Supabase API Auth"');
  console.log('   - Removed manual apikey and Authorization headers');
  console.log('   - Kept Content-Type and Prefer headers');
  console.log('   - Upgraded to typeVersion: 5');

  // Step 4: Update workflow version info
  workflow.updatedAt = new Date().toISOString();
  delete workflow.versionId; // Let N8N generate new version ID

  // Step 5: Save updated workflow
  console.log('\n💾 STEP 4: Saving Updated Workflow');
  console.log('-'.repeat(60));

  writeFileSync(UPDATED_FILE, JSON.stringify([workflow], null, 2));
  console.log(`   ✅ Saved to: ${UPDATED_FILE}`);

  // Step 6: Import back to N8N
  console.log('\n📤 STEP 5: Importing to N8N');
  console.log('-'.repeat(60));

  const importCmd = `/usr/local/bin/n8n import:workflow --input=${UPDATED_FILE}`;
  console.log(`   Command: ${importCmd}`);

  try {
    const output = execSync(importCmd, { encoding: 'utf8' });
    console.log('   ✅ Import successful');
    console.log(output);
  } catch (error) {
    // N8N import might still succeed even with warnings
    console.log('   Output:', error.stdout);
    if (error.stderr && !error.stderr.includes('Successfully imported')) {
      throw error;
    }
  }

  // Step 7: Activate workflow
  console.log('\n✅ STEP 6: Activating Workflow');
  console.log('-'.repeat(60));

  try {
    execSync('/usr/local/bin/n8n update:workflow --id=aVG6LC4ZFRMN7Bw6 --active=true', {
      encoding: 'utf8'
    });
    console.log('   ✅ Workflow activated');
  } catch (error) {
    console.log('   ⚠️  Note: Activation may require N8N restart');
    console.log('   You can activate manually in N8N UI');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ CONFIGURATION COMPLETE');
  console.log('='.repeat(60));
  console.log('\nWhat was updated:');
  console.log('  • "Update Database" node now uses "Supabase API Auth" credential');
  console.log('  • Removed manual apikey and Authorization headers');
  console.log('  • Upgraded HTTP Request node from v4.2 to v5');
  console.log('  • Workflow re-imported to N8N');
  console.log('\nNext steps:');
  console.log('  1. Go to: https://workflows.innovareai.com/workflow/aVG6LC4ZFRMN7Bw6');
  console.log('  2. Verify "Update Database" node shows credential icon');
  console.log('  3. Ensure workflow is ACTIVE (toggle switch)');
  console.log('  4. Test campaign execution');
  console.log('\nIf credential not automatically linked:');
  console.log('  1. Click on "Update Database" node');
  console.log('  2. Select "Supabase API Auth" from credential dropdown');
  console.log('  3. Save workflow');

} catch (error) {
  console.error('\n❌ Update failed:', error.message);
  if (error.stack) {
    console.error('\nStack trace:', error.stack);
  }
  process.exit(1);
}
