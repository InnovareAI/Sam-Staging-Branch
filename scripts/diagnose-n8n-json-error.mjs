#!/usr/bin/env node

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

console.log('\n🔍 N8N Database Update Issue\n');
console.log('The error "JSON parameter needs to be valid JSON" means the');
console.log('HTTP Request node is sending malformed JSON to Supabase.\n');

console.log('The issue is likely in the "Update Status - CR Sent" node.\n');

console.log('📋 Manual Fix Steps:\n');
console.log('1. Go to: https://workflows.innovareai.com');
console.log('2. Open workflow: SAM Master Campaign Orchestrator');
console.log('3. Find node: "Update Status - CR Sent"');
console.log('4. Check the Body Parameters\n');

console.log('Expected structure:');
console.log(JSON.stringify({
  prospect_id: '={{ $input.item.json.prospect.id }}',
  status: 'connection_request_sent',
  contacted_at: '={{ $now.toISO() }}',
  invitation_id: '={{ $json.invitation_id }}'
}, null, 2));

console.log('\n⚠️  Common Issues:\n');
console.log('1. Body Type should be: "JSON"');
console.log('2. Parameters might have extra quotes or escaping');
console.log('3. Variable references might be incorrect\n');

console.log('📸 Can you:\n');
console.log('1. Open the "Update Status - CR Sent" node in N8N');
console.log('2. Screenshot the Body Parameters section');
console.log('3. Share it so I can see the exact configuration\n');
