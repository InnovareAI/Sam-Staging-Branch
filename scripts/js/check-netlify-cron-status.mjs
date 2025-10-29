#!/usr/bin/env node
import 'dotenv/config';

console.log('🔍 Checking Netlify Scheduled Functions Status\n');

// Check if CRON_SECRET is configured
console.log('Environment Variables:');
console.log('  CRON_SECRET:', process.env.CRON_SECRET ? '✅ Set' : '❌ Missing');
console.log('  NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL || '❌ Missing');
console.log();

console.log('⚠️ IMPORTANT: Netlify Scheduled Functions require:');
console.log('  1. Functions must be in netlify/functions/ directory');
console.log('  2. Schedule configured in netlify.toml');
console.log('  3. Enabled in Netlify Dashboard');
console.log();

console.log('📋 Checking netlify.toml configuration...\n');

import fs from 'fs';
const netlifyToml = fs.readFileSync('netlify.toml', 'utf-8');
console.log(netlifyToml);

console.log('\n📁 Checking netlify/functions directory...\n');
try {
  const files = fs.readdirSync('netlify/functions');
  console.log('Files in netlify/functions:');
  files.forEach(f => console.log(`  - ${f}`));
} catch (err) {
  console.log('  ❌ Directory not found');
}

console.log('\n\n🚨 CRITICAL CHECK:');
console.log('Are scheduled functions ENABLED in Netlify Dashboard?');
console.log('→ Go to: https://app.netlify.com/sites/[your-site]/functions');
console.log('→ Look for: scheduled-campaign-execution');
console.log('→ Status should be: "Active" with next run time');
console.log();
console.log('If functions show as "Not configured", scheduled functions are NOT running!');
