#!/usr/bin/env python3
"""
Thoroughly verify ALL connections in the workflow
"""

import json

# Load the fixed workflow
with open('/Users/tvonlinz/Downloads/SAM Master Campaign Orchestrator FINAL - FIXED CONNECTIONS.json', 'r') as f:
    workflow = json.load(f)

print("🔍 COMPREHENSIVE CONNECTION VERIFICATION\n")
print("=" * 70)

# Build maps
node_name_to_id = {node['name']: node['id'] for node in workflow['nodes']}
node_id_to_name = {node['id']: node['name'] for node in workflow['nodes']}

# Check each node
print("\n📊 Checking all nodes:\n")

# Nodes that don't need incoming connections
entry_nodes = ['Campaign Execute Webhook']

# Track which nodes have incoming and outgoing connections
has_incoming = set()
has_outgoing = set()

# Build incoming connection map
for from_id, conn_data in workflow['connections'].items():
    has_outgoing.add(from_id)
    if 'main' in conn_data:
        for branch in conn_data['main']:
            if branch:
                for conn in branch:
                    target_name = conn.get('node')
                    if target_name and target_name in node_name_to_id:
                        has_incoming.add(node_name_to_id[target_name])

# Check each node
issues = []
for node in workflow['nodes']:
    node_id = node['id']
    node_name = node['name']
    node_type = node['type']

    incoming = node_id in has_incoming or node_name in entry_nodes
    outgoing = node_id in has_outgoing

    status = "✅" if (incoming and outgoing) else "⚠️"

    # Some nodes are terminators (no outgoing)
    terminator_patterns = ['Exit', 'Complete', 'Replied']
    is_terminator = any(pattern in node_name for pattern in terminator_patterns)

    if is_terminator and not outgoing:
        status = "✅ (terminator)"
    elif node_name in entry_nodes and outgoing:
        status = "✅ (entry)"
    elif not incoming and node_name not in entry_nodes:
        status = "❌ NO INCOMING"
        issues.append(f"{node_name}: No incoming connections")
    elif not outgoing and not is_terminator:
        status = "❌ NO OUTGOING"
        issues.append(f"{node_name}: No outgoing connections")

    print(f"{status} {node_name}")

# Show the flow of status update nodes specifically
print("\n" + "=" * 70)
print("\n🎯 STATUS UPDATE NODE FLOW:\n")

status_nodes = [
    'Send CR',
    'Update Status: CR Sent',
    'Send Acceptance Message',
    'Update Status: Acceptance Sent',
    'Send FU1',
    'Update Status: FU1 Sent',
    'Send FU2',
    'Update Status: FU2 Sent',
    'Send FU3',
    'Update Status: FU3 Sent',
    'Send FU4',
    'Update Status: FU4 Sent',
    'Send GB (Breakup)',
    'Update Status: GB Sent'
]

for node_name in status_nodes:
    if node_name in node_name_to_id:
        node_id = node_name_to_id[node_name]
        if node_id in workflow['connections'] and 'main' in workflow['connections'][node_id]:
            next_nodes = workflow['connections'][node_id]['main'][0]
            if next_nodes:
                next_name = next_nodes[0]['node']
                print(f"  {node_name} → {next_name}")
            else:
                print(f"  {node_name} → [NOWHERE]")
        else:
            print(f"  {node_name} → [NOT CONNECTED]")

# Check Connection Accepted special case
print("\n🔍 Connection Accepted IF node:")
if_node_name = "Connection Accepted?"
if if_node_name in node_name_to_id:
    if_id = node_name_to_id[if_node_name]
    if if_id in workflow['connections'] and 'main' in workflow['connections'][if_id]:
        branches = workflow['connections'][if_id]['main']
        if len(branches) >= 2:
            true_branch = branches[0] if branches[0] else []
            false_branch = branches[1] if len(branches) > 1 and branches[1] else []

            true_next = true_branch[0]['node'] if true_branch else 'NONE'
            false_next = false_branch[0]['node'] if false_branch else 'NONE'

            print(f"  TRUE branch → {true_next}")
            print(f"  FALSE branch → {false_next}")

print("\n" + "=" * 70)

if issues:
    print(f"\n❌ Found {len(issues)} issues:")
    for issue in issues:
        print(f"   - {issue}")
else:
    print("\n✅ ALL NODES PROPERLY CONNECTED!")
