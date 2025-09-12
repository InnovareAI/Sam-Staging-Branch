import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Check current constraint
    const { data: constraints, error: constraintError } = await supabase
      .rpc('sql', {
        query: `
          SELECT conname, pg_get_constraintdef(oid) AS definition
          FROM pg_constraint 
          WHERE conname = 'workspace_invitations_company_check'
        `
      });

    if (constraintError) {
      console.log('Constraint check error (might not exist):', constraintError);
    }

    // Drop existing constraint if it exists
    const { error: dropError } = await supabase
      .rpc('sql', {
        query: `
          ALTER TABLE workspace_invitations 
          DROP CONSTRAINT IF EXISTS workspace_invitations_company_check;
        `
      });

    if (dropError) {
      console.error('Drop constraint error:', dropError);
    }

    // Add new constraint that allows both companies
    const { error: addError } = await supabase
      .rpc('sql', {
        query: `
          ALTER TABLE workspace_invitations 
          ADD CONSTRAINT workspace_invitations_company_check 
          CHECK (company IN ('InnovareAI', '3CubedAI'));
        `
      });

    if (addError) {
      console.error('Add constraint error:', addError);
      return NextResponse.json({
        success: false,
        error: 'Failed to add constraint',
        details: addError
      }, { status: 500 });
    }

    // Verify the constraint was added
    const { data: newConstraints } = await supabase
      .rpc('sql', {
        query: `
          SELECT conname, pg_get_constraintdef(oid) AS definition
          FROM pg_constraint 
          WHERE conname = 'workspace_invitations_company_check'
        `
      });

    return NextResponse.json({
      success: true,
      message: 'Successfully updated company constraint',
      old_constraints: constraints,
      new_constraints: newConstraints,
      allowed_companies: ['InnovareAI', '3CubedAI']
    });

  } catch (error) {
    console.error('Fix constraint error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fix company constraint',
      details: error.message
    }, { status: 500 });
  }
}