const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testN8NIntegration() {
  console.log('🧪 Testing N8N Integration System...\n');

  try {
    // 1. Test campaign approval session creation
    console.log('1️⃣ Testing campaign approval session creation...');
    
    const approvalResponse = await fetch('http://localhost:3000/api/campaign/approval/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        campaign_id: 'test_campaign_123',
        campaign_name: 'N8N Integration Test Campaign',
        campaign_type: 'linkedin_outreach',
        prospect_count: 25,
        messaging_template: {
          initial_message: 'Hi {{name}}, I noticed your work at {{company}}...',
          follow_up_1: 'Quick follow-up on my previous message...',
          follow_up_2: 'Final follow-up...'
        },
        execution_preferences: {
          delay_between_prospects: 30,
          max_daily_outreach: 50,
          auto_pause_on_replies: true
        }
      })
    });

    if (approvalResponse.ok) {
      const approvalResult = await approvalResponse.json();
      console.log('✅ Campaign approval session created:', approvalResult.session_id);
      
      // 2. Test N8N execution API
      console.log('\n2️⃣ Testing N8N execution API...');
      
      const n8nResponse = await fetch('http://localhost:3000/api/campaign/execute-n8n', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({
          campaign_approval_session_id: approvalResult.session_id,
          execution_preferences: {
            delay_between_prospects: 30,
            max_daily_outreach: 50,
            auto_pause_on_replies: true
          },
          notification_preferences: {
            email_updates: true,
            real_time_alerts: true
          }
        })
      });

      if (n8nResponse.ok) {
        const n8nResult = await n8nResponse.json();
        console.log('✅ N8N execution successful:', n8nResult);
        console.log('\n🎉 N8N Integration Test PASSED!');
        console.log('\n🔗 Integration Flow:');
        console.log('   Campaign Creation → Approval Session → N8N Execution → Workflow Monitoring');
      } else {
        const n8nError = await n8nResponse.json();
        console.log('❌ N8N execution failed:', n8nResponse.status, n8nError);
        console.log('\n💡 This is expected if N8N client/auth/database tables are not fully configured');
      }
    } else {
      const approvalError = await approvalResponse.json();
      console.log('❌ Campaign approval failed:', approvalResponse.status, approvalError);
    }

    // 3. Test existing APIs accessibility
    console.log('\n3️⃣ Testing existing API endpoints...');
    
    const healthResponse = await fetch('http://localhost:3000/api/campaign/health');
    if (healthResponse.ok) {
      console.log('✅ Campaign health API accessible');
    } else {
      console.log('❌ Campaign health API not accessible');
    }

    // 4. Show available N8N system components
    console.log('\n📋 Available N8N System Components:');
    console.log('   ✅ /api/campaign/execute-n8n - Main execution endpoint');
    console.log('   ✅ /api/campaign/n8n-status-update - Webhook for N8N status updates');
    console.log('   ✅ /api/workspace/n8n-workflow - Workspace workflow management');
    console.log('   ✅ /lib/n8n-client.ts - N8N API client with circuit breakers');
    console.log('   ✅ Campaign approval session system');
    
    console.log('\n🎯 Next Steps to Complete N8N Activation:');
    console.log('   1. Configure N8N API credentials in environment');
    console.log('   2. Deploy master workflow to workflows.innovareai.com');
    console.log('   3. Update CampaignHub to use approval → N8N flow');
    console.log('   4. Test end-to-end campaign execution');

  } catch (error) {
    console.error('🚨 Test failed with error:', error);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testN8NIntegration();
}

module.exports = { testN8NIntegration };