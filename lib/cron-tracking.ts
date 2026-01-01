/**
 * Cron Job Execution Tracking Utility
 *
 * Provides functions to track scheduled function execution for monitoring and debugging.
 * Usage:
 *   const tracker = await startCronRun('process-send-queue', supabase);
 *   try {
 *     // ... do work ...
 *     await tracker.success({ records_processed: 10, records_success: 8, records_failed: 2 });
 *   } catch (error) {
 *     await tracker.fail(error);
 *   }
 */

import { Pool } from 'pg';

interface CronRunResult {
  records_processed?: number;
  records_success?: number;
  records_failed?: number;
  metadata?: Record<string, any>;
}

interface CronTracker {
  runId: string;
  startTime: number;
  success: (result?: CronRunResult) => Promise<void>;
  fail: (error: Error | string) => Promise<void>;
  timeout: () => Promise<void>;
}

/**
 * Start tracking a cron job run
 */
export async function startCronRun(
  jobName: string,
  supabase: SupabaseClient
): Promise<CronTracker> {
  const startTime = Date.now();

  // Insert initial record
  const { data, error } = await supabase
    .from('cron_job_runs')
    .insert({
      job_name: jobName,
      status: 'running',
      started_at: new Date().toISOString()
    })
    .select('id')
    .single();

  if (error) {
    console.error(`[CRON TRACKING] Failed to start tracking for ${jobName}:`, error.message);
    // Return a no-op tracker if insert failed
    return {
      runId: 'error',
      startTime,
      success: async () => {},
      fail: async () => {},
      timeout: async () => {}
    };
  }

  const runId = data.id;

  return {
    runId,
    startTime,

    success: async (result?: CronRunResult) => {
      const executionTime = Date.now() - startTime;
      await supabase
        .from('cron_job_runs')
        .update({
          status: 'success',
          ended_at: new Date().toISOString(),
          execution_time_ms: executionTime,
          records_processed: result?.records_processed || 0,
          records_success: result?.records_success || result?.records_processed || 0,
          records_failed: result?.records_failed || 0,
          metadata: result?.metadata || {}
        })
        .eq('id', runId);

      console.log(`[CRON TRACKING] ${jobName} completed in ${executionTime}ms`);
    },

    fail: async (error: Error | string) => {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      await supabase
        .from('cron_job_runs')
        .update({
          status: 'failed',
          ended_at: new Date().toISOString(),
          execution_time_ms: executionTime,
          error_message: errorMessage.substring(0, 1000) // Limit error message length
        })
        .eq('id', runId);

      console.error(`[CRON TRACKING] ${jobName} failed after ${executionTime}ms:`, errorMessage);
    },

    timeout: async () => {
      const executionTime = Date.now() - startTime;

      await supabase
        .from('cron_job_runs')
        .update({
          status: 'timeout',
          ended_at: new Date().toISOString(),
          execution_time_ms: executionTime,
          error_message: 'Execution timed out'
        })
        .eq('id', runId);

      console.warn(`[CRON TRACKING] ${jobName} timed out after ${executionTime}ms`);
    }
  };
}

/**
 * Get recent runs for a specific job
 */
export async function getRecentRuns(
  jobName: string,
  supabase: SupabaseClient,
  limit: number = 10
) {
  const { data, error } = await supabase
    .from('cron_job_runs')
    .select('*')
    .eq('job_name', jobName)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error(`[CRON TRACKING] Failed to get runs for ${jobName}:`, error.message);
    return [];
  }

  return data || [];
}

/**
 * Get health status for all jobs
 */
export async function getJobHealth(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('cron_job_health')
    .select('*');

  if (error) {
    console.error('[CRON TRACKING] Failed to get job health:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Check if a job has run recently (within expected interval)
 */
export async function hasRunRecently(
  jobName: string,
  supabase: SupabaseClient,
  expectedIntervalMinutes: number
): Promise<boolean> {
  const cutoff = new Date(Date.now() - expectedIntervalMinutes * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('cron_job_runs')
    .select('id')
    .eq('job_name', jobName)
    .gte('started_at', cutoff)
    .limit(1);

  if (error) {
    console.error(`[CRON TRACKING] Failed to check recent runs for ${jobName}:`, error.message);
    return true; // Assume it ran to avoid false alerts
  }

  return (data?.length || 0) > 0;
}

/**
 * Clean up old run records (keep last 7 days)
 */
export async function cleanupOldRuns(supabase: SupabaseClient, daysToKeep: number = 7) {
  const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString();

  const { error, count } = await supabase
    .from('cron_job_runs')
    .delete()
    .lt('started_at', cutoff);

  if (error) {
    console.error('[CRON TRACKING] Failed to cleanup old runs:', error.message);
    return 0;
  }

  console.log(`[CRON TRACKING] Cleaned up ${count || 0} old run records`);
  return count || 0;
}
