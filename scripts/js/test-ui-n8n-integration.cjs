const fs = require('fs');

function testUIIntegration() {
  console.log('🧪 Testing Campaign UI N8N Integration...');
  console.log('');

  try {
    // Read the CampaignHub component
    const campaignHubPath = '/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/app/components/CampaignHub.tsx';
    const campaignHubContent = fs.readFileSync(campaignHubPath, 'utf8');

    console.log('📊 **UI INTEGRATION TESTS:**');
    console.log('');

    // Test 1: Check for N8N endpoint usage
    const hasN8NEndpoint = campaignHubContent.includes('/api/campaigns/linkedin/execute-via-n8n');
    console.log(`✅ N8N endpoint usage: ${hasN8NEndpoint ? '✅' : '❌'}`);

    // Test 2: Check for execution type state
    const hasExecutionTypeState = campaignHubContent.includes('setExecutionType');
    console.log(`✅ Execution type state: ${hasExecutionTypeState ? '✅' : '❌'}`);

    // Test 3: Check for execution types definition
    const hasExecutionTypesDefinition = campaignHubContent.includes('const executionTypes = [') && 
                                        campaignHubContent.includes("'intelligence'") &&
                                        campaignHubContent.includes("'event_invitation'") &&
                                        campaignHubContent.includes("'direct_linkedin'");
    console.log(`✅ Execution types definition: ${hasExecutionTypesDefinition ? '✅' : '❌'}`);

    // Test 4: Check for UI execution type selection
    const hasExecutionTypeUI = campaignHubContent.includes('Execution Mode') && 
                               campaignHubContent.includes('executionTypes.map');
    console.log(`✅ Execution mode UI: ${hasExecutionTypeUI ? '✅' : '❌'}`);

    // Test 5: Check for dynamic execution type usage
    const hasDynamicExecutionType = campaignHubContent.includes('executionType: executionType');
    console.log(`✅ Dynamic execution type: ${hasDynamicExecutionType ? '✅' : '❌'}`);

    // Test 6: Check for enhanced success message
    const hasEnhancedMessage = campaignHubContent.includes('N8N automation') && 
                               campaignHubContent.includes('estimated_completion_time');
    console.log(`✅ Enhanced success message: ${hasEnhancedMessage ? '✅' : '❌'}`);

    // Test 7: Check for Brain icon import
    const hasBrainIcon = campaignHubContent.includes('Brain') && 
                         campaignHubContent.includes('from \'lucide-react\'');
    console.log(`✅ Brain icon import: ${hasBrainIcon ? '✅' : '❌'}`);

    console.log('');

    // Test other files for N8N endpoint updates
    console.log('📊 **OTHER FILE INTEGRATIONS:**');
    console.log('');

    // Test MCP orchestration update
    const mcpPath = '/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/lib/mcp/campaign-orchestration-mcp.ts';
    const mcpContent = fs.readFileSync(mcpPath, 'utf8');
    const mcpHasN8NEndpoint = mcpContent.includes('/api/campaigns/linkedin/execute-via-n8n');
    console.log(`✅ MCP N8N endpoint: ${mcpHasN8NEndpoint ? '✅' : '❌'}`);

    // Test SAM campaign manager update
    const samPath = '/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/app/api/sam/campaign-manager/route.ts';
    const samContent = fs.readFileSync(samPath, 'utf8');
    const samHasN8NEndpoint = samContent.includes('/api/campaigns/linkedin/execute-via-n8n');
    console.log(`✅ SAM Manager N8N endpoint: ${samHasN8NEndpoint ? '✅' : '❌'}`);

    console.log('');

    // Count execution type options
    const intelligenceCount = (campaignHubContent.match(/intelligence/g) || []).length;
    const eventInvitationCount = (campaignHubContent.match(/event_invitation/g) || []).length;
    const directLinkedinCount = (campaignHubContent.match(/direct_linkedin/g) || []).length;

    console.log('📊 **EXECUTION TYPE INTEGRATION:**');
    console.log(`  • Intelligence Campaign: ${intelligenceCount} references`);
    console.log(`  • Event Invitation Campaign: ${eventInvitationCount} references`);
    console.log(`  • Direct LinkedIn Campaign: ${directLinkedinCount} references`);

    console.log('');

    // Verify all tests passed
    const allTests = [
      hasN8NEndpoint,
      hasExecutionTypeState,
      hasExecutionTypesDefinition,
      hasExecutionTypeUI,
      hasDynamicExecutionType,
      hasEnhancedMessage,
      hasBrainIcon,
      mcpHasN8NEndpoint,
      samHasN8NEndpoint
    ];

    const passedTests = allTests.filter(test => test).length;
    const totalTests = allTests.length;

    console.log('🎯 **SUMMARY:**');
    console.log(`  • Tests Passed: ${passedTests}/${totalTests}`);
    console.log(`  • Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);

    if (passedTests === totalTests) {
      console.log('');
      console.log('🎉 **ALL TESTS PASSED!**');
      console.log('✅ Campaign UI successfully updated to use N8N execution endpoint');
      console.log('✅ Three execution types available for user selection');
      console.log('✅ Enhanced user experience with execution time estimates');
      console.log('✅ All integration points updated consistently');
    } else {
      console.log('');
      console.log('⚠️ **SOME TESTS FAILED**');
      console.log('Please review the failing integration points above');
    }

    console.log('');
    console.log('🚀 **NEXT STEPS:**');
    console.log('  1. Deploy to production environment');
    console.log('  2. Test campaign creation with different execution types');
    console.log('  3. Monitor N8N workflow execution and responses');
    console.log('  4. Verify LinkedIn connectivity improvements');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Execute the test
testUIIntegration();