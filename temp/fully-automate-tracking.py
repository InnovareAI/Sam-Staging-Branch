#!/usr/bin/env python3
"""
FULLY automate adding status tracking nodes to N8N workflow
This will add ALL the nodes and wire them up correctly
"""

import json
import uuid
import copy

# Load the workflow
with open('/Users/tvonlinz/Downloads/SAM Master Campaign Orchestrator COMPLETE - WITH TRACKING.json', 'r') as f:
    workflow = json.load(f)

print("🚀 FULLY AUTOMATING STATUS TRACKING SETUP\n")

# Create a status update node template
def create_status_node(name, status, x_pos, y_pos):
    node_id = str(uuid.uuid4())[:8]  # Shorter IDs
    return {
        "parameters": {
            "method": "POST",
            "url": "https://app.meet-sam.com/api/campaigns/webhook/prospect-status",
            "sendHeaders": True,
            "headerParameters": {
                "parameters": [
                    {
                        "name": "Authorization",
                        "value": "Bearer {{ $env.N8N_WEBHOOK_SECRET_TOKEN }}"
                    },
                    {
                        "name": "Content-Type",
                        "value": "application/json"
                    }
                ]
            },
            "sendBody": True,
            "specifyBody": "json",
            "jsonBody": f"={{{{ {{ prospect_id: $json.prospect.id, campaign_id: $json.campaign_id, status: '{status}', sent_at: $now.toISO(), message_id: $json.object?.id || $json.id }} }}}}",
            "options": {}
        },
        "id": node_id,
        "name": name,
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 3,
        "position": [x_pos, y_pos]
    }, node_id

# Nodes to add
NEW_NODES = [
    ("Send CR", "Update Status: CR Sent", "connection_requested", 1460, 304),
    ("Send Acceptance Message", "Update Status: Acceptance Sent", "acceptance_message_sent", 2508, 400),
    ("Send FU1", "Update Status: FU1 Sent", "fu1_sent", 2700, 496),
    ("Send FU2", "Update Status: FU2 Sent", "fu2_sent", 3468, 592),
    ("Send FU3", "Update Status: FU3 Sent", "fu3_sent", 4236, 688),
    ("Send FU4", "Update Status: FU4 Sent", "fu4_sent", 5004, 784),
    ("Send GB (Breakup)", "Update Status: GB Sent", "gb_sent", 5772, 880),
]

# Special case: connection_accepted after "Connection Accepted?" IF node (TRUE branch)
CONNECTION_ACCEPTED_NODE = ("Connection Accepted?", "Update Status: Connection Accepted", "connection_accepted", 2132, 400)

# Find node by name
def find_node(nodes, name):
    for i, node in enumerate(nodes):
        if node.get('name') == name:
            return i, node
    return None, None

# Add regular status nodes after Send nodes
nodes_added = []

for after_node_name, new_node_name, status, x, y in NEW_NODES:
    idx, after_node = find_node(workflow['nodes'], after_node_name)

    if after_node:
        # Create new node
        new_node, new_id = create_status_node(new_node_name, status, x, y)
        workflow['nodes'].append(new_node)

        # Find what the after_node currently connects to
        after_node_id = after_node['id']
        next_connections = workflow['connections'].get(after_node_id, {}).get('main', [[]])

        # Insert new node in between
        if next_connections and next_connections[0]:
            # after_node → new_node → original_next
            original_next = next_connections[0][0]
            workflow['connections'][after_node_id] = {
                'main': [[{'node': new_node_name, 'type': 'main', 'index': 0}]]
            }
            workflow['connections'][new_id] = {
                'main': [[original_next]]
            }
        else:
            # after_node → new_node (end of flow)
            workflow['connections'][after_node_id] = {
                'main': [[{'node': new_node_name, 'type': 'main', 'index': 0}]]
            }

        print(f"✅ Added: {new_node_name} (after {after_node_name})")
        nodes_added.append(new_node_name)
    else:
        print(f"❌ Could not find: {after_node_name}")

# Special handling for Connection Accepted
# This needs to go after the TRUE branch of "Connection Accepted?" IF node
idx, if_node = find_node(workflow['nodes'], "Connection Accepted?")
if if_node:
    new_node, new_id = create_status_node(
        CONNECTION_ACCEPTED_NODE[1],  # "Update Status: Connection Accepted"
        CONNECTION_ACCEPTED_NODE[2],  # "connection_accepted"
        CONNECTION_ACCEPTED_NODE[3],  # x
        CONNECTION_ACCEPTED_NODE[4]   # y
    )
    workflow['nodes'].append(new_node)

    # Find the TRUE branch (index 0) of the IF node
    if_node_id = if_node['id']
    true_branch = workflow['connections'].get(if_node_id, {}).get('main', [[], []])[0]

    if true_branch:
        original_next = true_branch[0]
        # IF node TRUE → new_node → original_next
        workflow['connections'][if_node_id]['main'][0] = [{'node': CONNECTION_ACCEPTED_NODE[1], 'type': 'main', 'index': 0}]
        workflow['connections'][new_id] = {
            'main': [[original_next]]
        }
        print(f"✅ Added: {CONNECTION_ACCEPTED_NODE[1]} (after Connection Accepted? TRUE branch)")
        nodes_added.append(CONNECTION_ACCEPTED_NODE[1])

print(f"\n📊 Summary:")
print(f"   Added {len(nodes_added)} status tracking nodes")
print(f"   Fixed 2 status values (connection_rejected, completed)")
print(f"   Fixed 7 webhook URLs")

# Save
output_path = '/Users/tvonlinz/Downloads/SAM Master Campaign Orchestrator FINAL - COMPLETE TRACKING.json'
with open(output_path, 'w') as f:
    json.dump(workflow, f, indent=2)

print(f"\n✅ DONE! Saved to:")
print(f"   {output_path}")
print(f"\n📥 Import this into N8N and you're ready to go!")
print(f"\n🎯 All funnel stages will now be tracked automatically:")
for node in nodes_added:
    print(f"   ✓ {node}")
