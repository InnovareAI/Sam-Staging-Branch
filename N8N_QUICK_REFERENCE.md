# N8N Workflows - Quick Reference

**Last Updated:** November 1, 2025
**Status:** Ready for deployment

---

## 🚀 Quick Start (5 Minutes)

### 1. Import Workflows

**Main Campaign (choose one):**
- **Basic:** `n8n-workflows/campaign-execute-complete.json` (39 nodes)
- **With Reply-Stop:** `n8n-workflows/campaign-execute-complete-with-reply-stop.json` (57 nodes) ← **RECOMMENDED**

**Scheduler:**
- `SAM Scheduled Campaign Checker.json` (7 nodes)

**Import to:**
- Main: https://innovareai.app.n8n.cloud/workflow/2bmFPN5t2y6A4Rx2
- Scheduler: https://innovareai.app.n8n.cloud/workflow/7QJZcRwQBI0wPRS4

### 2. Verify Environment Variables

In N8N Settings → Variables, ensure these exist:
- `UNIPILE_DSN`
- `UNIPILE_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### 3. Activate Workflows

Toggle "Active" switch ON for both workflows

### 4. Test

Execute test campaign with 1 prospect

---

## 📊 Workflow Comparison

| Feature | Basic (39 nodes) | With Reply-Stop (57 nodes) |
|---------|------------------|----------------------------|
| Standard funnel | ✅ | ✅ |
| Connection check | ✅ | ✅ |
| Reply detection | ❌ | ✅ |
| Auto-stop sequences | ❌ | ✅ |
| Database logging | Basic | Enhanced |
| **Recommended for** | Testing only | Production |

---

## 🎯 Standard Funnel Timeline

Day 0 (0h):    CR sent
Day 0 (6h):    Connection check → FU1 (if accepted)
Day 3 (6h):    FU2 sent
Day 8 (6h):    FU3 sent
Day 13 (6h):   FU4 sent
Day 18 (6h):   FU5 sent
Day 23 (6h):   FU6 sent (final message)

**Total:** 7 messages, ~23 days

---

## 📁 Documentation Files

| File | Purpose |
|------|---------|
| **N8N_READY_FOR_TESTING.md** | Quick overview - start here |
| **N8N_WORKFLOW_TESTING_GUIDE.md** | Testing steps |
| **N8N_REPLY_STOP_DEPLOYMENT_GUIDE.md** | Deploy reply-stop |
| **N8N_IMPLEMENTATION_COMPLETE.md** | Final status |

---

**Ready to deploy?** Start with `N8N_READY_FOR_TESTING.md` 🚀
