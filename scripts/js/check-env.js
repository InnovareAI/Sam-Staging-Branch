#!/usr/bin/env node

import { config } from 'dotenv';
config();

console.log('🔍 Environment Variables Check:\n');

const required = [
  'UNIPILE_DSN',
  'UNIPILE_API_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
];

required.forEach(key => {
  const value = process.env[key];
  if (value) {
    console.log(`✅ ${key}: ${key.includes('KEY') ? '[REDACTED]' : value.substring(0, 30)}...`);
  } else {
    console.log(`❌ ${key}: NOT SET`);
  }
});

console.log('\n📋 Summary:');
console.log(`   All required vars set: ${required.every(k => process.env[k]) ? '✅ YES' : '❌ NO'}`);

if (process.env.UNIPILE_DSN) {
  console.log(`\n🌐 Unipile URL would be: https://${process.env.UNIPILE_DSN}/api/v1/`);
}