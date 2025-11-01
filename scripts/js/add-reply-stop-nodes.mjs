#!/usr/bin/env node
/**
 * Add Reply-Stop Mechanism to N8N Campaign Workflow
 *
 * This script adds reply-checking nodes before each follow-up (FU1-6)
 * to prevent sending messages to prospects who have already replied.
 *
 * Changes:
 * - Adds 12 new nodes (6 reply-check + 6 IF nodes)
 * - Total nodes: 39 → 51
 * - Inserts nodes between Wait and Personalize for each FU
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load original workflow
const workflowPath = path.join(__dirname, '../../n8n-workflows/campaign-execute-complete.json');
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

console.log(`📂 Loaded workflow: ${workflow.name}`);
console.log(`📊 Current nodes: ${workflow.nodes.length}`);

// Generate unique IDs for new nodes
function generateNodeId() {
  return `${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 4)}`;
}

// Template for reply-check node
function createReplyCheckNode(fuNumber, position) {
  return {
    parameters: {
      jsCode: `// Check if prospect has replied before sending FU${fuNumber}
const prospectId = $node['Extract Message ID'].json.prospect_id;
const supabase_url = $env.NEXT_PUBLIC_SUPABASE_URL;
const supabase_key = $env.SUPABASE_SERVICE_ROLE_KEY;

console.log(\`🔍 [FU${fuNumber}] Checking reply status for prospect ID: \${prospectId}\`);

try {
  // Query Supabase for prospect status
  const response = await fetch(
    \`\${supabase_url}/rest/v1/campaign_prospects?id=eq.\${prospectId}&select=status\`,
    {
      headers: {
        'apikey': supabase_key,
        'Authorization': \`Bearer \${supabase_key}\`,
        'Content-Type': 'application/json'
      }
    }
  );

  const data = await response.json();
  const status = data[0]?.status;

  console.log(\`📊 [FU${fuNumber}] Current prospect status: \${status}\`);

  // Check if prospect has replied
  if (status === 'replied') {
    console.log('⏸️ STOP: Prospect has replied - ending follow-up sequence');
    return [{
      json: {
        prospect_id: prospectId,
        action: 'end_sequence',
        reason: 'prospect_replied',
        stopped_at: new Date().toISOString(),
        fu_stage: 'fu${fuNumber}',
        message: \`Prospect replied - stopping before FU${fuNumber}\`
      }
    }];
  }

  // Also check for other stop conditions
  if (status === 'not_interested') {
    console.log('⏸️ STOP: Prospect marked as not interested');
    return [{
      json: {
        prospect_id: prospectId,
        action: 'end_sequence',
        reason: 'not_interested',
        stopped_at: new Date().toISOString(),
        fu_stage: 'fu${fuNumber}',
        message: 'Prospect not interested - ending sequence'
      }
    }];
  }

  // Continue with sending
  console.log(\`✅ [FU${fuNumber}] No reply detected - continuing with follow-up\`);
  return [{
    json: {
      ...$input.item.json,
      action: 'send',
      status: status,
      checked_at: new Date().toISOString()
    }
  }];

} catch (error) {
  console.error(\`⚠️ ERROR checking reply status: \${error.message}\`);

  // FAIL-SAFE: Continue sending if check fails (don't block entire campaign)
  console.log('⚠️ FAIL-SAFE: Continuing with send despite error');
  return [{
    json: {
      ...$input.item.json,
      action: 'send',
      status: 'unknown',
      error: error.message,
      fail_safe: true
    }
  }];
}`
    },
    name: `Check if Replied (FU${fuNumber})`,
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: position,
    id: generateNodeId()
  };
}

// Template for IF node
function createIfNode(fuNumber, position) {
  return {
    parameters: {
      conditions: {
        string: [
          {
            value1: "={{$json.action}}",
            value2: "send",
            operation: "equals"
          }
        ]
      }
    },
    name: `Should Send FU${fuNumber}?`,
    type: "n8n-nodes-base.if",
    typeVersion: 1,
    position: position,
    id: generateNodeId()
  };
}

// Template for log sequence ended node
function createLogNode(fuNumber, position) {
  return {
    parameters: {
      jsCode: `// Log that sequence was ended
const data = $input.item.json;

console.log(\`🛑 SEQUENCE ENDED AT FU${fuNumber}\`);
console.log(\`   Prospect ID: \${data.prospect_id}\`);
console.log(\`   Reason: \${data.reason}\`);
console.log(\`   Stopped at: \${data.stopped_at}\`);

// Update database to mark sequence as ended
const supabase_url = $env.NEXT_PUBLIC_SUPABASE_URL;
const supabase_key = $env.SUPABASE_SERVICE_ROLE_KEY;

try {
  await fetch(
    \`\${supabase_url}/rest/v1/campaign_prospects?id=eq.\${data.prospect_id}\`,
    {
      method: 'PATCH',
      headers: {
        'apikey': supabase_key,
        'Authorization': \`Bearer \${supabase_key}\`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        personalization_data: {
          sequence_ended: true,
          sequence_end_reason: data.reason,
          sequence_ended_at: data.stopped_at,
          ended_before_fu: 'fu${fuNumber}'
        }
      })
    }
  );

  console.log('✅ Database updated with sequence end status');
} catch (error) {
  console.error('⚠️ Failed to update database:', error.message);
}

return [{
  json: {
    ...data,
    logged: true
  }
}];`
    },
    name: `Log Sequence Ended (FU${fuNumber})`,
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: position,
    id: generateNodeId()
  };
}

// Find node by name
function findNode(name) {
  return workflow.nodes.find(n => n.name === name);
}

// Find connection from node
function findConnectionFrom(nodeName) {
  const connections = workflow.connections[nodeName];
  if (!connections?.main?.[0]?.[0]) return null;
  return connections.main[0][0];
}

// Add nodes for each FU
const followUps = [
  { number: 1, waitNode: 'Wait 6 Hours for FU1', personalizeNode: 'Personalize FU1' },
  { number: 2, waitNode: 'Wait for FU2', personalizeNode: 'Personalize FU2' },
  { number: 3, waitNode: 'Wait for FU3', personalizeNode: 'Personalize FU3' },
  { number: 4, waitNode: 'Wait for FU4', personalizeNode: 'Personalize FU4' },
  { number: 5, waitNode: 'Wait for FU5', personalizeNode: 'Personalize FU5' },
  { number: 6, waitNode: 'Wait for FU6', personalizeNode: 'Personalize FU6' }
];

let newNodes = [];
let nodePositionY = 600; // Start below main flow for log nodes

followUps.forEach(fu => {
  const waitNode = findNode(fu.waitNode);
  const personalizeNode = findNode(fu.personalizeNode);

  if (!waitNode || !personalizeNode) {
    console.warn(`⚠️ Could not find nodes for FU${fu.number}`);
    return;
  }

  // Calculate positions (insert between wait and personalize)
  const checkX = waitNode.position[0] + 200;
  const checkY = waitNode.position[1];

  const ifX = checkX + 200;
  const ifY = checkY;

  const logX = ifX;
  const logY = nodePositionY;
  nodePositionY += 100; // Space out log nodes vertically

  // Create new nodes
  const checkNode = createReplyCheckNode(fu.number, [checkX, checkY]);
  const ifNode = createIfNode(fu.number, [ifX, ifY]);
  const logNode = createLogNode(fu.number, [logX, logY]);

  newNodes.push(checkNode, ifNode, logNode);

  // Update connections
  // Wait → Check
  workflow.connections[fu.waitNode] = {
    main: [[{ node: checkNode.name, type: 'main', index: 0 }]]
  };

  // Check → IF
  workflow.connections[checkNode.name] = {
    main: [[{ node: ifNode.name, type: 'main', index: 0 }]]
  };

  // IF → Personalize (TRUE) or Log (FALSE)
  workflow.connections[ifNode.name] = {
    main: [
      [{ node: fu.personalizeNode, type: 'main', index: 0 }], // TRUE
      [{ node: logNode.name, type: 'main', index: 0 }]         // FALSE
    ]
  };

  // Log → End (no further connections)
  workflow.connections[logNode.name] = { main: [[]] };

  console.log(`✅ Added reply-stop for FU${fu.number}`);
});

// Add new nodes to workflow
workflow.nodes.push(...newNodes);

console.log(`\n📊 Updated workflow:`);
console.log(`   Total nodes: ${workflow.nodes.length}`);
console.log(`   Added: ${newNodes.length} nodes`);
console.log(`   - Reply-check nodes: ${followUps.length}`);
console.log(`   - IF nodes: ${followUps.length}`);
console.log(`   - Log nodes: ${followUps.length}`);

// Save updated workflow
const outputPath = path.join(__dirname, '../../n8n-workflows/campaign-execute-complete-with-reply-stop.json');
fs.writeFileSync(outputPath, JSON.stringify(workflow, null, 2));

console.log(`\n✅ Saved updated workflow to: campaign-execute-complete-with-reply-stop.json`);
console.log(`\n📋 Next steps:`);
console.log(`   1. Test the JSON is valid: jq empty n8n-workflows/campaign-execute-complete-with-reply-stop.json`);
console.log(`   2. Import to N8N: https://innovareai.app.n8n.cloud/workflow/2bmFPN5t2y6A4Rx2`);
console.log(`   3. Test with 1 prospect (manually set status to 'replied' to test stop)`);
console.log(`   4. If successful, replace original file`);
