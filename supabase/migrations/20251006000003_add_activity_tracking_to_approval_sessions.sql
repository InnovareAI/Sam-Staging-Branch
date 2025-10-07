-- Add activity tracking columns to prospect_approval_sessions
-- This enables intelligent email notifications that only fire when users are inactive

ALTER TABLE prospect_approval_sessions
ADD COLUMN IF NOT EXISTS notification_scheduled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS user_last_active_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS reminder_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ;

-- Create index for efficient cron job queries
CREATE INDEX IF NOT EXISTS idx_approval_sessions_notification_pending
ON prospect_approval_sessions(notification_scheduled_at)
WHERE notification_scheduled_at IS NOT NULL
  AND notification_sent_at IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN prospect_approval_sessions.notification_scheduled_at IS
'Timestamp when email notification should be sent if user is still inactive';

COMMENT ON COLUMN prospect_approval_sessions.notification_sent_at IS
'Timestamp when email notification was actually sent (NULL if not sent yet)';

COMMENT ON COLUMN prospect_approval_sessions.user_last_active_at IS
'Last time user was active in the app (chat, page view, etc.) - used to cancel notifications if user returns';
