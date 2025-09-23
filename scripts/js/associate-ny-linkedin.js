// Associate NY's LinkedIn account when she connects to Unipile
import { createClient } from '@supabase/supabase-js';

console.log('🔗 Associating NY LinkedIn account...\n');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function associateNYLinkedIn() {
  try {
    // Find NY's user account
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      console.error('❌ Error fetching users:', userError);
      return;
    }
    
    const nyUser = users.users.find(user => user.email === 'ny@3cubed.ai');
    
    if (!nyUser) {
      console.log('❌ NY user not found. Creating user account first...');
      
      // Create NY's user account
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: 'ny@3cubed.ai',
        email_confirm: true,
        user_metadata: {
          name: 'NY',
          company: '3cubed.ai'
        }
      });
      
      if (createError) {
        console.error('❌ Error creating NY user:', createError);
        return;
      }
      
      console.log('✅ Created NY user account:', newUser.user.id);
      
      // Use the new user for association
      await associateWithUnipileAccount(newUser.user.id);
    } else {
      console.log('✅ Found NY user:', nyUser.id);
      await associateWithUnipileAccount(nyUser.id);
    }
    
  } catch (error) {
    console.error('❌ Error in NY LinkedIn association:', error);
  }
}

async function associateWithUnipileAccount(userId) {
  console.log('🔍 Checking for NY LinkedIn account in Unipile...');
  
  // First check current associations
  const { data: existingAssociations, error: assocError } = await supabase
    .from('user_unipile_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('platform', 'LINKEDIN');
    
  if (existingAssociations && existingAssociations.length > 0) {
    console.log('✅ NY already has LinkedIn associations:', existingAssociations.length);
    existingAssociations.forEach(assoc => {
      console.log(`  - Account: ${assoc.account_name} (${assoc.unipile_account_id})`);
    });
    return;
  }
  
  // Check available Unipile accounts
  console.log('📋 Available LinkedIn accounts in Unipile:');
  console.log('1. Irish Cita De Ade (3Zj8ks8aSrKg0ySaLQo_8A)');
  console.log('2. Martin Schechtner (MlV8PYD1SXG783XbJRraLQ)');
  console.log('3. Thorsten Linz (NLsTJRfCSg-WZAXCBo8w7A)');
  console.log('4. Peter Noble (eCvuVstGTfCedKsrzAKvZA)');
  console.log('5. Charissa Saniel (he3RXnROSLuhONxgNle7dw)');
  
  console.log('\n⚠️  NY needs to connect her LinkedIn account to Unipile first.');
  console.log('🔧 Once connected, manually run this script with the account ID.');
  
  // Manual association example (uncomment when NY's account is available)
  /*
  const nyLinkedInAccountId = 'NEW_ACCOUNT_ID_HERE'; // Replace with actual ID when available
  
  const { data, error } = await supabase.rpc('create_user_association', {
    p_user_id: userId,
    p_unipile_account_id: nyLinkedInAccountId,
    p_platform: 'LINKEDIN',
    p_account_name: 'NY LinkedIn',
    p_account_email: 'ny@3cubed.ai',
    p_connection_status: 'connected',
    p_linkedin_profile_url: 'https://linkedin.com/in/ny-profile',
    p_linkedin_public_identifier: 'ny-profile'
  });
  
  if (error) {
    console.error('❌ Association failed:', error);
  } else {
    console.log('✅ NY LinkedIn association created successfully!');
  }
  */
}

associateNYLinkedIn().catch(console.error);