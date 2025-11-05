#!/usr/bin/env node

const N8N_API_URL = process.env.N8N_API_URL || 'https://workflows.innovareai.com/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY;

const response = await fetch(`${N8N_API_URL}/workflows`, {
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Content-Type': 'application/json'
  }
});

const workflows = await response.json();

console.log('All workflows:');
workflows.data?.forEach(w => {
  console.log('\n  Name:', w.name);
  console.log('  ID:', w.id);
  console.log('  Active:', w.active);
  console.log('  Updated:', new Date(w.updatedAt).toLocaleString());
});

const enrichmentWorkflows = workflows.data?.filter(w =>
  w.name.toLowerCase().includes('enrichment') ||
  w.name.toLowerCase().includes('prospect')
);

console.log('\n\nEnrichment-related workflows:', enrichmentWorkflows.length);
enrichmentWorkflows.forEach(w => {
  console.log('  -', w.name, '(Active:', w.active + ')');
});
