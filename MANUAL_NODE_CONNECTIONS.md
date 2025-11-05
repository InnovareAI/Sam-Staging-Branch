# Quick Node Connection Guide

Since the JSON import doesn't preserve connections, here's the fastest way to connect all 15 nodes:

## Connection Sequence (in order):

**Start → End connections:**

1. **Enrichment Job Webhook** → **Parse Job Data**
2. **Parse Job Data** → **Mark Job as Processing**
3. **Mark Job as Processing** → **Get Prospects to Enrich**
4. **Get Prospects to Enrich** → **Loop Through Prospects**
5. **Loop Through Prospects** → **Extract LinkedIn URL from Contact**
6. **Extract LinkedIn URL** → **Check LinkedIn URL Exists**

**IF branch (TRUE - has LinkedIn URL):**
7. **Check LinkedIn URL Exists** (top/green output) → **Update Current Prospect Progress**
8. **Update Current Prospect** → **Scrape LinkedIn Profile**
9. **Scrape LinkedIn Profile** → **Parse LinkedIn Data**
10. **Parse LinkedIn Data** → **Update Prospect with Enriched Data**
11. **Update Prospect** → **Increment Processed Count**
12. **Increment Processed Count** → **Loop Through Prospects** (loop back to step 4)

**ELSE branch (FALSE - no LinkedIn URL):**
13. **Check LinkedIn URL Exists** (bottom/red output) → **Increment Failed Count**
14. **Increment Failed Count** → **Loop Through Prospects** (loop back to step 4)

**Loop completion:**
15. **Loop Through Prospects** (when done - third output) → **Mark Job Complete**
16. **Mark Job Complete** → **Respond to Webhook**

## Visual Flow:

```
Webhook → Parse → Mark Processing → Get Prospects → Loop
                                                      ↓
                              ← ← ← ← ← ← ← ← ← ← ← ←
                              ↑                       ↓
                    Increment Processed        Extract LinkedIn URL
                              ↑                       ↓
                    Update Prospect            Check URL Exists
                              ↑                    ↙     ↘
                    Parse Data                  YES      NO
                              ↑                   ↓       ↓
                    Scrape Profile          Update    Increment
                              ↑             Progress   Failed
                              ↑                ↓         ↓
                              └────────────────┴─────────┘
                                        (both loop back)

When Loop Done → Mark Complete → Respond
```

## Tips:
- Use Shift+Click to multi-select and align nodes
- Connections are made by dragging from output circle (→) to input circle
- The Loop node has 3 outputs: process item, done, error
- Save frequently (Ctrl+S)
