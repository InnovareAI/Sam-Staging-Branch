// Script to fix the user ID in existing association
import { createClient } from '@supabase/supabase-js';

async function fixAssociationUserId() {
  try {
    console.log('🔧 Fixing user ID in existing LinkedIn association...\n');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the correct user ID from public.users
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', 'tl@innovareai.com')
      .single();

    if (userError) {
      console.error('❌ Error finding user:', userError);
      return;
    }

    console.log(`✅ Found correct user: ${user.email} (${user.id})`);

    // Check current association
    const { data: currentAssoc, error: currentError } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('account_email', 'tl@innovareai.com')
      .single();

    if (currentError) {
      console.error('❌ Error finding current association:', currentError);
      return;
    }

    console.log(`📋 Current association user_id: ${currentAssoc.user_id}`);
    console.log(`📋 Correct user_id should be: ${user.id}`);

    if (currentAssoc.user_id === user.id) {
      console.log('✅ Association already has correct user ID!');
      
      // Just update status to active
      const { data: updateResult, error: updateError } = await supabase
        .from('user_unipile_accounts')
        .update({
          connection_status: 'active',
          linkedin_public_identifier: 'tvonlinz',
          linkedin_profile_url: 'https://www.linkedin.com/in/tvonlinz',
          unipile_account_id: 'NLsTJRfCSg-WZAXCBo8w7A' // Use the current active account
        })
        .eq('id', currentAssoc.id)
        .select();

      if (updateError) {
        console.error('❌ Error updating status:', updateError);
      } else {
        console.log('✅ Updated status to active:', updateResult);
      }
      return;
    }

    // Update the user_id to the correct one
    console.log('🔄 Updating user_id in association...');
    
    const { data: updateResult, error: updateError } = await supabase
      .from('user_unipile_accounts')
      .update({
        user_id: user.id,
        connection_status: 'active',
        linkedin_public_identifier: 'tvonlinz',
        linkedin_profile_url: 'https://www.linkedin.com/in/tvonlinz',
        unipile_account_id: 'NLsTJRfCSg-WZAXCBo8w7A' // Use the current active account
      })
      .eq('id', currentAssoc.id)
      .select();

    if (updateError) {
      console.error('❌ Error updating association:', updateError);
      
      // If update fails, try creating a new association and delete the old one
      console.log('🔄 Trying alternative approach - create new association...');
      
      const { data: newAssoc, error: newError } = await supabase
        .from('user_unipile_accounts')
        .insert({
          user_id: user.id,
          unipile_account_id: 'NLsTJRfCSg-WZAXCBo8w7A',
          platform: 'LINKEDIN',
          account_name: 'Thorsten Linz',
          account_email: 'tl@innovareai.com',
          linkedin_public_identifier: 'tvonlinz',
          linkedin_profile_url: 'https://www.linkedin.com/in/tvonlinz',
          connection_status: 'active'
        })
        .select();

      if (newError) {
        console.error('❌ Error creating new association:', newError);
      } else {
        console.log('✅ Created new association:', newAssoc);
        
        // Delete the old association
        const { error: deleteError } = await supabase
          .from('user_unipile_accounts')
          .delete()
          .eq('id', currentAssoc.id);

        if (deleteError) {
          console.error('❌ Error deleting old association:', deleteError);
        } else {
          console.log('✅ Deleted old association');
        }
      }
    } else {
      console.log('✅ Association updated successfully:', updateResult);
    }

    // Verify final state
    console.log('\n📊 Verifying final state...');
    const { data: finalCheck, error: finalError } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'LINKEDIN');

    if (finalError) {
      console.error('❌ Error in final check:', finalError);
    } else {
      console.log('✅ Final LinkedIn associations for user:');
      finalCheck.forEach((assoc, index) => {
        console.log(`  ${index + 1}. ${assoc.account_name} - Status: ${assoc.connection_status}`);
        console.log(`     Account ID: ${assoc.unipile_account_id}`);
        console.log(`     User ID: ${assoc.user_id}`);
      });
    }

    console.log('\n🎉 LinkedIn status should now show as CONNECTED!');
    console.log('🔄 Please refresh the LinkedIn integration page.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixAssociationUserId();