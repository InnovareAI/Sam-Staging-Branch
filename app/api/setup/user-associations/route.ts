import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    // Authenticate user first
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required',
        timestamp: new Date().toISOString()
      }, { status: 401 })
    }

    console.log(`🔧 User ${user.email} requesting user association table setup`)

    // Create the user_unipile_accounts table
    const createTableSQL = `
      -- User Unipile Accounts Association Table
      CREATE TABLE IF NOT EXISTS user_unipile_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        unipile_account_id TEXT NOT NULL,
        platform TEXT NOT NULL CHECK (platform IN ('LINKEDIN', 'EMAIL', 'WHATSAPP')),
        account_name TEXT,
        account_email TEXT,
        linkedin_public_identifier TEXT,
        linkedin_profile_url TEXT,
        connection_status TEXT DEFAULT 'active' CHECK (connection_status IN ('active', 'disconnected', 'error')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        
        -- Ensure one user can't claim the same Unipile account multiple times
        UNIQUE(unipile_account_id),
        -- Ensure one user can't have duplicate LinkedIn identifiers
        UNIQUE(user_id, linkedin_public_identifier) WHERE linkedin_public_identifier IS NOT NULL
      );
    `

    const enableRLSSQL = `
      -- Enable RLS
      ALTER TABLE user_unipile_accounts ENABLE ROW LEVEL SECURITY;
    `

    const createPolicySQL = `
      -- RLS Policy: Users can only see their own account associations
      DROP POLICY IF EXISTS "Users can view own account associations" ON user_unipile_accounts;
      CREATE POLICY "Users can view own account associations"
        ON user_unipile_accounts
        FOR ALL
        USING (auth.uid() = user_id);
    `

    const createIndexesSQL = `
      -- Index for fast lookups
      CREATE INDEX IF NOT EXISTS idx_user_unipile_accounts_user_id ON user_unipile_accounts(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_unipile_accounts_unipile_id ON user_unipile_accounts(unipile_account_id);
      CREATE INDEX IF NOT EXISTS idx_user_unipile_accounts_platform ON user_unipile_accounts(platform);
    `

    const createFunctionSQL = `
      -- Function to update updated_at timestamp
      CREATE OR REPLACE FUNCTION update_user_unipile_accounts_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `

    const createTriggerSQL = `
      -- Trigger to automatically update updated_at
      DROP TRIGGER IF EXISTS trigger_update_user_unipile_accounts_updated_at ON user_unipile_accounts;
      CREATE TRIGGER trigger_update_user_unipile_accounts_updated_at
        BEFORE UPDATE ON user_unipile_accounts
        FOR EACH ROW
        EXECUTE FUNCTION update_user_unipile_accounts_updated_at();
    `

    // Execute each SQL statement
    const statements = [
      { name: 'Create Table', sql: createTableSQL },
      { name: 'Enable RLS', sql: enableRLSSQL },
      { name: 'Create Policy', sql: createPolicySQL },
      { name: 'Create Indexes', sql: createIndexesSQL },
      { name: 'Create Function', sql: createFunctionSQL },
      { name: 'Create Trigger', sql: createTriggerSQL }
    ]

    const results = []
    
    for (const statement of statements) {
      try {
        console.log(`🔄 Executing: ${statement.name}`)
        const { data, error } = await supabase.rpc('exec_sql', { sql: statement.sql })
        
        if (error) {
          console.error(`❌ Error in ${statement.name}:`, error)
          results.push({ name: statement.name, success: false, error: error.message })
        } else {
          console.log(`✅ Success: ${statement.name}`)
          results.push({ name: statement.name, success: true })
        }
      } catch (err) {
        console.error(`💥 Exception in ${statement.name}:`, err)
        results.push({ name: statement.name, success: false, error: err instanceof Error ? err.message : 'Unknown error' })
      }
    }

    // Check if table exists now
    const { data: tableCheck, error: tableCheckError } = await supabase
      .from('user_unipile_accounts')
      .select('count', { count: 'exact', head: true })

    const tableExists = !tableCheckError

    return NextResponse.json({
      success: tableExists,
      message: tableExists ? 'User association table setup completed successfully' : 'Table setup completed but verification failed',
      table_exists: tableExists,
      setup_results: results,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error setting up user association table:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user first
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required',
        timestamp: new Date().toISOString()
      }, { status: 401 })
    }

    // Check if table exists
    const { data, error } = await supabase
      .from('user_unipile_accounts')
      .select('count', { count: 'exact', head: true })

    const tableExists = !error
    const recordCount = data || 0

    return NextResponse.json({
      success: true,
      table_exists: tableExists,
      record_count: recordCount,
      error_details: error ? {
        message: error.message,
        code: error.code
      } : null,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error checking user association table:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}