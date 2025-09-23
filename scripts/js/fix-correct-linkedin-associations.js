// Fix over-association issue - only associate Thorsten Linz account with user
import { createClient } from '@supabase/supabase-js';

console.log('🔗 Fixing LinkedIn over-association issue...\n');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixThorstensAssociation() {
  try {
    console.log('🔍 Finding user by email: thorsten.linz@gmail.com');
    
    // Find the specific user
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    if (userError) throw userError;
    
    const targetUser = users.users.find(u => 
      u.email?.toLowerCase() === 'thorsten.linz@gmail.com'
    );
    
    if (!targetUser) {
      console.error('❌ User thorsten.linz@gmail.com not found');
      return;
    }
    
    console.log(`✅ Found user: ${targetUser.email} (${targetUser.id})`);
    
    // Delete ALL existing LinkedIn associations for this user
    console.log('🧹 Removing all existing LinkedIn associations for this user...');
    const { error: deleteError } = await supabase
      .from('user_unipile_accounts')
      .delete()
      .eq('user_id', targetUser.id)
      .eq('platform', 'LINKEDIN');
      
    if (deleteError) {
      console.error('❌ Error clearing user associations:', deleteError);
      return;
    }
    
    console.log('✅ Cleared existing associations for user');

    // Only associate Thorsten Linz's LinkedIn account
    const thorstenLinkedInAccount = {
      id: "NLsTJRfCSg-WZAXCBo8w7A",
      name: "Thorsten Linz",
      publicIdentifier: "tvonlinz"
    };
    
    console.log(`🔗 Associating only ${thorstenLinkedInAccount.name} account...`);
    
    const { data, error } = await supabase
      .from('user_unipile_accounts')
      .insert({
        user_id: targetUser.id,
        unipile_account_id: thorstenLinkedInAccount.id,
        platform: 'LINKEDIN',
        account_name: thorstenLinkedInAccount.name,
        account_email: targetUser.email,
        linkedin_public_identifier: thorstenLinkedInAccount.publicIdentifier,
        linkedin_profile_url: `https://www.linkedin.com/in/${thorstenLinkedInAccount.publicIdentifier}`,
        connection_status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select();
    
    if (error) {
      console.error(`❌ Failed to associate ${thorstenLinkedInAccount.name}:`, error);
      return;
    }
    
    console.log(`✅ Successfully associated ${thorstenLinkedInAccount.name}`);
    
    // Verify the fix
    const { data: finalAssociations } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('user_id', targetUser.id)
      .eq('platform', 'LINKEDIN');
    
    console.log(`\n🎉 Final result: ${finalAssociations?.length || 0} LinkedIn association(s)`);
    finalAssociations?.forEach(assoc => {
      console.log(`  ✅ ${assoc.account_name} (${assoc.unipile_account_id})`);
    });
    
  } catch (error) {
    console.error('❌ Error fixing association:', error);
  }
}

fixThorstensAssociation().catch(console.error);