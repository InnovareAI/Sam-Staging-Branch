require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

// Known Unipile account IDs that need fixing
const ACCOUNTS_TO_FIX = [
  { unipile_id: '4nt1J-blSnGUPBjH2Nfjpg', expected_name: 'Charissa Saniel' },
  { unipile_id: 'FhQYuy9yS2KETw-OYIa0Yw', expected_name: 'Stan Bounev' },
  { unipile_id: 'J6pyDIoQSfmGDEIbwXBy3A', expected_name: 'Jim Heim' },
  { unipile_id: 'MT39bAEDTJ6e_ZPY337UgQ', expected_name: 'Michelle Angelica' },
  { unipile_id: 'aRT-LuSWTa-FmtSIE8p6aA', expected_name: 'Thorsten Linz' },
  { unipile_id: 'avp6xHsCRZaP5uSPmjc2jg', expected_name: 'Irish Maguad' }
];

// Helper function to call Unipile API
async function callUnipileAPI(endpoint) {
  const unipileDsn = process.env.UNIPILE_DSN;
  const unipileApiKey = process.env.UNIPILE_API_KEY;

  if (!unipileDsn || !unipileApiKey) {
    throw new Error('Unipile API credentials not configured');
  }

  const url = `https://${unipileDsn}/api/v1/${endpoint}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-API-KEY': unipileApiKey,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Unipile API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return await response.json();
}

// Helper function to match account name to user email
function matchAccountToEmail(accountName) {
  const name = accountName.toLowerCase();

  // Remove unicode formatting characters (like those in Charissa Saniel's name)
  const cleanName = name.replace(/[\u{1D400}-\u{1D7FF}]/gu, (char) => {
    // Convert mathematical alphanumeric symbols to regular letters
    const code = char.codePointAt(0);
    if (code >= 0x1D400 && code <= 0x1D419) return String.fromCharCode(code - 0x1D400 + 0x41); // Bold capitals
    if (code >= 0x1D41A && code <= 0x1D433) return String.fromCharCode(code - 0x1D41A + 0x61); // Bold lowercase
    if (code >= 0x1D5A0 && code <= 0x1D5B9) return String.fromCharCode(code - 0x1D5A0 + 0x41); // Sans-serif bold capitals
    if (code >= 0x1D5BA && code <= 0x1D5D3) return String.fromCharCode(code - 0x1D5BA + 0x61); // Sans-serif bold lowercase
    return char;
  });

  // Matching patterns for each team member
  const patterns = [
    { pattern: /charissa|saniel/i, email: 'cs@innovareai.com', name: 'Charissa Saniel' },
    { pattern: /stan|bounev/i, email: 'sb@innovareai.com', name: 'Stan Bounev' },
    { pattern: /jim|heim/i, email: 'jh@innovareai.com', name: 'Jim Heim' },
    { pattern: /michelle|angelica|gestuveo/i, email: 'ma@innovareai.com', name: 'Michelle Angelica' },
    { pattern: /thorsten|linz/i, email: 'tl@innovareai.com', name: 'Thorsten Linz' },
    { pattern: /irish|maguad/i, email: 'im@innovareai.com', name: 'Irish Maguad' }
  ];

  for (const { pattern, email, name } of patterns) {
    if (pattern.test(cleanName)) {
      return { email, name };
    }
  }

  return null;
}

async function fixAccountAssignments() {
  try {
    console.log('🔧 Starting workspace account assignment fix...');
    console.log(`   Workspace ID: ${WORKSPACE_ID}`);
    console.log('');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Step 1: Get all LinkedIn accounts from Unipile
    console.log('📡 Fetching accounts from Unipile...');
    const unipileData = await callUnipileAPI('accounts');
    const allAccounts = Array.isArray(unipileData) ? unipileData : (unipileData.items || unipileData.accounts || []);
    const linkedInAccounts = allAccounts.filter(acc => acc.type === 'LINKEDIN');

    console.log(`   Found ${linkedInAccounts.length} LinkedIn accounts in Unipile`);
    console.log('');

    // Step 2: Get all workspace_accounts records for this workspace
    console.log('📊 Fetching workspace_accounts records...');
    const { data: workspaceAccounts, error: fetchError } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', WORKSPACE_ID)
      .eq('account_type', 'linkedin');

    if (fetchError) {
      console.error('❌ Error fetching workspace accounts:', fetchError);
      return;
    }

    console.log(`   Found ${workspaceAccounts.length} workspace_accounts records`);
    console.log('');

    // Step 3: Get all users in the workspace
    console.log('👥 Fetching workspace members...');
    const { data: members, error: membersError } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', WORKSPACE_ID);

    if (membersError) {
      console.error('❌ Error fetching workspace members:', membersError);
      return;
    }

    console.log(`   Found ${members.length} workspace members`);

    // Step 4: Fetch user details from auth.users
    const userIds = members.map(m => m.user_id);
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email')
      .in('id', userIds);

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }

    console.log(`   Fetched ${users.length} user details`);
    console.log('');

    // Create user lookup map by email
    const usersByEmail = new Map();
    users.forEach(user => {
      if (user.email) {
        const email = user.email.toLowerCase();
        usersByEmail.set(email, user.id);
      }
    });

    console.log('📋 User email to ID mapping:');
    for (const [email, userId] of usersByEmail.entries()) {
      console.log(`   ${email} → ${userId}`);
    }
    console.log('');

    // Step 5: Match accounts and prepare updates
    console.log('🔍 Analyzing account assignments...');
    console.log('');

    const updates = [];
    const errors = [];

    for (const account of ACCOUNTS_TO_FIX) {
      // Find the Unipile account details
      const unipileAccount = linkedInAccounts.find(acc => acc.id === account.unipile_id);

      if (!unipileAccount) {
        errors.push({
          unipile_id: account.unipile_id,
          error: 'Account not found in Unipile'
        });
        continue;
      }

      const accountName = unipileAccount.name || account.expected_name;

      // Find the workspace_accounts record
      const workspaceAccount = workspaceAccounts.find(acc => acc.unipile_account_id === account.unipile_id);

      if (!workspaceAccount) {
        errors.push({
          unipile_id: account.unipile_id,
          account_name: accountName,
          error: 'No workspace_accounts record found'
        });
        continue;
      }

      // Match account name to correct user email
      const match = matchAccountToEmail(accountName);

      if (!match) {
        errors.push({
          unipile_id: account.unipile_id,
          account_name: accountName,
          error: 'Could not match account name to user email'
        });
        continue;
      }

      const correctUserId = usersByEmail.get(match.email);

      if (!correctUserId) {
        errors.push({
          unipile_id: account.unipile_id,
          account_name: accountName,
          matched_email: match.email,
          error: 'Matched email not found in workspace members'
        });
        continue;
      }

      const currentUserEmail = workspaceAccount.users?.email || 'unknown';
      const needsUpdate = workspaceAccount.user_id !== correctUserId;

      updates.push({
        id: workspaceAccount.id,
        unipile_id: account.unipile_id,
        account_name: accountName,
        current_user_id: workspaceAccount.user_id,
        current_user_email: currentUserEmail,
        correct_user_id: correctUserId,
        correct_user_email: match.email,
        needs_update: needsUpdate
      });
    }

    // Step 5: Display proposed changes
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('                    PROPOSED CHANGES');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');

    if (updates.length === 0) {
      console.log('❌ No valid updates to perform');
    } else {
      const updatesNeeded = updates.filter(u => u.needs_update);
      const alreadyCorrect = updates.filter(u => !u.needs_update);

      if (updatesNeeded.length > 0) {
        console.log('🔄 ACCOUNTS NEEDING UPDATES:');
        console.log('');
        updatesNeeded.forEach((update, idx) => {
          console.log(`${idx + 1}. ${update.account_name}`);
          console.log(`   Unipile ID: ${update.unipile_id}`);
          console.log(`   CURRENT:  ${update.current_user_email} (${update.current_user_id})`);
          console.log(`   CORRECT:  ${update.correct_user_email} (${update.correct_user_id})`);
          console.log('');
        });
      }

      if (alreadyCorrect.length > 0) {
        console.log('✅ ACCOUNTS ALREADY CORRECT:');
        console.log('');
        alreadyCorrect.forEach((update, idx) => {
          console.log(`${idx + 1}. ${update.account_name} → ${update.correct_user_email}`);
        });
        console.log('');
      }
    }

    if (errors.length > 0) {
      console.log('⚠️  ACCOUNTS WITH ERRORS:');
      console.log('');
      errors.forEach((error, idx) => {
        console.log(`${idx + 1}. ${error.account_name || error.unipile_id}`);
        console.log(`   Error: ${error.error}`);
        if (error.matched_email) {
          console.log(`   Matched Email: ${error.matched_email}`);
        }
        console.log('');
      });
    }

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');

    // Step 6: Prompt for confirmation
    const updatesNeeded = updates.filter(u => u.needs_update);

    if (updatesNeeded.length === 0) {
      console.log('✅ All accounts are already correctly assigned!');
      console.log('');
      return;
    }

    console.log(`⚠️  This will update ${updatesNeeded.length} workspace_accounts records.`);
    console.log('');
    console.log('To proceed with updates, run this script with --confirm flag:');
    console.log(`   node scripts/fix-workspace-account-assignments.cjs --confirm`);
    console.log('');

    // Step 7: Perform updates if confirmed
    const shouldConfirm = process.argv.includes('--confirm');

    if (!shouldConfirm) {
      console.log('ℹ️  Dry run complete. No changes made.');
      return;
    }

    console.log('🚀 Performing updates...');
    console.log('');

    let successCount = 0;
    let failureCount = 0;

    for (const update of updatesNeeded) {
      console.log(`Updating ${update.account_name}...`);

      const { error: updateError } = await supabase
        .from('workspace_accounts')
        .update({ user_id: update.correct_user_id })
        .eq('id', update.id);

      if (updateError) {
        console.log(`   ❌ Failed: ${updateError.message}`);
        failureCount++;
      } else {
        console.log(`   ✅ Updated: ${update.current_user_email} → ${update.correct_user_email}`);
        successCount++;
      }
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('                    UPDATE SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');
    console.log(`✅ Successful updates: ${successCount}`);
    console.log(`❌ Failed updates: ${failureCount}`);
    console.log(`✓  Already correct: ${alreadyCorrect.length}`);
    console.log(`⚠️  Errors: ${errors.length}`);
    console.log('');

    if (successCount > 0) {
      console.log('🎉 Workspace account assignments have been fixed!');
    }

  } catch (error) {
    console.error('💥 Fatal error:', error);
    console.error(error.stack);
  }
}

// Run the fix
fixAccountAssignments().then(() => {
  console.log('');
  console.log('Script complete.');
  process.exit(0);
}).catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
