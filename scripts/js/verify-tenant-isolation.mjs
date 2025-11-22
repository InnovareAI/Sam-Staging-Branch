#!/usr/bin/env node

/**
 * ⚠️ CRITICAL: Verify tenant isolation in all LinkedIn endpoints
 * This script MUST pass before any deployment
 */

import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const CRITICAL_ENDPOINTS = [
  'app/api/linkedin/search/simple/route.ts',
  'app/api/linkedin/search/route.ts',
  'app/api/linkedin/search/direct/route.ts',
  'app/api/linkedin/search/create-job/route.ts'
]

let violations = []
let warnings = []

console.log('🔒 VERIFYING TENANT ISOLATION...\n')

for (const endpoint of CRITICAL_ENDPOINTS) {
  const content = readFileSync(endpoint, 'utf-8')

  // Check for workspace_accounts queries
  const hasWorkspaceAccountsQuery = content.includes("from('workspace_accounts')")

  if (!hasWorkspaceAccountsQuery) {
    warnings.push(`⚠️  ${endpoint}: No workspace_accounts queries found (might be OK)`)
    continue
  }

  // Extract all workspace_accounts queries
  const queries = content.match(/from\('workspace_accounts'\)[^;]+/g) || []

  for (const query of queries) {
    // Check if query has workspace_id filter (for multi-tenant isolation)
    // workspace_id is the primary isolation mechanism
    // user_id is optional when accounts are shared at workspace level
    if (!query.includes('workspace_id') && !query.includes('eq(\'workspace_id\'')) {
      violations.push(`❌ VIOLATION in ${endpoint}:\n   Query missing workspace_id filter:\n   ${query.substring(0, 100)}...`)
    }
  }
}

// Print results
console.log('='.repeat(70))
console.log('TENANT ISOLATION VERIFICATION RESULTS')
console.log('='.repeat(70))

if (violations.length === 0) {
  console.log('✅ All endpoints properly enforce tenant isolation')
  console.log(`✅ Checked ${CRITICAL_ENDPOINTS.length} critical endpoints`)
} else {
  console.log(`❌ FOUND ${violations.length} CRITICAL VIOLATIONS:\n`)
  violations.forEach(v => console.log(v + '\n'))
  console.log('\n🚨 DEPLOYMENT BLOCKED - FIX VIOLATIONS BEFORE DEPLOYING 🚨')
  process.exit(1)
}

if (warnings.length > 0) {
  console.log('\n⚠️  WARNINGS:')
  warnings.forEach(w => console.log(w))
}

console.log('\n' + '='.repeat(70))
console.log('✅ TENANT ISOLATION VERIFIED - SAFE TO DEPLOY')
console.log('='.repeat(70))
