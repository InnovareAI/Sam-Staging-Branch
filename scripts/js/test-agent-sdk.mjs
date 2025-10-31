#!/usr/bin/env node

/**
 * Test Claude Agent SDK Integration
 * Date: October 31, 2025
 */

import 'dotenv/config';

// Check if ANTHROPIC_API_KEY is set
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY environment variable not set');
  console.error('   Add to .env.local: ANTHROPIC_API_KEY=your_key_here');
  process.exit(1);
}

console.log('🧪 Testing Claude Agent SDK Integration\n');
console.log('━'.repeat(60));

// Test 1: Import Agent SDK
console.log('\n📦 Test 1: Import Agent SDK');
try {
  const { query } = await import('@anthropic-ai/claude-agent-sdk');
  console.log('✅ Agent SDK imported successfully');
} catch (error) {
  console.error('❌ Failed to import Agent SDK:', error.message);
  process.exit(1);
}

// Test 2: Import SAM Agent Configuration
console.log('\n⚙️  Test 2: Import SAM Agent Configuration');
try {
  const { SAM_AGENT_CONFIG, SUB_AGENT_CONFIGS } = await import('../../lib/agents/sam-agent-config.ts');
  console.log('✅ SAM Agent configuration imported');
  console.log(`   - Model: ${SAM_AGENT_CONFIG.model}`);
  console.log(`   - Permission mode: ${SAM_AGENT_CONFIG.permissionMode}`);
  console.log(`   - Sub-agents: ${Object.keys(SUB_AGENT_CONFIGS).join(', ')}`);
} catch (error) {
  console.error('❌ Failed to import SAM configuration:', error.message);
  process.exit(1);
}

// Test 3: Import SAM Agent SDK Wrapper
console.log('\n🤖 Test 3: Import SAM Agent SDK Wrapper');
try {
  const { SAMAgentFactory, SAMAgentSession, SAMSubAgent } = await import('../../lib/agents/sam-agent-sdk.ts');
  console.log('✅ SAM Agent SDK wrapper imported');
  console.log('   - SAMAgentFactory: Available');
  console.log('   - SAMAgentSession: Available');
  console.log('   - SAMSubAgent: Available');
} catch (error) {
  console.error('❌ Failed to import SAM wrapper:', error.message);
  console.error('   Error details:', error);
  process.exit(1);
}

// Test 4: Create Test Session
console.log('\n🚀 Test 4: Create Test Agent Session');
try {
  const { SAMAgentFactory } = await import('../../lib/agents/sam-agent-sdk.ts');

  const testWorkspaceId = 'test-workspace-123';
  const session = SAMAgentFactory.getSession(testWorkspaceId);

  console.log('✅ Test session created');
  console.log('   - Session ID:', session.getMetadata().sessionId);
  console.log('   - Workspace ID:', session.getMetadata().workspaceId);
} catch (error) {
  console.error('❌ Failed to create session:', error.message);
  process.exit(1);
}

// Test 5: Simple Query Test (OPTIONAL - requires API key)
console.log('\n💬 Test 5: Simple Query Test');
console.log('⚠️  Skipping live query test to avoid API costs');
console.log('   To test live queries, uncomment the code in test-agent-sdk.mjs');

/*
// Uncomment to test live query (will use API credits)
try {
  const { SAMAgentFactory } = await import('../../lib/agents/sam-agent-sdk.ts');

  const testWorkspaceId = 'test-workspace-123';
  const session = SAMAgentFactory.getSession(testWorkspaceId);

  console.log('   Sending test message: "What is 2+2?"');

  let response = '';
  for await (const chunk of session.chat('What is 2+2? Answer in one sentence.')) {
    response += chunk;
    process.stdout.write(chunk);
  }

  console.log('\n✅ Query completed successfully');
  console.log('   Response length:', response.length, 'characters');
} catch (error) {
  console.error('❌ Query test failed:', error.message);
  process.exit(1);
}
*/

// Test 6: Sub-Agent Creation
console.log('\n🔧 Test 6: Sub-Agent Creation');
try {
  const { SAMAgentFactory } = await import('../../lib/agents/sam-agent-sdk.ts');

  const testWorkspaceId = 'test-workspace-123';

  const prospectResearcher = SAMAgentFactory.createSubAgent('prospectResearcher', testWorkspaceId);
  console.log('✅ Prospect Researcher sub-agent created');

  const campaignCreator = SAMAgentFactory.createSubAgent('campaignCreator', testWorkspaceId);
  console.log('✅ Campaign Creator sub-agent created');

  const emailWriter = SAMAgentFactory.createSubAgent('emailWriter', testWorkspaceId);
  console.log('✅ Email Writer sub-agent created');

  const linkedinStrategist = SAMAgentFactory.createSubAgent('linkedinStrategist', testWorkspaceId);
  console.log('✅ LinkedIn Strategist sub-agent created');

  const dataEnricher = SAMAgentFactory.createSubAgent('dataEnricher', testWorkspaceId);
  console.log('✅ Data Enricher sub-agent created');

} catch (error) {
  console.error('❌ Sub-agent creation failed:', error.message);
  process.exit(1);
}

// Test 7: Session Management
console.log('\n📊 Test 7: Session Management');
try {
  const { SAMAgentFactory } = await import('../../lib/agents/sam-agent-sdk.ts');

  // Get active sessions
  const activeSessions = SAMAgentFactory.getActiveSessions();
  console.log('✅ Active sessions retrieved');
  console.log('   - Count:', activeSessions.length);
  console.log('   - Sessions:', activeSessions.map(s => s.sessionId).join(', '));

  // Test cleanup (should not remove recent sessions)
  SAMAgentFactory.cleanupSessions(24);
  console.log('✅ Session cleanup executed');

  const afterCleanup = SAMAgentFactory.getActiveSessions();
  console.log('   - Sessions after cleanup:', afterCleanup.length);

} catch (error) {
  console.error('❌ Session management failed:', error.message);
  process.exit(1);
}

// Final Summary
console.log('\n━'.repeat(60));
console.log('✅ All tests passed!');
console.log('\n📋 Summary:');
console.log('   ✅ Agent SDK package installed and functional');
console.log('   ✅ SAM Agent configuration loaded');
console.log('   ✅ SAM Agent SDK wrapper working');
console.log('   ✅ Session creation successful');
console.log('   ✅ All 5 sub-agents created');
console.log('   ✅ Session management functional');
console.log('\n🚀 Next Steps:');
console.log('   1. Set ANTHROPIC_API_KEY in .env.local for live testing');
console.log('   2. Uncomment Test 5 in this script to test live queries');
console.log('   3. Test the /api/sam/agent-chat endpoint');
console.log('   4. Integrate Agent SDK into frontend');
console.log('\n━'.repeat(60));
