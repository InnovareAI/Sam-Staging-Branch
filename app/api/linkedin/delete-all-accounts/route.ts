import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }
    
    // Delete all LinkedIn accounts from user_unipile_accounts
    const { error: deleteError, count } = await supabase
      .from('user_unipile_accounts')
      .delete()
      .eq('platform', 'LINKEDIN')
      .select();
    
    if (deleteError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to delete accounts',
        details: deleteError.message
      }, { status: 500 });
    }
    
    // Also delete from workspace_accounts
    await supabase
      .from('workspace_accounts')
      .delete()
      .eq('account_type', 'linkedin');
    
    return NextResponse.json({
      success: true,
      message: 'All LinkedIn accounts deleted from database',
      deleted_count: count
    });
    
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
