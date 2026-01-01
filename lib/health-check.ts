import { pool } from '@/lib/db';

// Pool imported from lib/db
// Critical tables that MUST exist
const CRITICAL_TABLES = [
  'sam_conversation_threads',
  'sam_conversation_messages'
];

let lastHealthCheck: { timestamp: number; healthy: boolean } | null = null;
const HEALTH_CHECK_CACHE_MS = 60000; // Cache for 1 minute

export async function ensureDatabaseHealth(): Promise<{ healthy: boolean; issues?: string[] }> {
  try {
    // Use cached result if recent
    const now = Date.now();
    if (lastHealthCheck && (now - lastHealthCheck.timestamp) < HEALTH_CHECK_CACHE_MS) {
      return { healthy: lastHealthCheck.healthy };
    }

    const issues: string[] = [];

    // Check critical tables
    for (const tableName of CRITICAL_TABLES) {
      try {
        const { error } = await pool
          .from(tableName)
          .select('id')
          .limit(0);

        if (error && error.code === '42P01') {
          issues.push(`Missing critical table: ${tableName}`);
        } else if (error) {
          issues.push(`Error accessing ${tableName}: ${error.message}`);
        }
      } catch (err) {
        issues.push(`Exception checking ${tableName}: ${err}`);
      }
    }

    const healthy = issues.length === 0;
    
    // Cache result
    lastHealthCheck = { timestamp: now, healthy };

    return { healthy, issues: issues.length > 0 ? issues : undefined };

  } catch (error) {
    console.error('Health check failed:', error);
    return { 
      healthy: false, 
      issues: [`Health check system failure: ${error}`]
    };
  }
}

export function getHealthCheckErrorResponse() {
  return {
    success: false,
    error: '🚨 CRITICAL: Database schema is broken',
    message: 'Required chat tables are missing. The application cannot function properly.',
    fix_instructions: [
      '1. Visit /api/admin/setup-chat-tables to get the SQL',
      '2. Run the SQL in Supabase SQL Editor',
      '3. Check /api/admin/check-db to verify health',
      '4. Contact admin if issues persist'
    ],
    health_dashboard: '/api/admin/check-db',
    docs: 'https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql'
  };
}