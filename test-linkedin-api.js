// Test script to simulate the exact query from /api/linkedin/connect
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service role for read access
const supabase = createClient(supabaseUrl, supabaseKey);

async function testLinkedInAPI() {
  console.log('🧪 TESTING: /api/linkedin/connect API Logic');
  console.log('=' .repeat(80));
  
  try {
    // User from our debug script
    const userId = 'a948a612-9a42-41aa-84a9-d368d9090054'; // tl@innovareai.com
    const workspaceId = 'c86ecbcf-a28d-445d-b030-485804c9255d';
    
    console.log(`👤 Testing user: ${userId}`);
    console.log(`🏢 Testing workspace: ${workspaceId}`);
    console.log('');
    
    // Step 1: Get user's current workspace (like the API does)
    console.log('📋 Step 1: Get user profile (current_workspace_id)');
    const { data: userProfile } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', userId)
      .single();
    
    console.log(`   ✅ Current workspace: ${userProfile?.current_workspace_id}`);
    console.log(`   ✅ Workspace match: ${userProfile?.current_workspace_id === workspaceId}`);
    console.log('');
    
    // Step 2: Query LinkedIn associations (exact same query as API)
    console.log('📋 Step 2: Query LinkedIn associations (exact API query)');
    const { data: associations, error: queryError } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('account_type', 'linkedin');
    
    if (queryError) {
      console.error('   ❌ Query error:', queryError);
    } else {
      console.log(`   ✅ Query successful, found ${associations?.length || 0} associations`);
      console.log('   📄 Raw associations data:');
      associations?.forEach((assoc, index) => {
        console.log(`      ${index + 1}. ${assoc.account_name} (${assoc.connection_status})`);
      });
    }
    console.log('');
    
    // Step 3: Check environment configuration
    console.log('📋 Step 3: Check environment configuration');
    const unipileDsn = process.env.UNIPILE_DSN;
    const unipileApiKey = process.env.UNIPILE_API_KEY;
    const configurationReady = !!(unipileDsn && unipileApiKey);
    
    console.log(`   ✅ UNIPILE_DSN: ${unipileDsn ? 'SET' : 'MISSING'}`);
    console.log(`   ✅ UNIPILE_API_KEY: ${unipileApiKey ? 'SET' : 'MISSING'}`);
    console.log(`   ✅ Configuration ready: ${configurationReady}`);
    console.log('');
    
    // Step 4: Build API response (same logic as the API)
    console.log('📋 Step 4: Build API response (same logic as /api/linkedin/connect)');
    const hasLinkedIn = (associations && associations.length > 0);
    const response = {
      success: true,
      configuration_ready: configurationReady,
      has_linkedin: hasLinkedIn,
      associations: associations || [],
      count: associations?.length || 0,
      workspace_id: workspaceId,
      capabilities: {
        can_connect: configurationReady,
        can_reconnect: configurationReady && associations && associations.length > 0,
        hosted_auth_available: configurationReady
      },
      timestamp: new Date().toISOString()
    };
    
    console.log('   📄 API Response:');
    console.log(JSON.stringify(response, null, 2));
    console.log('');
    
    // Step 5: Analysis
    console.log('📋 Step 5: Analysis');
    if (hasLinkedIn) {
      console.log('   ✅ SUCCESS: LinkedIn accounts found and should show as connected');
      console.log(`   ✅ Frontend should receive has_linkedin: true with ${associations.length} associations`);
    } else {
      console.log('   ❌ ISSUE: No LinkedIn accounts found despite database having them');
      console.log('   ❌ This explains why frontend shows "LinkedIn not connected"');
    }
    
  } catch (error) {
    console.error('💥 Test error:', error);
  }
}

// Run the test
testLinkedInAPI();