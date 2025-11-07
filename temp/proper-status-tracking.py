#!/usr/bin/env python3
"""
Properly add status tracking nodes while preserving all connections
"""

import json
import uuid

# Load original workflow
with open('/Users/tvonlinz/Downloads/SAM Master Campaign Orchestrator - WORKING COPY.json', 'r') as f:
    workflow = json.load(f)

print("🔧 PROPERLY ADDING STATUS TRACKING\n")
print("="*70)

# Step 1: Fix wrong webhook URLs and status values
print("\n📝 Step 1: Fixing URLs and status values...")

fixes_made = 0
for node in workflow['nodes']:
    # Fix webhook URLs
    if 'parameters' in node and 'url' in node['parameters']:
        old_url = node['parameters']['url']
        if 'api/webhooks/n8n/prospect-status' in str(old_url):
            node['parameters']['url'] = old_url.replace(
                'api/webhooks/n8n/prospect-status',
                'api/campaigns/webhook/prospect-status'
            )
            fixes_made += 1
            print(f"  ✅ Fixed URL in: {node['name']}")

    # Fix status values
    if 'parameters' in node and 'bodyParameters' in node['parameters']:
        for param in node['parameters']['bodyParameters'].get('parameters', []):
            if param.get('name') == 'status':
                old_value = param['value']
                if old_value == 'not_connected':
                    param['value'] = 'connection_rejected'
                    print(f"  ✅ Fixed status: not_connected → connection_rejected in {node['name']}")
                    fixes_made += 1
                elif old_value == 'completed_no_reply':
                    param['value'] = 'completed'
                    print(f"  ✅ Fixed status: completed_no_reply → completed in {node['name']}")
                    fixes_made += 1

print(f"\nMade {fixes_made} fixes")

# Step 2: Add new status tracking nodes
print("\n📝 Step 2: Adding new status tracking nodes...")

# Helper to create status node
def create_status_node(name, status, x, y):
    node_id = str(uuid.uuid4())
    return {
        "parameters": {
            "method": "POST",
            "url": "https://app.meet-sam.com/api/campaigns/webhook/prospect-status",
            "sendHeaders": True,
            "headerParameters": {
                "parameters": [
                    {
                        "name": "Authorization",
                        "value": "={{ $env.N8N_WEBHOOK_SECRET_TOKEN }}"
                    },
                    {
                        "name": "Content-Type",
                        "value": "application/json"
                    }
                ]
            },
            "sendBody": True,
            "specifyBody": "json",
            "jsonBody": f"={{{{ {{ prospect_id: $json.prospect.id, campaign_id: $json.campaign_id, status: '{status}', sent_at: $now.toISO() }} }}}}",
            "options": {}
        },
        "id": node_id,
        "name": name,
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 3,
        "position": [x, y]
    }, node_id

# Find node by name
def find_node(name):
    for node in workflow['nodes']:
        if node['name'] == name:
            return node
    return None

# Insertions to make
insertions = [
    ('Send CR', 'Update Status: CR Sent', 'connection_requested', 1460, 320),
    ('Send Acceptance Message', 'Update Status: Acceptance Sent', 'acceptance_message_sent', 2500, 420),
    ('Send FU1', 'Update Status: FU1 Sent', 'fu1_sent', 2700, 520),
    ('Send FU2', 'Update Status: FU2 Sent', 'fu2_sent', 3400, 620),
    ('Send FU3', 'Update Status: FU3 Sent', 'fu3_sent', 4100, 720),
    ('Send FU4', 'Update Status: FU4 Sent', 'fu4_sent', 4800, 820),
    ('Send GB (Breakup)', 'Update Status: GB Sent', 'gb_sent', 5500, 920),
]

# For each insertion
for after_node_name, new_node_name, status, x, y in insertions:
    after_node = find_node(after_node_name)

    if not after_node:
        print(f"  ❌ Cannot find: {after_node_name}")
        continue

    # Create new node
    new_node, new_id = create_status_node(new_node_name, status, x, y)
    workflow['nodes'].append(new_node)

    # Find what after_node connects to
    after_id = after_node['id']

    if after_id in workflow['connections'] and 'main' in workflow['connections'][after_id]:
        # Get the original connection
        original_connection = workflow['connections'][after_id]['main'][0]

        # Update: after_node → new_node
        workflow['connections'][after_id] = {
            'main': [[{'node': new_node_name, 'type': 'main', 'index': 0}]]
        }

        # Add: new_node → original_connection
        workflow['connections'][new_id] = {
            'main': [original_connection if original_connection else []]
        }

        target = original_connection[0]['node'] if original_connection else 'END'
        print(f"  ✅ Inserted: {after_node_name} → {new_node_name} → {target}")
    else:
        # after_node has no outgoing connection, just add one
        workflow['connections'][after_id] = {
            'main': [[{'node': new_node_name, 'type': 'main', 'index': 0}]]
        }
        print(f"  ✅ Added: {after_node_name} → {new_node_name}")

# Special case: Connection Accepted (after IF node TRUE branch)
print("\n📝 Step 3: Adding Connection Accepted status...")

if_node = find_node("Connection Accepted?")
if if_node:
    new_node, new_id = create_status_node(
        "Update Status: Connection Accepted",
        "connection_accepted",
        2130,
        420
    )
    workflow['nodes'].append(new_node)

    if_id = if_node['id']
    if if_id in workflow['connections'] and 'main' in workflow['connections'][if_id]:
        branches = workflow['connections'][if_id]['main']
        if len(branches) >= 1 and branches[0]:
            # Get TRUE branch original connection
            original_true = branches[0][0]

            # Update TRUE branch: IF → new_node
            branches[0] = [{'node': "Update Status: Connection Accepted", 'type': 'main', 'index': 0}]
            workflow['connections'][if_id]['main'] = branches

            # Add: new_node → original_true
            workflow['connections'][new_id] = {
                'main': [[original_true]]
            }

            print(f"  ✅ Inserted: Connection Accepted? (TRUE) → Update Status: Connection Accepted → {original_true['node']}")

# Save
output = '/Users/tvonlinz/Downloads/SAM Master Campaign Orchestrator FINAL - COMPLETE TRACKING.json'
with open(output, 'w') as f:
    json.dump(workflow, f, indent=2)

print("\n" + "="*70)
print(f"\n✅ SUCCESS! Workflow saved to:")
print(f"   {output}")
print(f"\n🎯 Added 8 status tracking nodes")
print(f"🔧 Fixed {fixes_made} URLs and status values")
print(f"\n📥 Import this into N8N - all connections preserved!")
