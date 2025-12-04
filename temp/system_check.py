#!/usr/bin/env python3
"""
SAM System Comprehensive Check - December 4, 2025
Queries Supabase for cron status, reply tracking, follow-ups, and prospect pipeline.
"""

import requests
import json
from collections import defaultdict
from datetime import datetime, timedelta

# Supabase config
SUPABASE_URL = "https://latxadqrvrrrcvkktrog.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ"

headers = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json"
}

def query_table(table, select="*", filters="", limit=None):
    """Query Supabase table"""
    url = f"{SUPABASE_URL}/rest/v1/{table}?select={select}"
    if filters:
        url += f"&{filters}"
    if limit:
        url += f"&limit={limit}"

    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        print(f"Error querying {table}: {response.text}")
        return []
    return response.json()

print("=" * 80)
print("SAM SYSTEM COMPREHENSIVE CHECK - December 4, 2025")
print("=" * 80)

# 1. PROSPECT PIPELINE STATUS
print("\n1. PROSPECT PIPELINE STATUS")
print("-" * 80)
prospects = query_table("campaign_prospects", "status")
status_counts = defaultdict(int)
for p in prospects:
    status_counts[p['status']] += 1

total = sum(status_counts.values())
print(f"{'Status':<30} {'Count':>10} {'%':>10}")
print("-" * 80)
for status in sorted(status_counts.keys()):
    count = status_counts[status]
    pct = (count / total * 100) if total > 0 else 0
    print(f"{status:<30} {count:>10} {pct:>9.1f}%")
print("-" * 80)
print(f"{'TOTAL':<30} {total:>10} {100.0:>9.1f}%")

# 2. REPLY TRACKING
print("\n2. REPLY TRACKING")
print("-" * 80)
replied = query_table("campaign_prospects", "campaign_id,status,responded_at", "status=eq.replied")
print(f"Total Prospects with Replies: {len(replied)}")

if replied:
    # Last 7 days
    from datetime import timezone
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    recent_replies = [r for r in replied if r['responded_at'] and datetime.fromisoformat(r['responded_at'].replace('Z', '+00:00')) > seven_days_ago]
    print(f"Replies in Last 7 Days: {len(recent_replies)}")

    # By campaign
    replies_by_campaign = defaultdict(int)
    for r in replied:
        replies_by_campaign[r['campaign_id']] += 1

    print(f"\nReplies by Campaign:")
    for campaign_id, count in sorted(replies_by_campaign.items(), key=lambda x: x[1], reverse=True):
        print(f"  {campaign_id}: {count} replies")

# 3. FOLLOW-UP MESSAGES
print("\n3. FOLLOW-UP MESSAGES")
print("-" * 80)
follow_ups = query_table("campaign_prospects", "status,last_follow_up_at,follow_up_due_at", "last_follow_up_at=not.is.null")
print(f"Total Prospects with Follow-ups Sent: {len(follow_ups)}")

# Pending follow-ups (connected, due date in past, no reply)
connected = query_table("campaign_prospects", "status,follow_up_due_at", "status=eq.connected&follow_up_due_at=not.is.null")
from datetime import timezone
now = datetime.now(timezone.utc)
pending_followups = [c for c in connected if c['follow_up_due_at'] and datetime.fromisoformat(c['follow_up_due_at'].replace('Z', '+00:00')) <= now]
print(f"Pending Follow-ups (due now): {len(pending_followups)}")

# 4. SEND QUEUE STATUS
print("\n4. SEND QUEUE STATUS")
print("-" * 80)
queue = query_table("send_queue", "status,message_type,scheduled_for,sent_at", "order=created_at.desc", limit=1000)

queue_status_counts = defaultdict(int)
queue_type_counts = defaultdict(int)
for q in queue:
    queue_status_counts[q['status']] += 1
    queue_type_counts[q.get('message_type', 'unknown')] += 1

print(f"{'Queue Status':<30} {'Count':>10}")
print("-" * 80)
for status in sorted(queue_status_counts.keys()):
    print(f"{status:<30} {queue_status_counts[status]:>10}")

print(f"\n{'Message Type':<30} {'Count':>10}")
print("-" * 80)
for msg_type in sorted(queue_type_counts.keys()):
    print(f"{msg_type:<30} {queue_type_counts[msg_type]:>10}")

# Pending queue items scheduled for today
pending_queue = [q for q in queue if q['status'] == 'pending']
print(f"\nTotal Pending in Queue: {len(pending_queue)}")

today = datetime.now().date()
today_pending = [q for q in pending_queue if q['scheduled_for'] and datetime.fromisoformat(q['scheduled_for'].replace('Z', '+00:00')).date() == today]
print(f"Pending for Today: {len(today_pending)}")

# 5. CAMPAIGNS STATUS
print("\n5. ACTIVE CAMPAIGNS")
print("-" * 80)
campaigns = query_table("campaigns", "id,campaign_name,status")
campaign_status_counts = defaultdict(int)
for c in campaigns:
    campaign_status_counts[c['status']] += 1

print(f"{'Campaign Status':<30} {'Count':>10}")
print("-" * 80)
for status in sorted(campaign_status_counts.keys()):
    print(f"{status:<30} {campaign_status_counts[status]:>10}")

# Active campaigns with names
active_campaigns = [c for c in campaigns if c['status'] == 'active']
print(f"\nActive Campaigns ({len(active_campaigns)}):")
for c in active_campaigns:
    name = c['campaign_name'] or "(Unnamed)"
    print(f"  {name} ({c['id']})")

print("\n" + "=" * 80)
print("SYSTEM CHECK COMPLETE")
print("=" * 80)
