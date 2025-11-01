# N8N Workflow - Standard Funnel Configuration

**Status:** ✅ COMPLETE - Implemented in N8N workflow and API payload

## Actual Standard Funnel (ALL Workspaces)

**Timeline:**
- **Day 0**: CR (Connection Request) sent
- **+6 hours**: FU1 sent
- **+3 days**: FU2 sent
- **+5 days**: FU3 sent
- **+5 days**: FU4 sent
- **+5 days**: FU5 sent
- **+5 days**: FU6 sent

**Total Duration:** ~23 days

## Detailed Timeline

```
Day 0 (0h):        CR sent
Day 0 (6h):        FU1 sent (6 hours after CR)
Day 3 (6h):        FU2 sent (3 days after FU1)
Day 8 (6h):        FU3 sent (5 days after FU2)
Day 13 (6h):       FU4 sent (5 days after FU3)
Day 18 (6h):       FU5 sent (5 days after FU4)
Day 23 (6h):       FU6 sent (5 days after FU5)
```

## Wait Node Configuration

1. **Wait for FU1**: 6 hours
2. **Wait for FU2**: 3 days (72 hours)
3. **Wait for FU3**: 5 days (120 hours)
4. **Wait for FU4**: 5 days (120 hours)
5. **Wait for FU5**: 5 days (120 hours)
6. **Wait for FU6**: 5 days (120 hours)

## Notes

- ✅ Connection acceptance check via Unipile relations API (after 6 hours)
- NO goodbye message (FU6 is final message)
- All workspaces use same timing
- Total: 7 messages (CR + 6 follow-ups)
- Sequences end gracefully if connection not accepted

## Implementation Status ✅

**Completed Updates:**
1. ✅ Added Unipile connection check nodes (queries relations API after 6 hours)
2. ✅ Changed first wait to "Wait 6 Hours for FU1"
3. ✅ Updated all wait nodes to match standard funnel timing
4. ✅ Renamed "Goodbye" nodes to "FU6" (FU6 is final message)
5. ✅ Updated message keys: fu1, fu2, fu3, fu4, fu5, fu6
6. ✅ Updated API payload in execute-live/route.ts to send correct timing
7. ✅ Added graceful handling for unaccepted connections

**Files Updated:**
- `n8n-workflows/campaign-execute-complete.json` - N8N workflow with standard funnel (39 nodes)
- `app/api/campaigns/linkedin/execute-live/route.ts` - API payload timing structure

**Connection Verification:**
- Uses Unipile `/api/v1/users/{username}/relations` endpoint
- Checks if prospect's provider_id exists in relations list
- If not connected: marks prospect as `connection_not_accepted` and ends sequence
- If connected: proceeds with FU1-6 sequence

