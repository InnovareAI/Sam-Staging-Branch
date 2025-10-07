
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/security/route-auth';

export async function POST(request: NextRequest) {

  // Require admin authentication
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;
  try {
    console.log('🔧 Manual schema fix for workspace_invitations...');

    // Create Supabase client with service role for schema operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

    // First, check the current structure
    console.log('📊 Checking current table structure...');
    
    // Get current columns
    const { data: columns, error: columnsError } = await adminSupabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_schema', 'public')
      .eq('table_name', 'workspace_invitations')
      .order('ordinal_position');

    console.log('Current columns:', columns);

    // Since we can't modify the schema directly via Supabase client,
    // let's modify the invitation API to work without the company column
    
    // Check if we can work around this by not using company column
    const testInsertWithoutCompany = {
      workspace_id: 'c86ecbcf-a28d-445d-b030-485804c9255d',
      email: 'test-workaround@example.com',
      role: 'member',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      token: 'test-token-' + Date.now()
    };

    console.log('🧪 Testing insert without company field...');
    const { data: testResult, error: testError } = await adminSupabase
      .from('workspace_invitations')
      .insert(testInsertWithoutCompany)
      .select();

    // Clean up
    if (testResult && testResult.length > 0) {
      await adminSupabase
        .from('workspace_invitations')
        .delete()
        .eq('email', 'test-workaround@example.com');
    }

    // Test the workspace_members table functionality
    console.log('👥 Testing workspace_members table...');
    const { data: memberTest, error: memberError } = await adminSupabase
      .from('workspace_members')
      .select('id, workspace_id, user_id, role')
      .limit(1);

    return NextResponse.json({
      message: 'Manual schema analysis complete',
      currentColumns: columns,
      columnsError: columnsError?.message,
      insertWithoutCompany: {
        success: !testError,
        error: testError?.message,
        data: testResult
      },
      memberTableTest: {
        success: !memberError,
        error: memberError?.message,
        sampleData: memberTest
      },
      recommendations: {
        sqlToRun: `
-- Run this SQL in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql

ALTER TABLE public.workspace_invitations 
ADD COLUMN IF NOT EXISTS company TEXT DEFAULT 'InnovareAI' 
CHECK (company IN ('InnovareAI', '3cubedai'));

ALTER TABLE public.workspace_invitations 
ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_workspace_invitations_company ON public.workspace_invitations(company);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_invited_by ON public.workspace_invitations(invited_by);
        `,
        alternativeApproach: 'Modify the invitation API to not use company column temporarily'
      }
    });

  } catch (error) {
    console.error('❌ Error in manual schema fix:', error);
    return NextResponse.json(
      { error: 'Manual schema fix failed', details: error },
      { status: 500 }
    );
  }
}
