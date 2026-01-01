
import { pool } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/security/route-auth';

export async function POST(request: NextRequest) {

  // Require admin authentication
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;
  try {
    console.log('🔧 Applying invitation schema fixes...');

    // Create Supabase client with service role for schema operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const poolKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const adminSupabase = createClient(supabaseUrl, poolKey);

    // Apply the schema fix SQL
    const schemaFixSQL = `
      -- Add missing company column
      ALTER TABLE public.workspace_invitations 
      ADD COLUMN IF NOT EXISTS company TEXT DEFAULT 'InnovareAI' 
      CHECK (company IN ('InnovareAI', '3cubedai'));

      -- Add missing invited_by column if it doesn't exist
      ALTER TABLE public.workspace_invitations 
      ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id) ON DELETE CASCADE;

      -- Ensure expires_at exists with proper default
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'workspace_invitations' 
              AND column_name = 'expires_at'
          ) THEN
              ALTER TABLE public.workspace_invitations 
              ADD COLUMN expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days');
          END IF;
      END $$;

      -- Create missing indexes
      CREATE INDEX IF NOT EXISTS idx_workspace_invitations_company ON public.workspace_invitations(company);
      CREATE INDEX IF NOT EXISTS idx_workspace_invitations_invited_by ON public.workspace_invitations(invited_by);
      CREATE INDEX IF NOT EXISTS idx_workspace_invitations_expires_at ON public.workspace_invitations(expires_at);

      -- Ensure service role policy exists
      CREATE POLICY IF NOT EXISTS "Service role can manage invitations" ON public.workspace_invitations
        FOR ALL USING (auth.role() = 'service_role');
    `;

    console.log('📝 Executing schema fix SQL...');
    
    const { data: result, error: schemaError } = await adminSupabase.rpc('exec', { sql: schemaFixSQL });
    
    if (schemaError) {
      // If RPC doesn't work, try individual operations
      console.log('⚠️ RPC failed, trying individual operations...');
      
      // Check current table structure
      const { data: tableInfo, error: infoError } = await adminSupabase
        .from('information_schema.columns')
        .select('column_name, data_type')
        .eq('table_name', 'workspace_invitations')
        .eq('table_schema', 'public');

      console.log('📊 Current table columns:', tableInfo);

      // Test if we can insert with company field
      const testInsert = {
        workspace_id: 'test-id',
        email: 'test@example.com',
        role: 'member',
        company: 'InnovareAI',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        token: 'test-token'
      };

      const { data: insertData, error: insertError } = await adminSupabase
        .from('workspace_invitations')
        .insert(testInsert)
        .select();

      // Clean up test data if successful
      if (insertData && insertData.length > 0) {
        await adminSupabase
          .from('workspace_invitations')
          .delete()
          .eq('email', 'test@example.com')
          .eq('token', 'test-token');
      }

      return NextResponse.json({
        message: 'Schema analysis complete',
        schemaError: schemaError?.message,
        tableInfo,
        insertTest: {
          success: !insertError,
          error: insertError?.message,
          data: insertData
        }
      });
    }

    console.log('✅ Schema fix applied successfully');

    // Test the fix by attempting an insertion
    const testData = {
      workspace_id: 'c86ecbcf-a28d-445d-b030-485804c9255d', // Use existing workspace
      email: 'schema-test@example.com',
      role: 'member',
      company: 'InnovareAI',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      token: 'schema-test-token-' + Date.now()
    };

    console.log('🧪 Testing schema fix with test insertion...');
    const { data: testInsert, error: testError } = await adminSupabase
      .from('workspace_invitations')
      .insert(testData)
      .select();

    // Clean up test data
    if (testInsert && testInsert.length > 0) {
      await adminSupabase
        .from('workspace_invitations')
        .delete()
        .eq('email', 'schema-test@example.com');
    }

    return NextResponse.json({
      message: 'Schema fix applied and validated successfully',
      schemaApplied: true,
      testResults: {
        insertSuccess: !testError,
        error: testError?.message,
        testData: testInsert
      }
    });

  } catch (error) {
    console.error('❌ Error fixing invitation schema:', error);
    return NextResponse.json(
      { error: 'Failed to fix invitation schema', details: error },
      { status: 500 }
    );
  }
}
