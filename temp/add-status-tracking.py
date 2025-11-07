#!/usr/bin/env python3
"""
Add status tracking nodes to N8N workflow
"""

import json
import uuid

# Load the workflow
with open('/Users/tvonlinz/Downloads/SAM Master Campaign Orchestrator COMPLETE - FIXED TRACKING.json', 'r') as f:
    workflow = json.load(f)

# Define status updates to add after each node
STATUS_UPDATES = {
    'Send CR': {
        'status': 'connection_requested',
        'insert_after_node': 'Send CR',
        'new_node_name': 'Update Status: CR Sent'
    },
    'Connection Accepted?': {  # This is the IF node, we need to add after the TRUE branch
        'status': 'connection_accepted',
        'insert_after_node': 'Connection Accepted?',
        'new_node_name': 'Update Status: Connection Accepted',
        'on_true_branch': True
    },
    'Send Acceptance Message': {
        'status': 'acceptance_message_sent',
        'insert_after_node': 'Send Acceptance Message',
        'new_node_name': 'Update Status: Acceptance Message Sent'
    },
    'Send FU1': {
        'status': 'fu1_sent',
        'insert_after_node': 'Send FU1',
        'new_node_name': 'Update Status: FU1 Sent'
    },
    'Send FU2': {
        'status': 'fu2_sent',
        'insert_after_node': 'Send FU2',
        'new_node_name': 'Update Status: FU2 Sent'
    },
    'Send FU3': {
        'status': 'fu3_sent',
        'insert_after_node': 'Send FU3',
        'new_node_name': 'Update Status: FU3 Sent'
    },
    'Send FU4': {
        'status': 'fu4_sent',
        'insert_after_node': 'Send FU4',
        'new_node_name': 'Update Status: FU4 Sent'
    },
    'Send GB (Breakup)': {
        'status': 'gb_sent',
        'insert_after_node': 'Send GB (Breakup)',
        'new_node_name': 'Update Status: GB Sent'
    }
}

# Also fix the wrong status values
STATUS_FIXES = {
    'not_connected': 'connection_rejected',
    'completed_no_reply': 'completed'
}

# Function to create a status update node
def create_status_update_node(node_name, status, position):
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
            "jsonBody": f"={{{{ \n  prospect_id: $json.prospect.id,\n  campaign_id: $json.campaign_id,\n  status: '{status}',\n  sent_at: $now.toISO()\n }}}}",
            "options": {}
        },
        "id": str(uuid.uuid4()),
        "name": node_name,
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 3,
        "position": position
    }

# Find nodes by name
def find_node_by_name(nodes, name):
    for i, node in enumerate(nodes):
        if node.get('name') == name:
            return i, node
    return None, None

# Find where a node connects to
def find_connections_to_node(connections, node_name):
    """Find all nodes that connect TO this node"""
    result = []
    for from_node, conn_data in connections.items():
        if 'main' in conn_data:
            for branch_index, branch in enumerate(conn_data['main']):
                if branch:
                    for conn in branch:
                        if conn.get('node') == node_name:
                            result.append({
                                'from_node': from_node,
                                'branch_index': branch_index,
                                'connection': conn
                            })
    return result

print("🔧 Adding status tracking nodes...\n")

# Step 1: Fix wrong status values
nodes_updated = 0
for node in workflow['nodes']:
    if node.get('parameters', {}).get('bodyParameters'):
        for param in node['parameters']['bodyParameters'].get('parameters', []):
            if param.get('name') == 'status':
                old_value = param.get('value')
                if old_value in STATUS_FIXES:
                    param['value'] = STATUS_FIXES[old_value]
                    print(f"✅ Fixed status: {old_value} → {STATUS_FIXES[old_value]} in node '{node['name']}'")
                    nodes_updated += 1

print(f"\n📝 Fixed {nodes_updated} status values\n")

# Step 2: Add new status tracking nodes (simplified approach)
# For now, just output what needs to be added manually
print("📋 Status tracking nodes that need to be added:\n")

for key, config in STATUS_UPDATES.items():
    idx, node = find_node_by_name(workflow['nodes'], config['insert_after_node'])
    if node:
        print(f"✓ Found '{config['insert_after_node']}'")
        print(f"  → Add node: '{config['new_node_name']}'")
        print(f"  → Status: {config['status']}")
        print(f"  → Position: after node at position {node.get('position')}")
        print()
    else:
        print(f"✗ Could not find node: '{config['insert_after_node']}'")
        print()

# Save the workflow with fixed statuses
output_path = '/Users/tvonlinz/Downloads/SAM Master Campaign Orchestrator COMPLETE - WITH TRACKING.json'
with open(output_path, 'w') as f:
    json.dump(workflow, f, indent=2)

print(f"\n✅ Saved updated workflow to: {output_path}")
print("\n⚠️  IMPORTANT: The status values have been fixed, but you still need to:")
print("   1. Import this workflow into N8N")
print("   2. Manually add status update HTTP nodes after each Send node")
print("   3. Use the guide in temp/N8N_FUNNEL_STAGE_TRACKING_GUIDE.md")
print("\nOR: Let me know if you want me to fully automate adding the nodes (more complex)")
