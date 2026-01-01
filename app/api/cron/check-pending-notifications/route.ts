/**
 * Cron Job: Check for Pending Email Notifications
 *
 * Runs every 15 minutes to check if users have been inactive for 2+ hours
 * Sends approval notifications only if user hasn't returned to the app
 *
 * Trigger: Netlify scheduled function or external cron service
 */

import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db';
import { sendApprovalNotification } from '@/lib/notifications/sam-email'

/**
 * Generate a consistent random number based on session ID (seeded random)
 * Same session ID always produces same random number, ensuring consistency
 */
function hashSessionId(sessionId: string): number {
  let hash = 0
  for (let i = 0; i < sessionId.length; i++) {
    const char = sessionId.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

/**
 * Get session-specific random delay in minutes
 * Same session always gets same delay, different sessions get different delays
 */
function getSessionRandomDelay(sessionId: string, minMinutes: number, maxMinutes: number): number {
  const hash = hashSessionId(sessionId)
  const range = maxMinutes - minMinutes
  const randomOffset = (hash % range)
  return minMinutes + randomOffset
}

/**
 * Get session-specific random hour within a window
 * Same session always gets same hour, different sessions get different hours
 */
function getSessionRandomHour(sessionId: string, minHour: number, maxHour: number): number {
  const hash = hashSessionId(sessionId)
  const range = maxHour - minHour
  const randomOffset = (hash % (range + 1))
  return minHour + randomOffset
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron authorization
    const authHeader = request.headers.get('authorization')
    const expectedToken = process.env.CRON_SECRET_TOKEN

    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    console.log(`🔔 [${now.toISOString()}] Running pending notification check...`)

    // Find sessions with pending notifications that should be sent
    // SCALABILITY: Limit to 100 sessions per run to avoid timeouts
    const BATCH_SIZE = 100

    const { data: pendingSessions, error: fetchError } = await supabase
      .from('prospect_approval_sessions')
      .select(`
        id,
        user_id,
        campaign_name,
        total_prospects,
        notification_scheduled_at,
        user_last_active_at,
        reminder_count,
        last_reminder_sent_at,
        status,
        users (
          email,
          first_name
        )
      `)
      .not('notification_scheduled_at', 'is', null) // Has a scheduled notification
      .eq('status', 'active') // Only active sessions
      .or('notification_sent_at.is.null,last_reminder_sent_at.lt.' + new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString()) // Not sent yet OR last reminder was >6 hours ago
      .order('notification_scheduled_at', { ascending: true }) // Process oldest first
      .limit(BATCH_SIZE) // SCALABILITY: Process in batches

    if (fetchError) {
      throw fetchError
    }

    if (!pendingSessions || pendingSessions.length === 0) {
      console.log('✅ No pending notifications to send')
      return NextResponse.json({
        success: true,
        message: 'No pending notifications',
        processed: 0
      })
    }

    console.log(`📧 Found ${pendingSessions.length} pending notifications`)

    const results = {
      sent: 0,
      cancelled: 0,
      failed: 0,
      errors: [] as any[],
      batchSize: pendingSessions.length
    }

    // SCALABILITY: Process notifications in parallel (up to 10 concurrent)
    const CONCURRENCY_LIMIT = 10
    const emailPromises: Promise<void>[] = []

    for (let i = 0; i < pendingSessions.length; i++) {
      const session = pendingSessions[i]

      // Create promise for this session
      const emailPromise = (async () => {
      try {
        const userLastActive = new Date(session.user_last_active_at)
        const inactiveHours = (now.getTime() - userLastActive.getTime()) / (1000 * 60 * 60)

        // Check if user has been inactive for at least 2 hours
        if (inactiveHours < 2) {
          console.log(`⏭️  Session ${session.id}: User recently active (${inactiveHours.toFixed(1)}h ago), skipping`)
          return
        }

        // Determine if it's time to send a reminder based on schedule
        const currentHour = now.getHours()
        const reminderCount = session.reminder_count || 0
        const lastReminderSent = session.last_reminder_sent_at ? new Date(session.last_reminder_sent_at) : null

        // Reminder schedule logic with randomization to avoid spam filters:
        // Reminder 0 (first): 2-3 hours after inactivity (randomized)
        // Reminder 1: Next day 9-11 AM (randomized within window)
        // Reminder 2: Same day 6-8 PM (randomized within window)
        // Reminder 3+: Every 12 hours (randomized within windows)

        let shouldSendReminder = false
        let reminderType = 'initial'

        if (reminderCount === 0) {
          // First reminder: 2-3 hours after inactivity (randomized)
          // Generate session-specific random delay between 2-3 hours
          const randomDelayMinutes = getSessionRandomDelay(session.id, 120, 180) // 2-3 hours
          const randomDelayHours = randomDelayMinutes / 60

          shouldSendReminder = inactiveHours >= randomDelayHours
          reminderType = 'initial'

          if (shouldSendReminder) {
            console.log(`📧 Session ${session.id}: Sending first reminder after ${inactiveHours.toFixed(1)}h (random delay: ${randomDelayHours.toFixed(1)}h)`)
          }
        } else {
          // Follow-up reminders: morning (9-11 AM) or evening (6-8 PM)
          const hoursSinceLastReminder = lastReminderSent
            ? (now.getTime() - lastReminderSent.getTime()) / (1000 * 60 * 60)
            : 999

          if (hoursSinceLastReminder >= 6) {
            // Generate session-specific random hour within morning/evening windows
            const morningHour = getSessionRandomHour(session.id, 9, 11) // 9-11 AM
            const eveningHour = getSessionRandomHour(session.id, 18, 20) // 6-8 PM

            // Check if we're in the morning window around the user's scheduled time
            if (currentHour >= 9 && currentHour <= 11) {
              // Send if current hour matches or is past the user's scheduled morning hour
              if (currentHour >= morningHour) {
                shouldSendReminder = true
                reminderType = 'morning'
                console.log(`🌅 Session ${session.id}: Sending morning reminder (scheduled for ${morningHour}:00, now ${currentHour}:${now.getMinutes()})`)
              }
            } else if (currentHour >= 18 && currentHour <= 20) {
              // Send if current hour matches or is past the user's scheduled evening hour
              if (currentHour >= eveningHour) {
                shouldSendReminder = true
                reminderType = 'evening'
                console.log(`🌆 Session ${session.id}: Sending evening reminder (scheduled for ${eveningHour}:00, now ${currentHour}:${now.getMinutes()})`)
              }
            }
          }
        }

        if (!shouldSendReminder) {
          console.log(`⏭️  Session ${session.id}: Not time for next reminder (count: ${reminderCount}, hour: ${currentHour})`)
          return
        }

        // User is inactive - send notification
        const user = (session.users as any)

        if (!user || !user.email) {
          console.error(`❌ Session ${session.id}: User email not found`)
          results.failed++
          return
        }

        await sendApprovalNotification({
          userEmail: user.email,
          userName: user.first_name || 'there',
          sessionId: session.id,
          prospectCount: session.total_prospects,
          campaignName: session.campaign_name || 'New Campaign',
          reminderType: reminderType as 'initial' | 'morning' | 'evening'
        })

        // Mark notification as sent and increment reminder count
        await supabase
          .from('prospect_approval_sessions')
          .update({
            notification_sent_at: reminderCount === 0 ? now.toISOString() : session.notification_sent_at, // Only set on first reminder
            last_reminder_sent_at: now.toISOString(),
            reminder_count: reminderCount + 1
          })
          .eq('id', session.id)

        console.log(`✅ ${reminderType} reminder (#${reminderCount + 1}) sent to ${user.email} for session ${session.id}`)
        results.sent++

      } catch (error) {
        console.error(`❌ Error processing session ${session.id}:`, error)
        results.failed++
        results.errors.push({
          session_id: session.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
      })() // End async wrapper

      emailPromises.push(emailPromise)

      // SCALABILITY: Wait for batch to complete before starting next batch
      if (emailPromises.length >= CONCURRENCY_LIMIT || i === pendingSessions.length - 1) {
        await Promise.allSettled(emailPromises)
        emailPromises.length = 0 // Clear array for next batch
      }
    }

    console.log(`📊 Notification check complete:`, results)

    return NextResponse.json({
      success: true,
      message: 'Notification check complete',
      results
    })

  } catch (error) {
    console.error('❌ Cron job error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
