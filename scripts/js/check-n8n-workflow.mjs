#!/usr/bin/env node
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const N8N_URL = process.env.N8N_WEBHOOK_URL || 'https://workflows.innovareai.com';
const N8N_API_KEY = process.env.N8N_API_KEY;

console.log('🔍 Checking N8N workflow for LinkedIn Commenting...\n');
console.log('N8N URL:', N8N_URL);
console.log('API Key:', N8N_API_KEY ? 'Set ✓' : 'Missing ✗');

if (!N8N_API_KEY) {
  console.error('\n❌ N8N_API_KEY not found in .env.local');
  process.exit(1);
}

// List all workflows
try {
  const response = await fetch(`${N8N_URL}/api/v1/workflows`, {
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
    },
  });

  if (!response.ok) {
    console.error('❌ Failed to fetch workflows:', response.status, response.statusText);
    const text = await response.text();
    console.error('Response:', text);
    process.exit(1);
  }

  const workflows = await response.json();
  console.log(`\nFound ${workflows.data?.length || 0} workflows:\n`);

  const commentingWorkflows = workflows.data?.filter(w => 
    w.name.toLowerCase().includes('comment') || 
    w.name.toLowerCase().includes('linkedin')
  );

  if (commentingWorkflows?.length > 0) {
    commentingWorkflows.forEach(wf => {
      console.log(`📋 ${wf.name}`);
      console.log(`   ID: ${wf.id}`);
      console.log(`   Active: ${wf.active ? '✅ Yes' : '❌ No'}`);
      console.log(`   Updated: ${wf.updatedAt}`);
      console.log('');
    });
  } else {
    console.log('⚠️ No LinkedIn commenting workflows found');
  }

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
