require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const USER_ID = 'f6885ff3-deef-4781-8721-93011c990b1b';
const WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

const UNIPILE_ACCOUNTS = [
  // LinkedIn accounts
  { id: '4nt1J-blSnGUPBjH2Nfjpg', name: '𝗖𝗵𝗮𝗿𝗶𝘀𝘀𝗮 𝗦𝗮𝗻𝗶𝗲𝗹', type: 'linkedin' },
  { id: '727JqVTuQFeoFS4GNnsNxA', name: 'Thorsten Linz', type: 'linkedin' },
  { id: 'FhQYuy9yS2KETw-OYIa0Yw', name: 'Stan Bounev', type: 'linkedin' },
  { id: 'J6pyDIoQSfmGDEIbwXBy3A', name: 'Jim Heim', type: 'linkedin' },
  { id: 'MT39bAEDTJ6e_ZPY337UgQ', name: 'Michelle Angelica  Gestuveo', type: 'linkedin' },
  { id: 'avp6xHsCRZaP5uSPmjc2jg', name: 'Irish Maguad', type: 'linkedin' },

  // Email accounts
  { id: 'eXWYctjDQHOSNMxVxbdcHA', name: 'jf@innovareai.com', type: 'email' },
  { id: 'nefy7jYjS5K6X3U7ORxHNQ', name: 'tl@innovareai.com', type: 'email' }
];

async function reassociateAccounts() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    console.log('🔄 Re-associating Unipile accounts with workspace...');
    console.log(`   User: ${USER_ID}`);
    console.log(`   Workspace: ${WORKSPACE_ID}`);
    console.log('');

    let successCount = 0;
    let errorCount = 0;

    for (const account of UNIPILE_ACCOUNTS) {
      console.log(`Processing: ${account.name} (${account.type})...`);

      const { data, error} = await supabase
        .from('workspace_accounts')
        .insert({
          workspace_id: WORKSPACE_ID,
          user_id: USER_ID,
          account_type: account.type,
          account_identifier: account.name,  // Required NOT NULL field
          account_name: account.name,
          unipile_account_id: account.id,
          connection_status: 'connected',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();

      if (error) {
        console.log(`   ❌ Error: ${error.message}`);
        errorCount++;
      } else {
        console.log(`   ✅ Associated successfully`);
        successCount++;
      }
    }

    console.log('');
    console.log('📊 Results:');
    console.log(`   ✅ Successfully associated: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log('');

    // Verify the associations
    const { data: linkedinAccounts } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', WORKSPACE_ID)
      .eq('account_type', 'linkedin');

    const { data: emailAccounts } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', WORKSPACE_ID)
      .eq('account_type', 'email');

    console.log('✅ Verification:');
    console.log(`   LinkedIn accounts in database: ${linkedinAccounts?.length || 0}`);
    console.log(`   Email accounts in database: ${emailAccounts?.length || 0}`);
    console.log('');

    if (linkedinAccounts && linkedinAccounts.length > 0) {
      console.log('🎉 SUCCESS! #test-linkedin should now work!');
    }

  } catch (error) {
    console.log('❌ Fatal error:', error.message);
  }
}

reassociateAccounts().then(() => process.exit(0));
