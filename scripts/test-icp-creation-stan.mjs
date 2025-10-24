import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testICPCreation() {
  const stanUserId = '6a927440-ebe1-49b4-ae5e-fbee5d27944d';
  const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';
  
  console.log('🧪 Testing ICP creation for Stan in Blue Label Labs...\n');
  
  // Test insert directly
  console.log('1️⃣ Testing direct insert...');
  const testPayload = {
    workspace_id: workspaceId,
    name: 'Test ICP - Delete Me',
    company_size_min: 10,
    company_size_max: 500,
    industries: ['Technology', 'Software'],
    job_titles: ['CTO', 'VP Engineering'],
    locations: ['United States'],
    technologies: [],
    pain_points: ['Scaling challenges'],
    qualification_criteria: {},
    messaging_framework: {},
    is_active: true,
    created_by: stanUserId
  };
  
  const { data: testIcp, error: testError } = await supabase
    .from('knowledge_base_icps')
    .insert(testPayload)
    .select()
    .single();
    
  if (testError) {
    console.error('   ❌ Insert failed:', testError.message);
    console.error('   Error details:', testError);
    
    // Check if table exists
    console.log('\n2️⃣ Checking if table exists...');
    const { error: tableError } = await supabase
      .from('knowledge_base_icps')
      .select('id')
      .limit(1);
      
    if (tableError) {
      console.error('   ❌ Table might not exist:', tableError.message);
    } else {
      console.log('   ✅ Table exists');
    }
    
    // Check workspace membership
    console.log('\n3️⃣ Checking workspace access...');
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('user_id', stanUserId)
      .eq('workspace_id', workspaceId)
      .single();
      
    if (!membership) {
      console.error('   ❌ Stan is not a workspace member!');
    } else {
      console.log('   ✅ Stan is a member:', membership.role);
    }
    
  } else {
    console.log('   ✅ Test ICP created:', testIcp.id);
    console.log('   ✅ Stan CAN create ICPs!');
    
    // Clean up
    await supabase
      .from('knowledge_base_icps')
      .delete()
      .eq('id', testIcp.id);
    console.log('   🗑️  Test ICP deleted');
  }
}

testICPCreation();
