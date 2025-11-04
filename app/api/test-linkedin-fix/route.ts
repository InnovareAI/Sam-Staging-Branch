import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase';

export async function GET() {
  try {
    // Test the EXACT query that find-prospects uses
    const { data: accounts, error } = await supabaseAdmin()
      .from('workspace_accounts')
      .select('account_name, account_type, connection_status, unipile_account_id')
      .eq('workspace_id', 'babdcab8-1a78-4b2f-913e-6e9fd9821009')
      .eq('user_id', 'f6885ff3-deef-4781-8721-93011c990b1b')
      .eq('account_type', 'linkedin');

    return NextResponse.json({
      fix_deployed: true,
      query_successful: !error,
      accounts_found: accounts?.length || 0,
      accounts: accounts || [],
      error: error?.message || null,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    return NextResponse.json({
      fix_deployed: false,
      error: err.message
    }, { status: 500 });
  }
}
