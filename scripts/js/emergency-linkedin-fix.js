// Emergency fix for LinkedIn associations - connects all existing LinkedIn accounts to users
// This addresses the systematic "LinkedIn Not Connected" issue

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Primary LinkedIn accounts from Unipile (deduplicating multiple instances)
const linkedinAccounts = [
  {
    id: "he3RXnROSLuhONxgNle7dw",
    name: "𝒞𝒽𝒶𝓇𝒾𝓈𝓈𝒶 𝒮𝒶𝓃𝒾𝒆𝓁", 
    username: "𝒞𝒽𝒶𝓇𝒾𝓈𝓈𝒶 𝒮𝒶𝓃𝒾𝒆𝓁",
    likely_user_email: "cs@innovareai.com" // Charissa Saniel - using specified account
  },
  {
    id: "NLsTJRfCSg-WZAXCBo8w7A", 
    name: "Thorsten Linz",
    username: "Thorsten Linz",
    likely_user_email: "tl@innovareai.com" // Thorsten - primary account
  },
  {
    id: "MlV8PYD1SXG783XbJRraLQ",
    name: "Martin Schechtner", 
    username: "Martin Schechtner",
    likely_user_email: null // External user
  },
  {
    id: "eCvuVstGTfCedKsrzAKvZA",
    name: "Peter Noble",
    username: "Peter Noble", 
    likely_user_email: null // External user
  }
  // Note: Skipping duplicate Charissa accounts (8GYAZQnWQfW0nu4Fg3H5RA, _oFwcPliQgqjtt5q3OR2kw, etc.)
  // Only associating one primary account per person to avoid conflicts
];

async function emergencyLinkedInFix() {
  console.log('🚨 Running emergency LinkedIn association fix...\n');

  try {
    // Get all auth users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
      console.error('Error fetching auth users:', authError);
      return;
    }

    console.log(`📊 Found ${authUsers.users.length} authenticated users\n`);

    // Create a mapping of email to user ID
    const emailToUserId = {};
    authUsers.users.forEach(user => {
      if (user.email) {
        emailToUserId[user.email] = user.id;
      }
    });

    console.log('🔗 Creating LinkedIn associations:\n');

    for (const linkedinAccount of linkedinAccounts) {
      if (linkedinAccount.likely_user_email && emailToUserId[linkedinAccount.likely_user_email]) {
        const userId = emailToUserId[linkedinAccount.likely_user_email];
        
        console.log(`  → Associating ${linkedinAccount.name} with ${linkedinAccount.likely_user_email}`);

        // Create the association using the RPC function with all required parameters
        const { data, error } = await supabase.rpc('create_user_association', {
          p_user_id: userId,
          p_unipile_account_id: linkedinAccount.id,
          p_platform: 'LINKEDIN',
          p_account_name: linkedinAccount.name,
          p_account_email: linkedinAccount.username,
          p_connection_status: 'connected',
          p_linkedin_profile_url: `https://linkedin.com/in/${linkedinAccount.username?.toLowerCase().replace(/\s+/g, '-')}`,
          p_linkedin_public_identifier: linkedinAccount.username?.toLowerCase().replace(/\s+/g, '-')
        });

        if (error) {
          console.error(`    ❌ Error associating ${linkedinAccount.name}:`, error);
        } else {
          console.log(`    ✅ Successfully associated ${linkedinAccount.name}`);
        }
      } else {
        console.log(`  → Skipping ${linkedinAccount.name} (no matching user email)`);
      }
    }

    // Verify the associations were created
    console.log('\n🔍 Verifying associations...');
    const { data: newAssociations, error: verifyError } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('platform', 'linkedin');

    if (verifyError) {
      console.error('Error verifying associations:', verifyError);
    } else {
      console.log(`✅ Total LinkedIn associations now: ${newAssociations?.length || 0}`);
      
      if (newAssociations && newAssociations.length > 0) {
        console.log('\n📋 Current associations:');
        for (const assoc of newAssociations) {
          const user = authUsers.users.find(u => u.id === assoc.user_id);
          console.log(`  • ${user?.email || 'Unknown'}: ${assoc.account_name}`);
        }
      }
    }

    console.log('\n🎉 Emergency fix completed!');
    console.log('Users should now see "LinkedIn Connected" in the interface.');

  } catch (error) {
    console.error('🚨 Error during emergency fix:', error);
  }
}

emergencyLinkedInFix();