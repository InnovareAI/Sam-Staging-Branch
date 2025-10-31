# n8n Workflow Visual Layout Guide

## SAM Campaign Execution v3 - Visual Structure

This guide shows you exactly how the workflow should look in the n8n canvas.

---

## Canvas Layout (Left to Right Flow)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            n8n Canvas                                        │
│                                                                              │
│                                                                              │
│  ┌──────────┐         ┌──────────┐         ┌──────────┐                    │
│  │          │         │          │         │          │                     │
│  │ Campaign ├────────►│ Extract  ├────────►│ Process  ├─────┐               │
│  │ Webhook  │         │ Campaign │         │  Each    │     │               │
│  │          │         │   Data   │         │ Prospect │     │               │
│  └──────────┘         └──────────┘         └────┬─────┘     │               │
│                                                  │           │               │
│                                                  │ Loop Back │               │
│                                                  │           │               │
│                       ┌──────────┐         ┌────▼─────┐     │               │
│                       │          │         │          │     │               │
│                       │   Log    │◄────────┤ Prepare  │◄────┘               │
│                       │  Result  │         │ Prospect │                     │
│                       │          │         │   Data   │                     │
│                       └────┬─────┘         └────┬─────┘                     │
│                            │                    │                           │
│                            │               ┌────▼─────┐                     │
│                            │               │          │                     │
│                            └───────────────┤   Send   │                     │
│                                            │ LinkedIn │                     │
│                                            │ Message  │                     │
│                                            └──────────┘                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Node Positions (Approximate)

When creating nodes, place them roughly at these positions:

| Node | X Position | Y Position | Connection To |
|------|-----------|-----------|---------------|
| Campaign Webhook | 250 | 300 | Extract Campaign Data |
| Extract Campaign Data | 500 | 300 | Process Each Prospect |
| Process Each Prospect | 750 | 300 | Prepare Prospect Data |
| Prepare Prospect Data | 1000 | 400 | Send LinkedIn Message |
| Send LinkedIn Message | 1000 | 550 | Log Result |
| Log Result | 750 | 550 | Process Each Prospect (loop) |

---

## Connection Details

### Connection 1: Webhook → Extract
```
Campaign Webhook (output) ──────► Extract Campaign Data (input)
```
- Passes full webhook body
- Type: main
- Index: 0

### Connection 2: Extract → Process
```
Extract Campaign Data (output) ──────► Process Each Prospect (input)
```
- Passes campaign object with prospects array
- Type: main
- Index: 0

### Connection 3: Process → Prepare
```
Process Each Prospect (output) ──────► Prepare Prospect Data (input)
```
- Passes single batch (1 prospect at a time)
- Type: main
- Index: 0

### Connection 4: Prepare → Send
```
Prepare Prospect Data (output) ──────► Send LinkedIn Message (input)
```
- Passes prospect + credentials
- Type: main
- Index: 0

### Connection 5: Send → Log
```
Send LinkedIn Message (output) ──────► Log Result (input)
```
- Passes Unipile API response
- Type: main
- Index: 0

### Connection 6: Log → Process (LOOP BACK)
```
Log Result (output) ──────┐
                          │
                          ▼
Process Each Prospect (input - left side)
```
- Creates loop for next prospect
- Type: main
- Index: 0
- **CRITICAL:** This must connect to the input (left) side of "Process Each Prospect"

---

## Visual Indicators

### Healthy Workflow
```
✅ All nodes: Green outline (no errors)
✅ All connections: Solid gray/black lines
✅ Loop connection: Visible line going back
✅ No red warning icons
✅ Workflow toggle: Green (active)
```

### Broken Workflow
```
❌ Some nodes: Red outline (errors)
❌ Connections: Dotted or missing
❌ Loop connection: Not visible
❌ Red warning icons on nodes
❌ Workflow toggle: Gray (inactive)
```

---

## How to Create Connections

### Method 1: Drag and Drop (Recommended)
1. Hover over the source node
2. Click and hold the small circle on the **right side** (output handle)
3. Drag to the target node
4. Release on the small circle on the **left side** (input handle)
5. Connection line should appear

### Method 2: Plus Button
1. Click the **+** button that appears between nodes
2. Select the target node from the popup
3. Connection is automatically created

### Special: Creating the Loop Back
```
1. Click and drag from Log Result (right side)
2. Drag UP and LEFT
3. Connect to Process Each Prospect (left side)
4. The line will curve back - this is correct!
```

---

## Node Icons

You'll recognize nodes by their icons:

| Node | Icon Description |
|------|------------------|
| Webhook | Lightning bolt ⚡ |
| Code | Brackets `</>` |
| Split In Batches | Split arrows ⇋ |
| HTTP Request | Globe 🌐 |

---

## Testing the Visual Structure

### In the n8n UI:

1. **Check all nodes are visible**
   - Should see 6 nodes total
   - All nodes should have names matching the guide

2. **Check all connections**
   - Should see 6 connection lines
   - 5 going left-to-right
   - 1 going right-to-left (loop back)

3. **Check for warnings**
   - Click each node
   - Look for red exclamation marks
   - Fix any configuration errors

4. **Zoom out to see full workflow**
   - Use mouse wheel or zoom controls
   - Entire workflow should fit on screen
   - Should look like a flow with a loop

---

## Example: Complete Workflow View

When zoomed out, you should see something like this:

```
START                                                           END
  |                                                              |
  v                                                              v
[Webhook] → [Extract] → [Process] → [Prepare] → [Send] → [Log]
                           ↑                                  |
                           |                                  |
                           └──────────── Loop Back ───────────┘
```

**Count these:**
- Nodes: 6 ✓
- Forward connections: 5 ✓
- Backward connections: 1 ✓
- Total connections: 6 ✓

---

## Color Coding (After Execution)

After running a test execution, nodes will have colored indicators:

| Color | Meaning |
|-------|---------|
| Green checkmark | Node executed successfully with data |
| Orange warning | Node executed with warnings |
| Red X | Node failed to execute |
| Gray | Node not executed yet |

**Goal:** All 6 nodes should have green checkmarks after test execution.

---

## Canvas Navigation Tips

### Moving Around:
- **Pan:** Click and drag empty canvas space
- **Zoom:** Mouse wheel or two-finger scroll
- **Zoom to fit:** Click "Fit to View" button (top right)

### Selecting Nodes:
- **Single:** Click the node
- **Multiple:** Cmd+Click (Mac) or Ctrl+Click (Windows)
- **All:** Cmd+A or Ctrl+A

### Moving Nodes:
- **Single:** Click and drag the node
- **Multiple:** Select multiple, then drag one
- **Align:** Use right-click → "Align" menu

---

## Final Visual Checklist

Before activating the workflow, verify:

- [ ] All 6 nodes are on the canvas
- [ ] All nodes have correct names (match guide)
- [ ] All nodes have correct types (Code not Function)
- [ ] 5 forward connections visible
- [ ] 1 loop back connection visible
- [ ] No red error indicators
- [ ] No disconnected nodes
- [ ] Workflow can be activated (toggle switch works)

---

## Screenshot Checklist

When sharing your workflow, take screenshots showing:

1. **Full workflow view** (zoomed out to see all nodes)
2. **Connection details** (zoomed in on the loop back connection)
3. **Node list** (left sidebar showing all 6 nodes)
4. **Execution view** (showing green checkmarks on all nodes)

---

## Common Visual Mistakes

### Mistake 1: Missing Loop Back
```
❌ WRONG:
[Webhook] → [Extract] → [Process] → [Prepare] → [Send] → [Log]
(No loop back - will only process 1 prospect)

✅ CORRECT:
[Webhook] → [Extract] → [Process] → [Prepare] → [Send] → [Log]
                           ↑                                  |
                           └──────────────────────────────────┘
```

### Mistake 2: Disconnected Nodes
```
❌ WRONG:
[Webhook]   [Extract]   [Process]   [Prepare]
(Nodes exist but not connected)

✅ CORRECT:
[Webhook] → [Extract] → [Process] → [Prepare]
(Connected with visible lines)
```

### Mistake 3: Wrong Connection Direction
```
❌ WRONG:
[Log Result] ──► [Process Each Prospect (output side)]
(Connected to output instead of input)

✅ CORRECT:
[Log Result] ──► [Process Each Prospect (input side)]
(Connected to the left/input side)
```

---

## Next Steps After Visual Setup

1. **Save the workflow** (Cmd+S or Ctrl+S)
2. **Activate the workflow** (toggle switch)
3. **Run visual test** (Execute Workflow button)
4. **Check node colors** (all should be green)
5. **Run webhook test** (use test script)

---

## Help & Troubleshooting

If your workflow doesn't look like the diagrams above:

1. **Delete and start over** - Sometimes easier than fixing
2. **Follow guide step-by-step** - Don't skip ahead
3. **Check each connection** - Click to verify it's real
4. **Test early and often** - Test after adding each node

---

**Remember:** The visual structure is CRITICAL. If nodes aren't properly connected, the workflow won't work, even if the code is correct.

**Take your time** - It's better to build it correctly once than to rebuild it multiple times.

---

**Created:** October 31, 2025
**For:** SAM Campaign Execution v3 Manual Creation
