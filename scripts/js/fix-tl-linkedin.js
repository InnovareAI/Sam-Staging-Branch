// Script to fix tl@innovareai.com LinkedIn status
import { createClient } from '@supabase/supabase-js';

async function fixTLLinkedIn() {
  try {
    console.log('🔧 Fixing tl@innovareai.com LinkedIn status...\n');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find tl@innovareai.com user
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', 'tl@innovareai.com');

    if (userError) {
      console.error('❌ Error finding user:', userError);
      return;
    }

    if (!users || users.length === 0) {
      console.error('❌ tl@innovareai.com user not found');
      return;
    }

    const user = users[0];
    console.log(`✅ Found user: ${user.email} (${user.id})\n`);

    // Check existing associations
    const { data: existingAssociations, error: checkError } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('user_id', user.id);

    if (checkError) {
      console.error('❌ Error checking associations:', checkError);
      return;
    }

    console.log(`📊 Existing associations: ${existingAssociations?.length || 0}`);
    if (existingAssociations && existingAssociations.length > 0) {
      existingAssociations.forEach((assoc, index) => {
        console.log(`  ${index + 1}. ${assoc.account_name} (${assoc.platform}) - Status: ${assoc.connection_status}`);
        console.log(`     Account ID: ${assoc.unipile_account_id}`);
      });
    }

    // Update or create association for Thorsten's LinkedIn account
    const thorstenLinkedInId = 'NLsTJRfCSg-WZAXCBo8w7A';
    
    const { data: association, error: upsertError } = await supabase
      .from('user_unipile_accounts')
      .upsert({
        user_id: user.id,
        unipile_account_id: thorstenLinkedInId,
        platform: 'LINKEDIN',
        account_name: 'Thorsten Linz',
        account_email: user.email,
        linkedin_public_identifier: 'tvonlinz',
        linkedin_profile_url: 'https://www.linkedin.com/in/tvonlinz',
        connection_status: 'active'
      }, {
        onConflict: 'unipile_account_id'
      })
      .select();

    if (upsertError) {
      console.error('❌ Error upserting association:', upsertError);
      return;
    }

    console.log('\n✅ Association updated successfully:', association);

    // Verify the final state
    const { data: finalCheck, error: finalError } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'LINKEDIN');

    if (finalError) {
      console.error('❌ Error in final check:', finalError);
      return;
    }

    console.log('\n📊 Final LinkedIn associations:');
    if (finalCheck && finalCheck.length > 0) {
      finalCheck.forEach((assoc, index) => {
        console.log(`  ${index + 1}. ${assoc.account_name} - Status: ${assoc.connection_status}`);
        console.log(`     Account ID: ${assoc.unipile_account_id}`);
      });
    }

    console.log('\n🎉 LinkedIn status should now show as CONNECTED!');
    console.log('🔄 Please refresh the page to see the updated status.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixTLLinkedIn();