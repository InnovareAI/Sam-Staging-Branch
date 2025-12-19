-- Fix 404 Endpoint Errors
-- Reset 2 messenger messages to pending status
-- They will be processed by production code with correct endpoint (/api/v1/chats)

UPDATE send_queue
SET
  status = 'pending',
  error_message = NULL,
  scheduled_for = NOW(),
  updated_at = NOW()
WHERE id IN (
  '5fc20455-b41f-4576-8592-67063329cbd4',  -- digitalnoah
  'ac5ecdce-5c3c-4ab3-8292-4bd0ae76c3b7'   -- zebanderson
)
AND status = 'failed'
AND error_message LIKE '%Cannot POST /api/v1/messages/send%';

-- Verify the update
SELECT
  id,
  linkedin_user_id,
  message_type,
  status,
  error_message,
  scheduled_for
FROM send_queue
WHERE id IN (
  '5fc20455-b41f-4576-8592-67063329cbd4',
  'ac5ecdce-5c3c-4ab3-8292-4bd0ae76c3b7'
);
