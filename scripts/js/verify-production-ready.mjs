#!/usr/bin/env node

/**
 * Pre-production Verification Script
 *
 * Runs before production deployment to ensure:
 * 1. On main branch
 * 2. No uncommitted changes
 * 3. Tenant isolation passes
 *
 * Usage: node scripts/js/verify-production-ready.mjs
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

console.log(`${BLUE}🔍 Running pre-production verification...${RESET}\n`);

let hasErrors = false;

// ============================================
// 1. CHECK GIT BRANCH
// ============================================
console.log(`${BLUE}1. Checking git branch...${RESET}`);
try {
  const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();

  if (branch !== 'main') {
    console.log(`${RED}❌ FAILED: Not on main branch (current: ${branch})${RESET}`);
    console.log(`${YELLOW}   Switch to main: git checkout main${RESET}\n`);
    hasErrors = true;
  } else {
    console.log(`${GREEN}✅ On main branch${RESET}\n`);
  }
} catch (error) {
  console.log(`${RED}❌ FAILED: Unable to check git branch${RESET}`);
  console.log(`${YELLOW}   Error: ${error.message}${RESET}\n`);
  hasErrors = true;
}

// ============================================
// 2. CHECK UNCOMMITTED CHANGES
// ============================================
console.log(`${BLUE}2. Checking for uncommitted changes...${RESET}`);
try {
  const status = execSync('git status --porcelain', { encoding: 'utf8' });

  if (status.trim() !== '') {
    console.log(`${RED}❌ FAILED: You have uncommitted changes${RESET}`);
    console.log(`${YELLOW}   Commit or stash your changes first:${RESET}`);
    console.log(`${YELLOW}   git add . && git commit -m "your message"${RESET}\n`);
    console.log(`${YELLOW}   Uncommitted files:${RESET}`);
    console.log(status);
    hasErrors = true;
  } else {
    console.log(`${GREEN}✅ No uncommitted changes${RESET}\n`);
  }
} catch (error) {
  console.log(`${RED}❌ FAILED: Unable to check git status${RESET}`);
  console.log(`${YELLOW}   Error: ${error.message}${RESET}\n`);
  hasErrors = true;
}

// ============================================
// 3. RUN TENANT ISOLATION TESTS
// ============================================
console.log(`${BLUE}3. Running tenant isolation tests...${RESET}`);
try {
  // Check if verify-tenant-isolation.mjs exists
  const scriptPath = './scripts/js/verify-tenant-isolation.mjs';

  try {
    readFileSync(scriptPath);
  } catch {
    console.log(`${YELLOW}⚠️  WARNING: Tenant isolation script not found (${scriptPath})${RESET}`);
    console.log(`${YELLOW}   Skipping tenant isolation check${RESET}\n`);
  }

  // Run the tenant isolation check
  execSync('node scripts/js/verify-tenant-isolation.mjs', {
    stdio: 'inherit',
    encoding: 'utf8'
  });

  console.log(`${GREEN}✅ Tenant isolation tests passed${RESET}\n`);
} catch (error) {
  console.log(`${RED}❌ FAILED: Tenant isolation tests failed${RESET}`);
  console.log(`${YELLOW}   Fix tenant isolation issues before deploying to production${RESET}\n`);
  hasErrors = true;
}

// ============================================
// 4. CHECK ENVIRONMENT VARIABLES
// ============================================
console.log(`${BLUE}4. Checking critical environment variables...${RESET}`);
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'UNIPILE_DSN',
  'UNIPILE_API_KEY',
  'OPENROUTER_API_KEY'
];

const missingVars = [];
for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    missingVars.push(varName);
  }
}

if (missingVars.length > 0) {
  console.log(`${YELLOW}⚠️  WARNING: Missing environment variables:${RESET}`);
  missingVars.forEach(varName => {
    console.log(`${YELLOW}   - ${varName}${RESET}`);
  });
  console.log(`${YELLOW}   These should be set in Netlify (netlify env:set VAR_NAME "value")${RESET}\n`);
  // Don't fail for env vars - they're set in Netlify
} else {
  console.log(`${GREEN}✅ All critical environment variables present locally${RESET}\n`);
}

// ============================================
// FINAL VERDICT
// ============================================
console.log(`${BLUE}════════════════════════════════════════${RESET}`);

if (hasErrors) {
  console.log(`${RED}❌ PRE-PRODUCTION VERIFICATION FAILED${RESET}`);
  console.log(`${YELLOW}Fix the errors above before deploying to production${RESET}`);
  console.log(`${BLUE}════════════════════════════════════════${RESET}\n`);
  process.exit(1);
} else {
  console.log(`${GREEN}✅ PRE-PRODUCTION VERIFICATION PASSED${RESET}`);
  console.log(`${GREEN}Ready to deploy to production${RESET}`);
  console.log(`${BLUE}════════════════════════════════════════${RESET}\n`);
  process.exit(0);
}
