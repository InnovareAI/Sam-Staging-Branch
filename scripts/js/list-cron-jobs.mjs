#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

console.log('📋 CURRENT CRON JOBS IN SAM\n');

const cronJobs = [
  {
    name: 'execute-scheduled-campaigns',
    schedule: '*/2 * * * * (every 2 minutes)',
    purpose: 'Execute LinkedIn campaigns with 2-30 min delays',
    path: '/api/cron/execute-scheduled-campaigns'
  },
  {
    name: 'process-pending-prospects',
    schedule: '*/5 * * * * (every 5 minutes)',
    purpose: 'Process prospects pending campaign assignment',
    path: '/api/cron/process-pending-prospects'
  },
  {
    name: 'check-accepted-connections',
    schedule: 'Not configured',
    purpose: 'Check for accepted LinkedIn connection requests',
    path: '/api/cron/check-accepted-connections'
  },
  {
    name: 'send-follow-ups',
    schedule: 'Not configured',
    purpose: 'Send automated follow-up messages',
    path: '/api/cron/send-follow-ups'
  },
  {
    name: 'check-pending-notifications',
    schedule: 'Not configured',
    purpose: 'Process pending notification queue',
    path: '/api/cron/check-pending-notifications'
  },
  {
    name: 'process-outbox',
    schedule: 'Not configured',
    purpose: 'Process outbound message queue',
    path: '/api/cron/process-outbox'
  }
];

console.log('Cron Job Summary:\n');
cronJobs.forEach((job, i) => {
  console.log(`${i + 1}. ${job.name}`);
  console.log(`   Schedule: ${job.schedule}`);
  console.log(`   Purpose: ${job.purpose}`);
  console.log(`   Path: ${job.path}`);
  console.log();
});

console.log('\n💡 RECOMMENDATION: Migrate to N8N Cron Jobs\n');
console.log('Benefits:');
console.log('✅ Visual workflow editor');
console.log('✅ More flexible scheduling (cron + interval + webhook)');
console.log('✅ Retry logic and error handling built-in');
console.log('✅ Execution history and monitoring');
console.log('✅ No Netlify function timeout limits (10 min)');
console.log('✅ Can chain multiple operations');
console.log('✅ Conditional execution based on database state');
console.log('\nN8N can call these same /api/cron/* endpoints on schedule.');
