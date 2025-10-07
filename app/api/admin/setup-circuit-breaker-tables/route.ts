import { requireAdmin } from '@/lib/security/route-auth';

/**
 * Circuit Breaker Database Schema Setup
 * Creates necessary tables and functions for circuit breaker monitoring and metrics
 * 
 * TABLES CREATED:
 * - circuit_breaker_metrics: Store circuit breaker performance metrics
 * - circuit_breaker_events: Store circuit breaker state change events
 * 
 * FUNCTIONS CREATED:
 * - get_circuit_breaker_health: Health metrics aggregation
 * - cleanup_circuit_breaker_metrics: Automatic cleanup of old metrics
 */


export async function POST(request: NextRequest) {

  // Require admin authentication
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;
  try {
    const supabase = supabaseAdmin()
    
    logger.info('Setting up circuit breaker database schema')

    // Create circuit breaker metrics table
    const { error: metricsTableError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Circuit breaker metrics table
        CREATE TABLE IF NOT EXISTS circuit_breaker_metrics (
          id BIGSERIAL PRIMARY KEY,
          circuit_name TEXT NOT NULL,
          outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure', 'timeout')),
          response_time INTEGER NOT NULL,
          state TEXT NOT NULL CHECK (state IN ('CLOSED', 'OPEN', 'HALF_OPEN')),
          failure_count INTEGER NOT NULL DEFAULT 0,
          success_count INTEGER NOT NULL DEFAULT 0,
          operation_name TEXT,
          error_type TEXT,
          workspace_id TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Indexes for efficient querying
        CREATE INDEX IF NOT EXISTS idx_circuit_breaker_metrics_circuit_name 
        ON circuit_breaker_metrics(circuit_name);
        
        CREATE INDEX IF NOT EXISTS idx_circuit_breaker_metrics_created_at 
        ON circuit_breaker_metrics(created_at);
        
        CREATE INDEX IF NOT EXISTS idx_circuit_breaker_metrics_circuit_outcome 
        ON circuit_breaker_metrics(circuit_name, outcome);
        
        CREATE INDEX IF NOT EXISTS idx_circuit_breaker_metrics_workspace 
        ON circuit_breaker_metrics(workspace_id, circuit_name);

        -- Composite index for time-based queries
        CREATE INDEX IF NOT EXISTS idx_circuit_breaker_metrics_time_range 
        ON circuit_breaker_metrics(circuit_name, created_at DESC, outcome);
      `
    })

    if (metricsTableError) {
      logger.error('Failed to create circuit breaker metrics table', metricsTableError)
      throw metricsTableError
    }

    // Create circuit breaker events table
    const { error: eventsTableError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Circuit breaker state change events table
        CREATE TABLE IF NOT EXISTS circuit_breaker_events (
          id BIGSERIAL PRIMARY KEY,
          circuit_name TEXT NOT NULL,
          previous_state TEXT CHECK (previous_state IN ('CLOSED', 'OPEN', 'HALF_OPEN')),
          new_state TEXT NOT NULL CHECK (new_state IN ('CLOSED', 'OPEN', 'HALF_OPEN')),
          trigger_reason TEXT NOT NULL,
          failure_count INTEGER DEFAULT 0,
          success_count INTEGER DEFAULT 0,
          context JSONB,
          workspace_id TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Indexes for events table
        CREATE INDEX IF NOT EXISTS idx_circuit_breaker_events_circuit_name 
        ON circuit_breaker_events(circuit_name);
        
        CREATE INDEX IF NOT EXISTS idx_circuit_breaker_events_created_at 
        ON circuit_breaker_events(created_at);
        
        CREATE INDEX IF NOT EXISTS idx_circuit_breaker_events_state_changes 
        ON circuit_breaker_events(circuit_name, new_state, created_at DESC);
      `
    })

    if (eventsTableError) {
      logger.error('Failed to create circuit breaker events table', eventsTableError)
      throw eventsTableError
    }

    // Create health check function
    const { error: healthFunctionError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Function to get circuit breaker health metrics
        CREATE OR REPLACE FUNCTION get_circuit_breaker_health(
          p_circuit_name TEXT,
          p_time_window_hours INTEGER DEFAULT 1
        )
        RETURNS JSON AS $$
        DECLARE
          result JSON;
          total_requests INTEGER;
          successful_requests INTEGER;
          failed_requests INTEGER;
          timeout_requests INTEGER;
          avg_response_time DECIMAL;
          p95_response_time DECIMAL;
          current_state TEXT;
          last_state_change TIMESTAMP WITH TIME ZONE;
        BEGIN
          -- Get basic metrics
          SELECT 
            COUNT(*),
            COUNT(*) FILTER (WHERE outcome = 'success'),
            COUNT(*) FILTER (WHERE outcome = 'failure'),
            COUNT(*) FILTER (WHERE outcome = 'timeout'),
            ROUND(AVG(response_time), 2),
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time)
          INTO 
            total_requests,
            successful_requests,
            failed_requests,
            timeout_requests,
            avg_response_time,
            p95_response_time
          FROM circuit_breaker_metrics
          WHERE circuit_name = p_circuit_name
            AND created_at >= NOW() - INTERVAL '1 hour' * p_time_window_hours;

          -- Get current state from latest event
          SELECT new_state, created_at
          INTO current_state, last_state_change
          FROM circuit_breaker_events
          WHERE circuit_name = p_circuit_name
          ORDER BY created_at DESC
          LIMIT 1;

          -- Build result JSON
          SELECT json_build_object(
            'circuit_name', p_circuit_name,
            'time_window_hours', p_time_window_hours,
            'total_requests', COALESCE(total_requests, 0),
            'successful_requests', COALESCE(successful_requests, 0),
            'failed_requests', COALESCE(failed_requests, 0),
            'timeout_requests', COALESCE(timeout_requests, 0),
            'success_rate', CASE 
              WHEN total_requests > 0 THEN ROUND((successful_requests::DECIMAL / total_requests) * 100, 2)
              ELSE NULL 
            END,
            'failure_rate', CASE 
              WHEN total_requests > 0 THEN ROUND((failed_requests::DECIMAL / total_requests) * 100, 2)
              ELSE NULL 
            END,
            'avg_response_time', avg_response_time,
            'p95_response_time', p95_response_time,
            'current_state', current_state,
            'last_state_change', last_state_change,
            'health_score', CASE
              WHEN total_requests = 0 THEN 100
              WHEN successful_requests::DECIMAL / total_requests >= 0.95 THEN 100
              WHEN successful_requests::DECIMAL / total_requests >= 0.90 THEN 85
              WHEN successful_requests::DECIMAL / total_requests >= 0.80 THEN 70
              WHEN successful_requests::DECIMAL / total_requests >= 0.60 THEN 50
              ELSE 25
            END,
            'last_updated', NOW()
          ) INTO result;
          
          RETURN result;
        END;
        $$ LANGUAGE plpgsql;
      `
    })

    if (healthFunctionError) {
      logger.error('Failed to create health check function', healthFunctionError)
      throw healthFunctionError
    }

    // Create cleanup function
    const { error: cleanupFunctionError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Function to cleanup old circuit breaker metrics
        CREATE OR REPLACE FUNCTION cleanup_circuit_breaker_metrics(
          p_retention_days INTEGER DEFAULT 30
        )
        RETURNS JSON AS $$
        DECLARE
          deleted_metrics INTEGER;
          deleted_events INTEGER;
        BEGIN
          -- Delete old metrics
          DELETE FROM circuit_breaker_metrics 
          WHERE created_at < NOW() - INTERVAL '1 day' * p_retention_days;
          
          GET DIAGNOSTICS deleted_metrics = ROW_COUNT;
          
          -- Delete old events
          DELETE FROM circuit_breaker_events 
          WHERE created_at < NOW() - INTERVAL '1 day' * p_retention_days;
          
          GET DIAGNOSTICS deleted_events = ROW_COUNT;
          
          RETURN json_build_object(
            'deleted_metrics', deleted_metrics,
            'deleted_events', deleted_events,
            'retention_days', p_retention_days,
            'cleanup_time', NOW()
          );
        END;
        $$ LANGUAGE plpgsql;
      `
    })

    if (cleanupFunctionError) {
      logger.error('Failed to create cleanup function', cleanupFunctionError)
      throw cleanupFunctionError
    }

    // Create aggregation function for dashboard metrics
    const { error: aggregationFunctionError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Function to get circuit breaker dashboard metrics
        CREATE OR REPLACE FUNCTION get_circuit_breaker_dashboard_metrics(
          p_workspace_id TEXT DEFAULT NULL,
          p_time_window_hours INTEGER DEFAULT 24
        )
        RETURNS JSON AS $$
        DECLARE
          result JSON;
        BEGIN
          WITH circuit_stats AS (
            SELECT 
              circuit_name,
              COUNT(*) as total_requests,
              COUNT(*) FILTER (WHERE outcome = 'success') as successful_requests,
              COUNT(*) FILTER (WHERE outcome = 'failure') as failed_requests,
              AVG(response_time) as avg_response_time,
              MAX(created_at) as last_activity
            FROM circuit_breaker_metrics
            WHERE created_at >= NOW() - INTERVAL '1 hour' * p_time_window_hours
              AND (p_workspace_id IS NULL OR workspace_id = p_workspace_id)
            GROUP BY circuit_name
          ),
          overall_stats AS (
            SELECT 
              COUNT(DISTINCT circuit_name) as total_circuits,
              SUM(total_requests) as total_requests,
              SUM(successful_requests) as total_successful,
              SUM(failed_requests) as total_failed,
              AVG(avg_response_time) as overall_avg_response_time
            FROM circuit_stats
          ),
          recent_events AS (
            SELECT 
              COUNT(*) as state_changes,
              COUNT(*) FILTER (WHERE new_state = 'OPEN') as circuits_opened,
              COUNT(*) FILTER (WHERE new_state = 'CLOSED') as circuits_closed
            FROM circuit_breaker_events
            WHERE created_at >= NOW() - INTERVAL '1 hour' * p_time_window_hours
              AND (p_workspace_id IS NULL OR workspace_id = p_workspace_id)
          )
          SELECT json_build_object(
            'time_window_hours', p_time_window_hours,
            'workspace_id', p_workspace_id,
            'overview', json_build_object(
              'total_circuits', COALESCE((SELECT total_circuits FROM overall_stats), 0),
              'total_requests', COALESCE((SELECT total_requests FROM overall_stats), 0),
              'overall_success_rate', CASE 
                WHEN (SELECT total_requests FROM overall_stats) > 0 
                THEN ROUND(((SELECT total_successful FROM overall_stats)::DECIMAL / (SELECT total_requests FROM overall_stats)) * 100, 2)
                ELSE NULL 
              END,
              'avg_response_time', ROUND(COALESCE((SELECT overall_avg_response_time FROM overall_stats), 0), 2),
              'circuits_opened', COALESCE((SELECT circuits_opened FROM recent_events), 0),
              'circuits_closed', COALESCE((SELECT circuits_closed FROM recent_events), 0)
            ),
            'circuit_details', (
              SELECT json_agg(
                json_build_object(
                  'circuit_name', circuit_name,
                  'total_requests', total_requests,
                  'success_rate', ROUND((successful_requests::DECIMAL / total_requests) * 100, 2),
                  'avg_response_time', ROUND(avg_response_time, 2),
                  'last_activity', last_activity
                )
              )
              FROM circuit_stats
              ORDER BY total_requests DESC
            ),
            'generated_at', NOW()
          ) INTO result;
          
          RETURN result;
        END;
        $$ LANGUAGE plpgsql;
      `
    })

    if (aggregationFunctionError) {
      logger.error('Failed to create aggregation function', aggregationFunctionError)
      throw aggregationFunctionError
    }

    // Create trigger for automatic event logging
    const { error: triggerError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Function to log circuit breaker state changes
        CREATE OR REPLACE FUNCTION log_circuit_breaker_state_change()
        RETURNS TRIGGER AS $$
        BEGIN
          -- This would be called from application code when state changes occur
          -- For now, just ensure the function exists for future use
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `
    })

    if (triggerError) {
      logger.error('Failed to create trigger function', triggerError)
      throw triggerError
    }

    logger.info('Circuit breaker database schema setup completed successfully')

    return NextResponse.json({
      success: true,
      message: 'Circuit breaker database schema created successfully',
      tables_created: [
        'circuit_breaker_metrics',
        'circuit_breaker_events'
      ],
      functions_created: [
        'get_circuit_breaker_health',
        'cleanup_circuit_breaker_metrics',
        'get_circuit_breaker_dashboard_metrics',
        'log_circuit_breaker_state_change'
      ],
      indexes_created: [
        'idx_circuit_breaker_metrics_circuit_name',
        'idx_circuit_breaker_metrics_created_at',
        'idx_circuit_breaker_metrics_circuit_outcome',
        'idx_circuit_breaker_metrics_workspace',
        'idx_circuit_breaker_metrics_time_range',
        'idx_circuit_breaker_events_circuit_name',
        'idx_circuit_breaker_events_created_at',
        'idx_circuit_breaker_events_state_changes'
      ]
    })

  } catch (error) {
    logger.error('Circuit breaker schema setup failed', error as Error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'SCHEMA_SETUP_ERROR'
    }, { status: 500 })
  }
}
