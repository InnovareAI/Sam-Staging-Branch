// Script to fix Thorsten's LinkedIn status
import { createClient } from '@supabase/supabase-js';

async function fixThorstenLinkedInStatus() {
  try {
    console.log('🔧 Fixing Thorsten LinkedIn status...\n');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update Thorsten's LinkedIn association status to active
    const { data: updateResult, error: updateError } = await supabase
      .from('user_unipile_accounts')
      .update({
        connection_status: 'active'
      })
      .eq('unipile_account_id', 'NLsTJRfCSg-WZAXCBo8w7A')
      .eq('user_id', 'f6885ff3-deef-4781-8721-93011c990b1b')
      .select();

    if (updateError) {
      console.error('❌ Error updating status:', updateError);
      return;
    }

    console.log('✅ Status updated successfully:', updateResult);

    // Verify the update
    const { data: verification, error: verifyError } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('unipile_account_id', 'NLsTJRfCSg-WZAXCBo8w7A')
      .eq('user_id', 'f6885ff3-deef-4781-8721-93011c990b1b');

    if (verifyError) {
      console.error('❌ Error verifying update:', verifyError);
      return;
    }

    console.log('\n📊 Current association status:', verification);
    console.log('\n🎉 LinkedIn status should now show as connected!');
    console.log('🔄 Please refresh the page to see the updated status.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixThorstenLinkedInStatus();