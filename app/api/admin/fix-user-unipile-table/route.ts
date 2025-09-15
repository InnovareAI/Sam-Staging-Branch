import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies: cookies })
    
    console.log('🔧 Starting user_unipile_accounts table schema fix...')
    
    // First, check what columns exist
    const { data: currentSchema, error: schemaError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'user_unipile_accounts' 
        AND table_schema = 'public'
        ORDER BY ordinal_position;
      `
    })
    
    if (schemaError && !schemaError.message.includes('exec_sql')) {
      console.error('❌ Error checking current schema:', schemaError)
      return NextResponse.json({
        success: false,
        error: `Failed to check current schema: ${schemaError.message}`,
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }
    
    console.log('📊 Current table schema:', currentSchema)
    
    // Add missing columns one by one
    const alterCommands = [
      // Add platform column if missing
      `ALTER TABLE user_unipile_accounts ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'LINKEDIN';`,
      
      // Add account_name column if missing  
      `ALTER TABLE user_unipile_accounts ADD COLUMN IF NOT EXISTS account_name TEXT;`,
      
      // Add account_email column if missing
      `ALTER TABLE user_unipile_accounts ADD COLUMN IF NOT EXISTS account_email TEXT;`,
      
      // Add LinkedIn-specific columns if missing
      `ALTER TABLE user_unipile_accounts ADD COLUMN IF NOT EXISTS linkedin_public_identifier TEXT;`,
      `ALTER TABLE user_unipile_accounts ADD COLUMN IF NOT EXISTS linkedin_profile_url TEXT;`,
      
      // Add connection_status column if missing
      `ALTER TABLE user_unipile_accounts ADD COLUMN IF NOT EXISTS connection_status TEXT NOT NULL DEFAULT 'active';`,
      
      // Add timestamps if missing
      `ALTER TABLE user_unipile_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();`,
      `ALTER TABLE user_unipile_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`,
      
      // Add indexes for performance
      `CREATE INDEX IF NOT EXISTS idx_user_unipile_accounts_user_id ON user_unipile_accounts(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_user_unipile_accounts_unipile_account_id ON user_unipile_accounts(unipile_account_id);`,
      `CREATE INDEX IF NOT EXISTS idx_user_unipile_accounts_platform ON user_unipile_accounts(platform);`,
      
      // Add unique constraint if missing
      `ALTER TABLE user_unipile_accounts DROP CONSTRAINT IF EXISTS user_unipile_accounts_unipile_account_id_key;`,
      `ALTER TABLE user_unipile_accounts ADD CONSTRAINT user_unipile_accounts_unipile_account_id_key UNIQUE (unipile_account_id);`,
      
      // Enable RLS
      `ALTER TABLE user_unipile_accounts ENABLE ROW LEVEL SECURITY;`,
      
      // Create policy
      `DROP POLICY IF EXISTS "Users can manage their own unipile accounts" ON user_unipile_accounts;`,
      `CREATE POLICY "Users can manage their own unipile accounts" ON user_unipile_accounts FOR ALL USING (auth.uid() = user_id);`
    ]
    
    const results = []
    
    for (const [index, command] of alterCommands.entries()) {
      try {
        console.log(`🔧 Executing command ${index + 1}/${alterCommands.length}: ${command.substring(0, 80)}...`)
        
        // Execute directly using raw SQL since exec_sql RPC might not exist
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: command
        })
        
        if (error && !error.message.includes('exec_sql')) {
          console.error(`❌ Command ${index + 1} failed:`, error)
          results.push({
            command: command.substring(0, 100),
            success: false,
            error: error.message
          })
        } else if (error && error.message.includes('exec_sql')) {
          // Try alternative approach without exec_sql
          console.log(`🔄 exec_sql not available, trying direct query for command ${index + 1}`)
          results.push({
            command: command.substring(0, 100),
            success: false,
            error: 'exec_sql function not available - need manual database access'
          })
        } else {
          console.log(`✅ Command ${index + 1} executed successfully`)
          results.push({
            command: command.substring(0, 100),
            success: true,
            data: data
          })
        }
      } catch (error) {
        console.error(`💥 Exception on command ${index + 1}:`, error)
        results.push({
          command: command.substring(0, 100),
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
    
    // Try alternative approach: Direct table creation if exec_sql doesn't work
    if (results.some(r => r.error?.includes('exec_sql'))) {
      console.log('🔄 exec_sql not available, trying direct table recreation...')
      
      try {
        // Try to create the table with correct schema from scratch
        const { data: createResult, error: createError } = await supabase.from('user_unipile_accounts').select('count').limit(1)
        
        if (createError) {
          console.log('📝 Table might not exist with correct schema, will need manual creation')
        }
        
        return NextResponse.json({
          success: false,
          message: 'Database schema fix requires manual intervention',
          error: 'exec_sql function not available in production - need direct database access',
          alternative_solution: 'Use Supabase dashboard to manually add missing columns',
          required_columns: [
            'platform TEXT NOT NULL DEFAULT \'LINKEDIN\'',
            'account_name TEXT',
            'account_email TEXT', 
            'linkedin_public_identifier TEXT',
            'linkedin_profile_url TEXT',
            'connection_status TEXT NOT NULL DEFAULT \'active\'',
            'created_at TIMESTAMPTZ DEFAULT NOW()',
            'updated_at TIMESTAMPTZ DEFAULT NOW()'
          ],
          results: results,
          timestamp: new Date().toISOString()
        }, { status: 200 })
        
      } catch (directError) {
        console.error('❌ Direct approach also failed:', directError)
      }
    }
    
    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length
    
    console.log(`📊 Schema fix complete: ${successCount} successful, ${failureCount} failed`)
    
    return NextResponse.json({
      success: successCount > 0,
      message: `Database schema fix completed: ${successCount} successful, ${failureCount} failed`,
      summary: {
        total_commands: alterCommands.length,
        successful: successCount,
        failed: failureCount
      },
      results: results,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('💥 Database schema fix error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Database schema fix failed',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies: cookies })
    
    // Check current table schema
    const { data: schema, error: schemaError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type, is_nullable, column_default 
        FROM information_schema.columns 
        WHERE table_name = 'user_unipile_accounts' 
        AND table_schema = 'public'
        ORDER BY ordinal_position;
      `
    })
    
    if (schemaError && !schemaError.message.includes('exec_sql')) {
      return NextResponse.json({
        success: false,
        error: `Failed to check schema: ${schemaError.message}`,
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }
    
    // Check if table exists by trying to query it
    const { data: tableCheck, error: tableError } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .limit(1)
    
    return NextResponse.json({
      success: true,
      table_exists: !tableError,
      table_error: tableError?.message,
      schema_available: !schemaError || !schemaError.message.includes('exec_sql'),
      current_schema: schema,
      schema_error: schemaError?.message,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Schema check failed',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}