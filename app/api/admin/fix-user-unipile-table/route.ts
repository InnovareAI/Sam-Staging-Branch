import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/security/route-auth';
import { pool } from '@/lib/auth';

export async function POST(request: NextRequest) {
  // Require admin authentication
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;

  try {
    console.log('🔧 Starting user_unipile_accounts table schema fix...');

    // First, check what columns exist
    const schemaResult = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'user_unipile_accounts'
      AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);

    console.log('📊 Current table schema:', schemaResult.rows);

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
      `ALTER TABLE user_unipile_accounts ADD CONSTRAINT user_unipile_accounts_unipile_account_id_key UNIQUE (unipile_account_id);`
    ];

    const results = [];

    for (const [index, command] of alterCommands.entries()) {
      try {
        console.log(`🔧 Executing command ${index + 1}/${alterCommands.length}: ${command.substring(0, 80)}...`);

        await pool.query(command);
        console.log(`✅ Command ${index + 1} executed successfully`);
        results.push({
          command: command.substring(0, 100),
          success: true
        });
      } catch (error: any) {
        console.error(`❌ Command ${index + 1} failed:`, error);
        results.push({
          command: command.substring(0, 100),
          success: false,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`📊 Schema fix complete: ${successCount} successful, ${failureCount} failed`);

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
    });

  } catch (error) {
    console.error('💥 Database schema fix error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Database schema fix failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // Require admin authentication
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;

  try {
    // Check current table schema
    const schemaResult = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'user_unipile_accounts'
      AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);

    // Check if table exists by trying to query it
    let tableError = null;
    try {
      await pool.query('SELECT * FROM user_unipile_accounts LIMIT 1');
    } catch (error: any) {
      tableError = error.message;
    }

    return NextResponse.json({
      success: true,
      table_exists: !tableError,
      table_error: tableError,
      schema_available: schemaResult.rows.length > 0,
      current_schema: schemaResult.rows,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Schema check failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
