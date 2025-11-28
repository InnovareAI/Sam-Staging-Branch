// Create AS1 workspace for Asphericon
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://latxadqrvrrrcvkktrog.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const email = 'admin+cl1@innovareai.com';
const password = 'w3a8FpmDdT313I5';
const companyName = 'CL1 Company';
const workspaceCode = 'CL1';
const firstName = 'Brian';
const lastName = 'Neirby';

async function createWorkspace() {
  console.log('Creating user:', email);

  // 1. Create user
  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: `${firstName} ${lastName}`
    }
  });

  if (userError) {
    console.error('Error creating user:', userError);
    return;
  }

  console.log('User created:', userData.user.id);
  const userId = userData.user.id;

  // 2. Create workspace
  console.log('Creating workspace:', workspaceCode);
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .insert({
      name: companyName,
      slug: workspaceCode.toLowerCase(),
      owner_id: userId,
      settings: {
        company_name: companyName,
        workspace_code: workspaceCode
      }
    })
    .select()
    .single();

  if (wsError) {
    console.error('Error creating workspace:', wsError);
    return;
  }

  console.log('Workspace created:', workspace.id);

  // 3. Create user record in users table
  console.log('Creating user profile...');
  const { error: profileError } = await supabase
    .from('users')
    .insert({
      id: userId,
      email: email,
      first_name: firstName,
      last_name: lastName,
      current_workspace_id: workspace.id,
      email_verified: true
    });

  if (profileError) {
    console.error('Error creating user profile:', profileError);
    // Continue - might already exist
  }

  // 4. Add user to workspace_members
  console.log('Adding user to workspace members...');
  const { error: memberError } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspace.id,
      user_id: userId,
      role: 'owner'
    });

  if (memberError) {
    console.error('Error adding to workspace_members:', memberError);
    return;
  }

  // 5. Initialize KB sections
  console.log('Initializing KB sections...');
  const { error: kbError } = await supabase.rpc('initialize_knowledge_base_sections', {
    p_workspace_id: workspace.id
  });

  if (kbError) {
    console.error('Error initializing KB sections:', kbError);
  }

  console.log('\n=== SUCCESS ===');
  console.log('Workspace ID:', workspace.id);
  console.log('User ID:', userId);
  console.log('Email:', email);
  console.log('Password:', password);
  console.log('Company:', companyName);
  console.log('Login URL: https://app.meet-sam.com');
}

createWorkspace().catch(console.error);
