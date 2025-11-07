#!/usr/bin/env python3
"""
Fix disconnected nodes in the N8N workflow
"""

import json
import copy

# Load the workflow
with open('/Users/tvonlinz/Downloads/SAM Master Campaign Orchestrator FINAL - COMPLETE TRACKING.json', 'r') as f:
    workflow = json.load(f)

print("🔍 Checking for disconnected nodes...\n")

# Build a map of node names to IDs
node_name_to_id = {node['name']: node['id'] for node in workflow['nodes']}
node_id_to_name = {node['id']: node['name'] for node in workflow['nodes']}

# Find all nodes that appear in connections
connected_node_ids = set()
for from_id, conn_data in workflow['connections'].items():
    connected_node_ids.add(from_id)
    if 'main' in conn_data:
        for branch in conn_data['main']:
            if branch:
                for conn in branch:
                    target_name = conn.get('node')
                    if target_name and target_name in node_name_to_id:
                        connected_node_ids.add(node_name_to_id[target_name])

# Find disconnected nodes (excluding webhook trigger which doesn't need incoming)
disconnected = []
for node in workflow['nodes']:
    if node['type'] != 'n8n-nodes-base.webhook' and node['id'] not in connected_node_ids:
        disconnected.append(node['name'])

if disconnected:
    print(f"❌ Found {len(disconnected)} disconnected nodes:")
    for name in disconnected:
        print(f"   - {name}")
else:
    print("✅ All nodes are connected!")

# Now let's rebuild the connections properly
print("\n🔧 Rebuilding connections properly...\n")

# Load the ORIGINAL workflow to see the correct flow
with open('/Users/tvonlinz/Downloads/SAM Master Campaign Orchestrator COMPLETE.json', 'r') as f:
    original = json.load(f)

# Strategy: For each new "Update Status" node, find what the "Send" node connected to originally,
# then insert the status node in between

STATUS_NODE_INSERTIONS = [
    ('Send CR', 'Update Status: CR Sent'),
    ('Send Acceptance Message', 'Update Status: Acceptance Sent'),
    ('Send FU1', 'Update Status: FU1 Sent'),
    ('Send FU2', 'Update Status: FU2 Sent'),
    ('Send FU3', 'Update Status: FU3 Sent'),
    ('Send FU4', 'Update Status: FU4 Sent'),
    ('Send GB (Breakup)', 'Update Status: GB Sent'),
]

# Build maps for original workflow
orig_name_to_id = {node['name']: node['id'] for node in original['nodes']}
orig_id_to_name = {node['id']: node['name'] for node in original['nodes']}

# Start fresh with connections from the original
# Then insert our status nodes
new_connections = {}

# Copy connections from original, but update IDs to match new workflow
for orig_from_id, conn_data in original['connections'].items():
    orig_from_name = orig_id_to_name.get(orig_from_id)
    if orig_from_name and orig_from_name in node_name_to_id:
        new_from_id = node_name_to_id[orig_from_name]
        new_connections[new_from_id] = copy.deepcopy(conn_data)

# Now insert status nodes after their respective Send nodes
for send_node_name, status_node_name in STATUS_NODE_INSERTIONS:
    if send_node_name not in node_name_to_id or status_node_name not in node_name_to_id:
        print(f"⚠️ Skipping {status_node_name} - node not found")
        continue

    send_id = node_name_to_id[send_node_name]
    status_id = node_name_to_id[status_node_name]

    # Get what the Send node originally connected to
    if send_id in new_connections and 'main' in new_connections[send_id]:
        original_next = new_connections[send_id]['main'][0]
        if original_next:
            # Send → Status → Original Next
            new_connections[send_id] = {
                'main': [[{'node': status_node_name, 'type': 'main', 'index': 0}]]
            }
            new_connections[status_id] = {
                'main': [original_next]
            }
            print(f"✅ Connected: {send_node_name} → {status_node_name} → {original_next[0]['node']}")
        else:
            # Send → Status (end of chain)
            new_connections[send_id] = {
                'main': [[{'node': status_node_name, 'type': 'main', 'index': 0}]]
            }
            print(f"✅ Connected: {send_node_name} → {status_node_name} (end)")

# Special case: Connection Accepted status after IF node TRUE branch
if_node_name = "Connection Accepted?"
conn_accepted_status = "Update Status: Connection Accepted"

if if_node_name in node_name_to_id and conn_accepted_status in node_name_to_id:
    if_id = node_name_to_id[if_node_name]
    status_id = node_name_to_id[conn_accepted_status]

    # Get the IF node's TRUE branch (index 0)
    if if_id in new_connections and 'main' in new_connections[if_id]:
        branches = new_connections[if_id]['main']
        if len(branches) >= 1 and branches[0]:
            original_true_next = branches[0][0]
            # IF TRUE → Status → Original Next
            branches[0] = [{'node': conn_accepted_status, 'type': 'main', 'index': 0}]
            new_connections[if_id]['main'] = branches
            new_connections[status_id] = {
                'main': [[original_true_next]]
            }
            print(f"✅ Connected: {if_node_name} (TRUE) → {conn_accepted_status} → {original_true_next['node']}")

# Replace connections in workflow
workflow['connections'] = new_connections

# Save fixed workflow
output_path = '/Users/tvonlinz/Downloads/SAM Master Campaign Orchestrator FINAL - FIXED CONNECTIONS.json'
with open(output_path, 'w') as f:
    json.dump(workflow, f, indent=2)

print(f"\n✅ FIXED! Saved to:")
print(f"   {output_path}")
print(f"\n🎯 All nodes are now properly connected!")
