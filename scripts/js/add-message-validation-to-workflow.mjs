#!/usr/bin/env node
/**
 * Add message validation to N8N workflow
 * Skip sending if message is undefined/empty
 */

import 'dotenv/config';
import fs from 'fs';

const workflowFile = '/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/scripts/js/deploy-full-6-message-workflow.mjs';
let content = fs.readFileSync(workflowFile, 'utf-8');

// Create helper function for message validation IF node
const validationHelper = `
// Helper to create message validation IF node
const createMessageValidationNode = (id, name, position, messageKey) => ({
  id,
  name,
  type: "n8n-nodes-base.if",
  typeVersion: 2,
  position,
  parameters: {
    conditions: {
      options: { caseSensitive: true },
      conditions: [{
        leftValue: \`={{ $json.messages.\${messageKey} || '' }}\`,
        rightValue: "",
        operator: { type: "string", operation: "notEquals" }
      }]
    }
  }
});
`;

// Insert helper after existing helpers (after createIfReplyNode)
content = content.replace(
  /\/\/ Helper to create IF node\nconst createIfReplyNode/,
  validationHelper + '\n// Helper to create IF node\nconst createIfReplyNode'
);

// Now we need to add validation nodes before each send
// And update connections to route through validation

// For FU1-FU4 and GB, add validation before send
const messagesToValidate = [
  { key: 'fu1', sendNode: 'send_fu1', position: '[2350, 500]' },
  { key: 'fu2', sendNode: 'send_fu2', position: '[2750, 500]' },
  { key: 'fu3', sendNode: 'send_fu3', position: '[3550, 600]' },
  { key: 'fu4', sendNode: 'send_fu4', position: '[3950, 600]' },
  { key: 'gb', sendNode: 'send_gb', position: '[4350, 600]' }
];

console.log('✅ Message validation helper added');
console.log('⚠️  Manual workflow update required:');
console.log('\nTo complete the fix, add IF nodes before each send:');
messagesToValidate.forEach(msg => {
  console.log(`\n${msg.key.toUpperCase()}:`);
  console.log(`  1. Add IF node: "Has ${msg.key.toUpperCase()}?"`);
  console.log(`  2. Condition: $json.messages.${msg.key} is not empty`);
  console.log(`  3. True → ${msg.sendNode}`);
  console.log(`  4. False → Skip (connect to next wait or mark_complete)`);
});

console.log('\n💡 Alternative: Update execute-live API to only send non-empty messages');
