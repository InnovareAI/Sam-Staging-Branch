const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createAdminAccounts() {
  console.log('🔧 Creating admin service accounts for InnovareAI workspaces...\n');

  const adminAccounts = [];

  for (let i = 1; i <= 6; i++) {
    const email = `admin${i}@innovareai.com`;
    const password = `Admin${i}InnovareAI2025!`; // Temporary password

    console.log(`Creating ${email}...`);

    const { data: user, error } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: `InnovareAI Admin ${i}`,
        role: 'service_account'
      }
    });

    if (error) {
      console.log(`  ❌ Error: ${error.message}`);
    } else {
      console.log(`  ✅ Created: ${user.user.id}`);
      adminAccounts.push({
        number: i,
        email: email,
        userId: user.user.id,
        password: password
      });
    }
  }

  console.log('\n═══════════════════════════════════════════════════\n');
  console.log('📋 ADMIN ACCOUNTS CREATED:\n');

  adminAccounts.forEach(acc => {
    console.log(`admin${acc.number}@innovareai.com`);
    console.log(`  User ID: ${acc.userId}`);
    console.log(`  Password: ${acc.password}`);
    console.log('');
  });

  console.log('⚠️  IMPORTANT: Change these passwords after first login!\n');

  // Generate SQL to add them to workspaces
  console.log('═══════════════════════════════════════════════════\n');
  console.log('📁 SQL to add admin accounts to workspaces:\n');

  const workspaces = [
    { id: 'babdcab8-1a78-4b2f-913e-6e9fd9821009', name: 'IA1' },
    { id: '04666209-fce8-4d71-8eaf-01278edfc73b', name: 'IA2' },
    { id: '96c03b38-a2f4-40de-9e16-43098599e1d4', name: 'IA3' },
    { id: '7f0341da-88db-476b-ae0a-fc0da5b70861', name: 'IA4' },
    { id: 'cd57981a-e63b-401c-bde1-ac71752c2293', name: 'IA5' },
    { id: '2a8f7c3d-9b1e-4f6a-8c2d-5e9a1b4f7d3c', name: 'IA6' }
  ];

  console.log('-- Add admin service accounts to workspaces\n');

  adminAccounts.forEach((acc, index) => {
    const ws = workspaces[index];
    console.log(`-- Add admin${acc.number} to ${ws.name}`);
    console.log(`INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at)`);
    console.log(`VALUES ('${ws.id}', '${acc.userId}', 'admin', 'active', NOW());\n`);
  });

  console.log('\n✅ Copy the SQL above and add it to COMPLETE-WORKSPACE-SPLIT.sql');
}

createAdminAccounts().catch(console.error);
