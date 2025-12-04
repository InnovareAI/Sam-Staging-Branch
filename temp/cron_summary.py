#!/usr/bin/env python3
"""Extract cron jobs from netlify.toml"""

crons = [
    ("scheduled-campaign-execution", "*/2 * * * *", "Every 2 minutes", "ACTIVE"),
    ("process-pending-prospects", "*/5 * * * *", "Every 5 minutes", "ACTIVE"),
    ("process-send-queue", "* * * * *", "Every minute", "ACTIVE"),
    ("process-email-queue", "*/13 * * * *", "Every 13 minutes", "ACTIVE"),
    ("send-follow-ups", "*/30 * * * *", "Every 30 minutes", "ACTIVE"),
    ("poll-accepted-connections", "*/15 * * * *", "Every 15 minutes", "ACTIVE"),
    ("poll-message-replies", "*/15 * * * *", "Every 15 minutes", "ACTIVE"),
    ("qa-monitor", "0 6 * * *", "Daily at 6:00 AM UTC", "ACTIVE"),
    ("daily-health-check", "0 7 * * *", "Daily at 7:00 AM UTC", "ACTIVE"),
    ("data-quality-check", "0 8 * * 1", "Weekly on Monday at 8:00 AM UTC", "ACTIVE"),
    ("rate-limit-monitor", "*/30 * * * *", "Every 30 minutes", "ACTIVE"),
    ("daily-campaign-summary", "0 16 * * *", "Daily at 4:00 PM UTC (8:00 AM PT)", "ACTIVE"),
    ("daily-sync-verification", "0 5 * * *", "Daily at 5:00 AM UTC", "ACTIVE"),
    ("discover-posts", "0 */2 * * *", "Every 2 hours", "ACTIVE"),
    ("auto-generate-comments", "*/30 * * * *", "Every 30 minutes", "ACTIVE"),
    ("process-comment-queue", "*/30 * * * *", "Every 30 minutes", "ACTIVE"),
    ("commenting-digest", "0 16 * * *", "Daily at 4:00 PM UTC (8:00 AM PT)", "ACTIVE"),
    ("sync-crm-bidirectional", "*/15 * * * *", "Every 15 minutes", "ACTIVE"),
    ("realtime-error-monitor", "*/5 * * * *", "Every 5 minutes", "ACTIVE"),
    ("daily-repost", "0 18 * * *", "Daily at 6:00 PM UTC (10:00 AM PT)", "DISABLED (commented out)"),
]

print("=" * 100)
print("NETLIFY SCHEDULED FUNCTIONS (Cron Jobs)")
print("=" * 100)
print(f"{'Function Name':<40} {'Schedule':<20} {'Frequency':<35} {'Status':<15}")
print("=" * 100)

for name, schedule, freq, status in crons:
    print(f"{name:<40} {schedule:<20} {freq:<35} {status:<15}")

print("=" * 100)
print(f"Total Active Crons: {len([c for c in crons if 'ACTIVE' in c[3]])}")
print(f"Total Disabled: {len([c for c in crons if 'DISABLED' in c[3]])}")
print("=" * 100)
