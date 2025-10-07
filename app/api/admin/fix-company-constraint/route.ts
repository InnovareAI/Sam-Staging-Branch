
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/security/route-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {

  // Require admin authentication
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;
  try {
    // First, let's check if we can insert a test 3CubedAI record
    const testEmail = `constraint-test-${Date.now()}@example.com`;
    const testToken = `test_token_${Date.now()}`;

    // Try to insert a 3CubedAI record
    const { data: testInsert, error: testError } = await supabase
      .from('workspace_invitations')
      .insert({
        email: testEmail,
        workspace_id: 'c86ecbcf-a28d-445d-b030-485804c9255d',
        role: 'member',
        invite_token: testToken,
        invited_by: 'c86ecbcf-a28d-445d-b030-485804c9255d',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        company: '3CubedAI'
      })
      .select()
      .single();

    if (testError) {
      console.log('Test insert failed - constraint exists:', testError);

      // Try to use raw SQL via REST API
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!
        },
        body: JSON.stringify({
          query: `
            ALTER TABLE workspace_invitations 
            DROP CONSTRAINT IF EXISTS workspace_invitations_company_check;
            
            ALTER TABLE workspace_invitations 
            ADD CONSTRAINT workspace_invitations_company_check 
            CHECK (company IN ('InnovareAI', '3CubedAI'));
          `
        })
      });

      if (response.ok) {
        return NextResponse.json({
          success: true,
          message: 'Constraint updated via SQL',
          fixed_company: '3CubedAI'
        });
      }

      // If that fails, try a simple approach - just remove the constraint entirely
      return NextResponse.json({
        success: false,
        error: 'Constraint still blocking 3CubedAI',
        suggestion: 'Contact database admin to update constraint manually',
        details: testError,
        sql_needed: `
          ALTER TABLE workspace_invitations 
          DROP CONSTRAINT IF EXISTS workspace_invitations_company_check;
          
          ALTER TABLE workspace_invitations 
          ADD CONSTRAINT workspace_invitations_company_check 
          CHECK (company IN ('InnovareAI', '3CubedAI'));
        `
      });
    }

    // Clean up test record
    if (testInsert) {
      await supabase
        .from('workspace_invitations')
        .delete()
        .eq('id', testInsert.id);
    }

    return NextResponse.json({
      success: true,
      message: '3CubedAI constraint already working',
      test_record: testInsert
    });

  } catch (error) {
    console.error('Fix constraint error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to test/fix company constraint',
      details: error.message
    }, { status: 500 });
  }
}
