import { createClient } from '@/app/lib/supabase/server';

/**
 * Check if a comment should be auto-approved based on monitor settings
 *
 * This function checks:
 * 1. If auto-approval is enabled for the monitor
 * 2. If the current time (in monitor's timezone) falls within the approval window
 *
 * @param monitorId - UUID of the linkedin_post_monitors record
 * @returns boolean - true if comment should be auto-approved, false otherwise
 */
export async function shouldAutoApproveComment(monitorId: string): Promise<boolean> {
  try {
    const supabase = await createClient();

    // Get monitor settings
    const { data: monitor, error } = await supabase
      .from('linkedin_post_monitors')
      .select('auto_approve_enabled, auto_approve_start_time, auto_approve_end_time, timezone')
      .eq('id', monitorId)
      .single();

    if (error || !monitor) {
      console.error('Failed to fetch monitor for auto-approval check:', error);
      return false; // Default to manual approval if we can't fetch settings
    }

    // If auto-approval is not enabled, return false
    if (!monitor.auto_approve_enabled) {
      return false;
    }

    // Get current time in monitor's timezone
    const now = new Date();
    const timezone = monitor.timezone || 'America/New_York';

    // Convert to monitor's timezone
    const localTime = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(now);

    // Extract HH:mm from the formatted string
    const currentTime = localTime;

    // Get approval window times (already in HH:mm:ss format from DB)
    const startTime = monitor.auto_approve_start_time?.substring(0, 5); // Get HH:mm
    const endTime = monitor.auto_approve_end_time?.substring(0, 5); // Get HH:mm

    if (!startTime || !endTime) {
      console.error('Auto-approval window times not configured');
      return false;
    }

    // Check if current time is within the approval window
    const isWithinWindow = isTimeInRange(currentTime, startTime, endTime);

    console.log(`Auto-approval check for monitor ${monitorId}:`, {
      timezone,
      currentTime,
      window: `${startTime} - ${endTime}`,
      isWithinWindow
    });

    return isWithinWindow;
  } catch (error) {
    console.error('Error in shouldAutoApproveComment:', error);
    return false; // Default to manual approval on error
  }
}

/**
 * Check if a time falls within a range (handles overnight ranges)
 *
 * @param time - Current time in HH:mm format
 * @param start - Start time in HH:mm format
 * @param end - End time in HH:mm format
 * @returns boolean
 */
function isTimeInRange(time: string, start: string, end: string): boolean {
  const timeMinutes = timeToMinutes(time);
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);

  if (startMinutes <= endMinutes) {
    // Normal range (e.g., 09:00 - 17:00)
    return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
  } else {
    // Overnight range (e.g., 22:00 - 06:00)
    return timeMinutes >= startMinutes || timeMinutes <= endMinutes;
  }
}

/**
 * Convert HH:mm time string to minutes since midnight
 *
 * @param time - Time string in HH:mm format
 * @returns number - Minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Auto-approve a comment in the queue
 *
 * @param queueId - UUID of the linkedin_comment_queue record
 * @param userId - UUID of the user (for approved_by field)
 * @returns boolean - true if approval succeeded, false otherwise
 */
export async function autoApproveQueuedComment(queueId: string, userId?: string): Promise<boolean> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('linkedin_comment_queue')
      .update({
        approval_status: 'approved',
        status: 'approved',
        approved_by: userId || null,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', queueId);

    if (error) {
      console.error('Failed to auto-approve comment:', error);
      return false;
    }

    console.log(`✅ Auto-approved comment ${queueId}`);
    return true;
  } catch (error) {
    console.error('Error in autoApproveQueuedComment:', error);
    return false;
  }
}
