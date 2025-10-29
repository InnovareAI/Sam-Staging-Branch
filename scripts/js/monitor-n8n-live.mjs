#!/usr/bin/env node
/**
 * Real-time N8N workflow monitor
 * Shows executions as they happen
 */
import 'dotenv/config';

const N8N_URL = process.env.N8N_API_URL || 'https://workflows.innovareai.com/api/v1';
const WORKFLOW_ID = 'aVG6LC4ZFRMN7Bw6';
let lastSeenId = null;

console.log('🔴 LIVE N8N Monitor - Press Ctrl+C to stop\n');
console.log(`Watching workflow: ${WORKFLOW_ID}\n`);

async function checkExecutions() {
  try {
    const res = await fetch(`${N8N_URL}/executions?workflowId=${WORKFLOW_ID}&limit=10`, {
      headers: { 'X-N8N-API-KEY': process.env.N8N_API_KEY }
    });
    const data = await res.json();

    if (data.data && data.data.length > 0) {
      const latest = data.data[0];

      if (lastSeenId !== latest.id) {
        // New execution!
        const time = new Date(latest.startedAt).toLocaleTimeString();
        const status = latest.finished ?
          (latest.stoppedAt ? '✅ SUCCESS' : '❌ FAILED') :
          '🔄 RUNNING';

        console.log(`[${time}] Execution ${latest.id}: ${status}`);

        if (latest.finished && latest.stoppedAt) {
          const duration = new Date(latest.stoppedAt) - new Date(latest.startedAt);
          console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);
        }

        lastSeenId = latest.id;
      }
    }
  } catch (err) {
    console.error('Monitor error:', err.message);
  }
}

// Check every 3 seconds
setInterval(checkExecutions, 3000);
checkExecutions(); // Initial check
