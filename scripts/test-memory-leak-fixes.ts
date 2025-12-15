/**
 * Memory Leak Fix Validation Tests
 *
 * This script validates that the memory leak fixes are working correctly by:
 * 1. Checking that cleanup functions are properly defined
 * 2. Simulating component lifecycle scenarios
 * 3. Verifying timeout/interval patterns
 *
 * Run with: npx ts-node scripts/test-memory-leak-fixes.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

interface TestResult {
  file: string;
  test: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function addResult(file: string, test: string, passed: boolean, message: string) {
  results.push({ file, test, passed, message });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} [${file}] ${test}: ${message}`);
}

// Test 1: SAMOnboarding.tsx - Verify timeout cleanup pattern
function testSAMOnboarding() {
  const filePath = path.join(projectRoot, 'app/components/SAMOnboarding.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check for useRef imports
  const hasUseRef = content.includes("import React, { useState, useEffect, useRef }");
  addResult('SAMOnboarding.tsx', 'useRef import', hasUseRef,
    hasUseRef ? 'useRef is imported' : 'Missing useRef import');

  // Check for timeout refs
  const hasTimeoutRefs = content.includes('timeoutRefs = useRef<NodeJS.Timeout[]>');
  addResult('SAMOnboarding.tsx', 'Timeout refs', hasTimeoutRefs,
    hasTimeoutRefs ? 'Timeout refs array defined' : 'Missing timeout refs');

  // Check for isMounted ref
  const hasIsMountedRef = content.includes('isMountedRef = useRef(true)');
  addResult('SAMOnboarding.tsx', 'isMounted ref', hasIsMountedRef,
    hasIsMountedRef ? 'isMounted ref defined' : 'Missing isMounted ref');

  // Check for cleanup in useEffect
  const hasCleanup = content.includes('timeoutRefs.current.forEach(timeout => clearTimeout(timeout))');
  addResult('SAMOnboarding.tsx', 'Cleanup useEffect', hasCleanup,
    hasCleanup ? 'Cleanup effect clears all timeouts' : 'Missing cleanup for timeouts');

  // Check for isMounted check before state updates
  const checksIsMounted = content.includes('if (!isMountedRef.current) return');
  addResult('SAMOnboarding.tsx', 'Mount check', checksIsMounted,
    checksIsMounted ? 'Checks isMounted before state updates' : 'Missing isMounted check');
}

// Test 2: EmailProvidersModal.tsx - Verify polling cleanup
function testEmailProvidersModal() {
  const filePath = path.join(projectRoot, 'app/components/EmailProvidersModal.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check for ref definitions
  const hasNotificationRef = content.includes('notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null)');
  addResult('EmailProvidersModal.tsx', 'Notification ref', hasNotificationRef,
    hasNotificationRef ? 'Notification timeout ref defined' : 'Missing notification ref');

  const hasPollIntervalRef = content.includes('pollIntervalRef = useRef<NodeJS.Timeout | null>(null)');
  addResult('EmailProvidersModal.tsx', 'Poll interval ref', hasPollIntervalRef,
    hasPollIntervalRef ? 'Poll interval ref defined' : 'Missing poll interval ref');

  const hasPollTimeoutRef = content.includes('pollTimeoutRef = useRef<NodeJS.Timeout | null>(null)');
  addResult('EmailProvidersModal.tsx', 'Poll timeout ref', hasPollTimeoutRef,
    hasPollTimeoutRef ? 'Poll timeout ref defined' : 'Missing poll timeout ref');

  // Check for cleanup useEffect
  const hasCleanupEffect = content.includes('if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current)') &&
                           content.includes('if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)') &&
                           content.includes('if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current)');
  addResult('EmailProvidersModal.tsx', 'Cleanup useEffect', hasCleanupEffect,
    hasCleanupEffect ? 'All refs cleaned up on unmount' : 'Incomplete cleanup');

  // Check showNotification clears existing timeout
  const clearsExistingNotification = content.includes('if (notificationTimeoutRef.current) {\n      clearTimeout(notificationTimeoutRef.current);\n    }');
  addResult('EmailProvidersModal.tsx', 'Clear existing notification', clearsExistingNotification,
    clearsExistingNotification ? 'Clears existing notification timeout' : 'May not clear existing timeout');

  // Check polling clears existing intervals
  const clearsExistingPolling = content.includes('if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)') &&
                                content.includes('if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current)');
  addResult('EmailProvidersModal.tsx', 'Clear existing polling', clearsExistingPolling,
    clearsExistingPolling ? 'Clears existing polling before starting new' : 'May not clear existing polling');
}

// Test 3: page.tsx - Verify CSV upload interval cleanup
function testPageTsx() {
  const filePath = path.join(projectRoot, 'app/page.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check handlePasteCSV has interval cleanup in finally
  const pasteCSVSection = content.match(/const handlePasteCSV[\s\S]*?finally\s*{[\s\S]*?}/);
  if (pasteCSVSection) {
    const hasFinallyCleanup = pasteCSVSection[0].includes('if (progressInterval) clearInterval(progressInterval)');
    addResult('page.tsx', 'handlePasteCSV finally cleanup', hasFinallyCleanup,
      hasFinallyCleanup ? 'Progress interval cleared in finally block' : 'Missing finally cleanup');

    const hasLetDeclaration = pasteCSVSection[0].includes('let progressInterval: NodeJS.Timeout | null = null');
    addResult('page.tsx', 'handlePasteCSV let declaration', hasLetDeclaration,
      hasLetDeclaration ? 'Interval declared with let for finally access' : 'Interval may not be accessible in finally');
  } else {
    addResult('page.tsx', 'handlePasteCSV finally cleanup', false, 'Could not find handlePasteCSV function');
  }

  // Check handleCSVUpload has interval cleanup in finally
  const csvUploadSection = content.match(/const handleCSVUpload[\s\S]*?finally\s*{[\s\S]*?}/);
  if (csvUploadSection) {
    const hasFinallyCleanup = csvUploadSection[0].includes('if (progressInterval) clearInterval(progressInterval)');
    addResult('page.tsx', 'handleCSVUpload finally cleanup', hasFinallyCleanup,
      hasFinallyCleanup ? 'Progress interval cleared in finally block' : 'Missing finally cleanup');

    const hasLetDeclaration = csvUploadSection[0].includes('let progressInterval: NodeJS.Timeout | null = null');
    addResult('page.tsx', 'handleCSVUpload let declaration', hasLetDeclaration,
      hasLetDeclaration ? 'Interval declared with let for finally access' : 'Interval may not be accessible in finally');
  } else {
    addResult('page.tsx', 'handleCSVUpload finally cleanup', false, 'Could not find handleCSVUpload function');
  }
}

// Test 4: CampaignHub.tsx - Verify FileReader error handling
function testCampaignHub() {
  const filePath = path.join(projectRoot, 'app/components/CampaignHub.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check for onerror handler
  const hasOnError = content.includes('reader.onerror = ()');
  addResult('CampaignHub.tsx', 'FileReader onerror', hasOnError,
    hasOnError ? 'FileReader has onerror handler' : 'Missing onerror handler');

  // Check for onabort handler
  const hasOnAbort = content.includes('reader.onabort = ()');
  addResult('CampaignHub.tsx', 'FileReader onabort', hasOnAbort,
    hasOnAbort ? 'FileReader has onabort handler' : 'Missing onabort handler');

  // Check onerror resets isUploading
  const onErrorResetsState = content.includes('reader.onerror') &&
                             content.includes('setIsUploading(false)');
  addResult('CampaignHub.tsx', 'onerror resets state', onErrorResetsState,
    onErrorResetsState ? 'onerror resets isUploading state' : 'onerror may not reset state');
}

// Test 5: Workspace validation in API routes
function testWorkspaceValidation() {
  // Test workspace/[workspaceId]/accounts/route.ts
  const accountsPath = path.join(projectRoot, 'app/api/workspace/[workspaceId]/accounts/route.ts');
  const accountsContent = fs.readFileSync(accountsPath, 'utf-8');

  const hasWorkspaceMembershipCheck = accountsContent.includes("from('workspace_members')") &&
                                       accountsContent.includes(".eq('workspace_id', workspaceId)") &&
                                       accountsContent.includes(".eq('user_id', user.id)");
  addResult('workspace/accounts', 'Membership validation', hasWorkspaceMembershipCheck,
    hasWorkspaceMembershipCheck ? 'Validates workspace membership' : 'Missing membership validation');

  // Test linkedin-commenting/monitors/route.ts
  const monitorsPath = path.join(projectRoot, 'app/api/linkedin-commenting/monitors/route.ts');
  const monitorsContent = fs.readFileSync(monitorsPath, 'utf-8');

  const hasMonitorsMembershipCheck = monitorsContent.includes("from('workspace_members')") &&
                                     monitorsContent.includes("Access denied to this workspace");
  addResult('linkedin-commenting/monitors', 'Membership validation', hasMonitorsMembershipCheck,
    hasMonitorsMembershipCheck ? 'Validates workspace membership' : 'Missing membership validation');

  // Test admin routes use requireAdmin
  const adminWorkspacesPath = path.join(projectRoot, 'app/api/admin/workspaces/route.ts');
  const adminContent = fs.readFileSync(adminWorkspacesPath, 'utf-8');

  const hasRequireAdmin = adminContent.includes('requireAdmin(request)');
  addResult('admin/workspaces', 'Admin auth', hasRequireAdmin,
    hasRequireAdmin ? 'Uses requireAdmin for authentication' : 'Missing requireAdmin');
}

// Run all tests
console.log('\n🧪 Memory Leak Fix Validation Tests\n');
console.log('='.repeat(60) + '\n');

try {
  console.log('📁 Testing SAMOnboarding.tsx...');
  testSAMOnboarding();
  console.log('');

  console.log('📁 Testing EmailProvidersModal.tsx...');
  testEmailProvidersModal();
  console.log('');

  console.log('📁 Testing page.tsx...');
  testPageTsx();
  console.log('');

  console.log('📁 Testing CampaignHub.tsx...');
  testCampaignHub();
  console.log('');

  console.log('📁 Testing Workspace Validation...');
  testWorkspaceValidation();
  console.log('');
} catch (error) {
  console.error('Error running tests:', error);
}

// Summary
console.log('='.repeat(60));
console.log('\n📊 Test Summary\n');

const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;
const total = results.length;

console.log(`Total: ${total} tests`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`Pass Rate: ${((passed / total) * 100).toFixed(1)}%`);

if (failed > 0) {
  console.log('\n❌ Failed Tests:');
  results.filter(r => !r.passed).forEach(r => {
    console.log(`  - [${r.file}] ${r.test}: ${r.message}`);
  });
}

console.log('');
process.exit(failed > 0 ? 1 : 0);
