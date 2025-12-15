const https = require('https');
const crypto = require('crypto');

const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

function generatePassword() {
  return crypto.randomBytes(12).toString('base64').slice(0, 16).replace(/[+\/=]/g, 'x');
}

function supabaseRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'latxadqrvrrrcvkktrog.supabase.co',
      path: path,
      method: method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    };
    if (method === 'POST') {
      options.headers['Prefer'] = 'return=representation';
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function createUserAndWorkspace(email, name) {
  const password = generatePassword();

  console.log(`\n📧 Creating user: ${email}`);
  console.log(`   Password: ${password}`);

  // Create user via Supabase Auth Admin API
  const userResult = await supabaseRequest('/auth/v1/admin/users', 'POST', {
    email: email,
    password: password,
    email_confirm: true,
    user_metadata: {
      name: name
    }
  });

  if (userResult.status !== 200 && userResult.status !== 201) {
    // Check if user already exists
    if (userResult.data?.error_code === 'email_exists' || userResult.data?.code === 'email_exists' || userResult.raw?.includes('already registered')) {
      console.log('   User already exists, fetching...');
      // Get existing user via list endpoint
      const existingResult = await supabaseRequest(`/auth/v1/admin/users`);
      if (existingResult.status === 200 && existingResult.data?.users?.length > 0) {
        const existingUser = existingResult.data.users.find(u => u.email === email);
        if (existingUser) {
          const userId = existingUser.id;
          console.log(`   Existing User ID: ${userId}`);

          // Check if user already has a workspace
          const existingWorkspaceResult = await supabaseRequest(`/rest/v1/workspaces?owner_id=eq.${userId}`);
          if (Array.isArray(existingWorkspaceResult) && existingWorkspaceResult.length > 0) {
            console.log(`   ✅ Already has workspace: ${existingWorkspaceResult[0].name}`);
            return { userId, workspaceId: existingWorkspaceResult[0].id, password: '(existing - from first run)', email };
          }

          // Create workspace for existing user
          const workspaceName = `${name}'s Workspace`;
          const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '') + Math.random().toString(36).substring(2, 6);
          const workspaceResult = await supabaseRequest('/rest/v1/workspaces', 'POST', {
            name: workspaceName,
            slug: slug,
            owner_id: userId,
            settings: {
              company_name: workspaceName,
              default_timezone: 'America/Los_Angeles'
            },
            subscription_status: 'trial',
            is_active: true,
            tenant: 'innovareai'
          });

          if (workspaceResult.status === 201) {
            const workspaceId = workspaceResult.data?.[0]?.id;
            console.log(`   ✅ Created workspace: ${workspaceName} (${workspaceId})`);

            // Add user as workspace member
            await supabaseRequest('/rest/v1/workspace_members', 'POST', {
              workspace_id: workspaceId,
              user_id: userId,
              role: 'owner',
              invited_by: userId,
              status: 'active'
            });
            console.log('   ✅ Added as workspace owner');

            return { userId, workspaceId, password: '(existing - from first run)', email };
          } else {
            console.log('   ❌ Error creating workspace:', workspaceResult.data || workspaceResult.raw);
          }

          return { userId, password: '(existing - from first run)', email };
        }
      }
    }
    console.log('   ❌ Error creating user:', userResult.data || userResult.raw);
    return null;
  }

  const userId = userResult.data?.id;
  console.log(`   ✅ User ID: ${userId}`);

  // Create workspace
  const workspaceName = `${name}'s Workspace`;
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '') + Math.random().toString(36).substring(2, 6);
  const workspaceResult = await supabaseRequest('/rest/v1/workspaces', 'POST', {
    name: workspaceName,
    slug: slug,
    owner_id: userId,
    settings: {
      company_name: workspaceName,
      default_timezone: 'America/Los_Angeles'
    },
    subscription_status: 'trial',
    is_active: true,
    tenant: 'tursio'
  });

  if (workspaceResult.status !== 201) {
    console.log('   ❌ Error creating workspace:', workspaceResult.data || workspaceResult.raw);
    return { userId, password, email };
  }

  const workspaceId = workspaceResult.data?.[0]?.id;
  console.log(`   ✅ Workspace: ${workspaceName} (${workspaceId})`);

  // Add user as workspace member
  const memberResult = await supabaseRequest('/rest/v1/workspace_members', 'POST', {
    workspace_id: workspaceId,
    user_id: userId,
    role: 'owner',
    invited_by: userId,
    status: 'active'
  });

  if (memberResult.status === 201) {
    console.log('   ✅ Added as workspace owner');
  } else {
    console.log('   ⚠️ Member add result:', memberResult.status, memberResult.data?.message || '');
  }

  return { userId, workspaceId, password, email };
}

async function main() {
  console.log('🏢 Creating Tursio Workspaces');
  console.log('=============================');

  const users = [
    { email: 'alekh@tursio.ai', name: 'Alekh' },
    { email: 'rony@tursio.ai', name: 'Rony' }
  ];

  const results = [];
  for (const user of users) {
    const result = await createUserAndWorkspace(user.email, user.name);
    if (result) {
      results.push(result);
    }
  }

  console.log('\n=============================');
  console.log('📋 SUMMARY');
  console.log('=============================\n');

  results.forEach(r => {
    console.log(`Email: ${r.email}`);
    console.log(`Password: ${r.password}`);
    console.log(`User ID: ${r.userId}`);
    if (r.workspaceId) {
      console.log(`Workspace ID: ${r.workspaceId}`);
    }
    console.log('');
  });
}

main().catch(console.error);
