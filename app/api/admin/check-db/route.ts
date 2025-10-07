
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/security/route-auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Define CRITICAL tables that MUST exist for the app to work
const CRITICAL_TABLES = {
  sam_conversation_threads: [
    'id', 'user_id', 'title', 'thread_type', 'status', 
    'last_active_at', 'created_at', 'updated_at'
  ],
  sam_conversation_messages: [
    'id', 'thread_id', 'role', 'content', 'created_at', 'updated_at'
  ]
};

// Optional tables that are good to have
const OPTIONAL_TABLES = {
  organizations: ['id', 'name', 'created_at'],
  users: ['id', 'email', 'created_at'],
  user_organizations: ['user_id', 'organization_id']
};

export async function GET(request: NextRequest) {

  // Require admin authentication
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;
  try {
    const result = {
      healthy: true,
      timestamp: new Date().toISOString(),
      critical_issues: [],
      warnings: [],
      tables: {
        critical: [],
        optional: []
      },
      immediate_actions: [] as string[]
    };

    // Check CRITICAL tables first
    for (const [tableName, requiredColumns] of Object.entries(CRITICAL_TABLES)) {
      try {
        const { error } = await supabaseAdmin
          .from(tableName)
          .select('*')
          .limit(0);

        if (error && error.code === '42P01') {
          // CRITICAL: Table doesn't exist
          result.healthy = false;
          result.critical_issues.push({
            type: 'MISSING_CRITICAL_TABLE',
            table: tableName,
            message: `CRITICAL: Table ${tableName} does not exist. Chat system will be broken.`,
            fix: 'Run SQL from /api/admin/setup-chat-tables'
          });
          result.tables.critical.push({ table: tableName, status: 'MISSING' });
        } else if (error) {
          // Some other error with critical table
          result.healthy = false;
          result.critical_issues.push({
            type: 'CRITICAL_TABLE_ERROR',
            table: tableName,
            message: `CRITICAL: Error accessing ${tableName}: ${error.message}`,
            error_code: error.code
          });
          result.tables.critical.push({ table: tableName, status: 'ERROR', error: error.message });
        } else {
          // Table exists
          result.tables.critical.push({ table: tableName, status: 'OK' });
        }
      } catch (err) {
        result.healthy = false;
        result.critical_issues.push({
          type: 'CRITICAL_TABLE_EXCEPTION',
          table: tableName,
          message: `CRITICAL: Exception checking ${tableName}: ${err}`
        });
      }
    }

    // Check OPTIONAL tables (these don't break the app)
    for (const [tableName] of Object.entries(OPTIONAL_TABLES)) {
      try {
        const { error } = await supabaseAdmin
          .from(tableName)
          .select('*')
          .limit(0);

        if (error && error.code === '42P01') {
          result.warnings.push({
            type: 'MISSING_OPTIONAL_TABLE',
            table: tableName,
            message: `Optional table ${tableName} missing. Some features may not work.`
          });
          result.tables.optional.push({ table: tableName, status: 'MISSING' });
        } else if (error) {
          result.warnings.push({
            type: 'OPTIONAL_TABLE_ERROR',
            table: tableName,
            message: `Warning: ${tableName} error: ${error.message}`
          });
          result.tables.optional.push({ table: tableName, status: 'ERROR', error: error.message });
        } else {
          result.tables.optional.push({ table: tableName, status: 'OK' });
        }
      } catch (err) {
        result.warnings.push({
          type: 'OPTIONAL_TABLE_EXCEPTION',
          table: tableName,
          message: `Warning: Exception checking ${tableName}: ${err}`
        });
      }
    }

    // Check auth system
    try {
      const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
      if (authError) {
        result.critical_issues.push({
          type: 'AUTH_SYSTEM_ERROR',
          message: `CRITICAL: Auth system error: ${authError.message}`,
          fix: 'Check Supabase authentication configuration'
        });
        result.healthy = false;
      }
    } catch (err) {
      result.critical_issues.push({
        type: 'AUTH_SYSTEM_EXCEPTION',
        message: `CRITICAL: Auth system exception: ${err}`
      });
      result.healthy = false;
    }

    // Add action items if unhealthy
    if (!result.healthy) {
      result.immediate_actions = [
        "🚨 URGENT: Application is in BROKEN state",
        "1. Run SQL from /api/admin/setup-chat-tables in Supabase SQL Editor",
        "2. Verify all critical tables are created",
        "3. Test chat functionality immediately",
        "4. Set up monitoring to prevent this in future"
      ];
    }

    return NextResponse.json(result, { 
      status: result.healthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error) {
    console.error('Database health check failed:', error);
    return NextResponse.json({
      healthy: false,
      critical_issues: [{
        type: 'HEALTH_CHECK_FAILURE',
        message: 'Unable to perform database health check',
        error: String(error)
      }],
      immediate_actions: [
        "🚨 CRITICAL: Health check system is failing",
        "Check database connectivity and credentials"
      ]
    }, { status: 500 });
  }
}
