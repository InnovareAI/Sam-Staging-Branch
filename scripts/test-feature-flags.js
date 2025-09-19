#!/usr/bin/env node

/**
 * Test script to verify feature flag system is working correctly
 */

// Set environment variable for testing
process.env.NEXT_PUBLIC_ROLLOUT_PHASE = 'phase1';

// Import feature flag utilities
import { getFeatureFlags, isFeatureEnabled, getEnabledFeatures, getCurrentPhase, getPhaseDescription } from '../app/lib/feature-flags.js';

console.log('🚀 Testing Feature Flag System for Phase 1 Deployment\n');

console.log('Current Phase:', getCurrentPhase());
console.log('Phase Description:', getPhaseDescription(getCurrentPhase()));
console.log('');

console.log('📋 Testing Phase 1 Features:');
const phase1Features = [
  'core_authentication',
  'workspace_separation', 
  'sam_chat_interface',
  'knowledge_base_access',
  'icp_configuration'
];

phase1Features.forEach(feature => {
  const enabled = isFeatureEnabled(feature);
  console.log(`  ${enabled ? '✅' : '❌'} ${feature}: ${enabled ? 'ENABLED' : 'DISABLED'}`);
});

console.log('\n📋 Testing Phase 2+ Features (Should be disabled):');
const laterPhaseFeatures = [
  'prospect_upload',
  'linkedin_integration', 
  'email_integration',
  'n8n_workflow_integration',
  'website_monitoring'
];

laterPhaseFeatures.forEach(feature => {
  const enabled = isFeatureEnabled(feature);
  console.log(`  ${!enabled ? '✅' : '❌'} ${feature}: ${enabled ? 'ENABLED' : 'DISABLED'}`);
});

console.log('\n🎯 All Enabled Features:');
const enabledFeatures = getEnabledFeatures();
enabledFeatures.forEach(feature => {
  console.log(`  ✅ ${feature}`);
});

console.log('\n📊 Feature Flag Test Results:');
const allPhase1Enabled = phase1Features.every(feature => isFeatureEnabled(feature));
const allLaterPhasesDisabled = laterPhaseFeatures.every(feature => !isFeatureEnabled(feature));

console.log(`  Phase 1 Features: ${allPhase1Enabled ? '✅ PASS' : '❌ FAIL'}`);
console.log(`  Later Phase Features: ${allLaterPhasesDisabled ? '✅ PASS' : '❌ FAIL'}`);
console.log(`  Overall Test: ${allPhase1Enabled && allLaterPhasesDisabled ? '✅ PASS' : '❌ FAIL'}`);

if (allPhase1Enabled && allLaterPhasesDisabled) {
  console.log('\n🎉 Phase 1 deployment feature flags are correctly configured!');
  process.exit(0);
} else {
  console.log('\n❌ Feature flag configuration has issues!');
  process.exit(1);
}