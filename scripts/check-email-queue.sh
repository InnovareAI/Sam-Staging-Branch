#!/bin/bash

# Check Email Queue Status
# Shows current state of email_send_queue table

echo "======================================================================"
echo "EMAIL QUEUE STATUS"
echo "======================================================================"
echo ""

PGPASSWORD='QFe75XZ2kqhy2AyH' psql -h db.latxadqrvrrrcvkktrog.supabase.co -p 5432 -U postgres -d postgres << EOF

-- Summary
SELECT
  status,
  COUNT(*) as count
FROM email_send_queue
GROUP BY status
ORDER BY status;

EOF

echo ""
echo "======================================================================"
echo "PENDING EMAILS (Next 5)"
echo "======================================================================"
echo ""

PGPASSWORD='QFe75XZ2kqhy2AyH' psql -h db.latxadqrvrrrcvkktrog.supabase.co -p 5432 -U postgres -d postgres << EOF

SELECT
  id,
  recipient_email,
  subject,
  scheduled_for,
  status
FROM email_send_queue
WHERE status = 'pending'
ORDER BY scheduled_for
LIMIT 5;

EOF

echo ""
echo "======================================================================"
echo "RECENTLY SENT (Last 5)"
echo "======================================================================"
echo ""

PGPASSWORD='QFe75XZ2kqhy2AyH' psql -h db.latxadqrvrrrcvkktrog.supabase.co -p 5432 -U postgres -d postgres << EOF

SELECT
  sent_at,
  recipient_email,
  subject,
  message_id
FROM email_send_queue
WHERE status = 'sent'
ORDER BY sent_at DESC
LIMIT 5;

EOF

echo ""
echo "======================================================================"
echo "FAILED EMAILS (If any)"
echo "======================================================================"
echo ""

PGPASSWORD='QFe75XZ2kqhy2AyH' psql -h db.latxadqrvrrrcvkktrog.supabase.co -p 5432 -U postgres -d postgres << EOF

SELECT
  recipient_email,
  scheduled_for,
  error_message
FROM email_send_queue
WHERE status = 'failed'
ORDER BY scheduled_for DESC
LIMIT 10;

EOF

echo ""
echo "======================================================================"
