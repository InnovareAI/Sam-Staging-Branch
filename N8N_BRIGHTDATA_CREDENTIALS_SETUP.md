# N8N BrightData Credentials Setup

**Issue:** "Credentials for 'Header Auth' are not set" on the "Scrape LinkedIn Profile" node

**Solution:** Configure Header Auth credentials in N8N for BrightData API

---

## Quick Setup (2 minutes)

### Step 1: Open the Workflow

Go to: https://workflows.innovareai.com/workflow/MlOCPY7qzZ2nEuue

### Step 2: Configure BrightData Header Auth

1. **Click on the "Scrape LinkedIn Profile" node** (should show ⚠️ warning)

2. **In the "Authentication" section**, click on the **"Header Auth account"** dropdown

3. **Click "Create New Credential"**

4. **Configure the credential:**
   - **Name:** `BrightData API Token`
   - **Header Name:** `Authorization`
   - **Header Value:** `Bearer 61813293-6532-4e16-af76-9803cc043afa`
     - (This is your BrightData API token with "Bearer " prefix)

5. **Click "Save"**

6. **Save the workflow** (top-right)

---

## Alternative: Remove Credential Requirement

If the above doesn't work, we can modify the node to not use N8N credentials:

1. Click the "Scrape LinkedIn Profile" node
2. In "Authentication" section, change from **"Generic Credential Type"** to **"None"**
3. The Authorization header is already configured in "Headers" section
4. Save the workflow

This works because we're passing the BrightData token dynamically from the webhook payload.

---

## Verify Setup

After configuring credentials:

1. **Activate the workflow** (toggle "Inactive" → "Active")
2. **Run the test script:**
   ```bash
   node scripts/test-enrichment-flow.mjs
   ```
3. **Should show:** ✅ Workflow Status: ACTIVE

---

## BrightData Credentials Reference

From your `.env.local`:
```
BRIGHTDATA_API_TOKEN=61813293-6532-4e16-af76-9803cc043afa
BRIGHTDATA_ZONE=linkedin_enrichment
```

These are passed to the workflow via webhook payload, so the Header Auth credential just needs to match this format.

---

## Troubleshooting

### Issue: "Authorization failed" when testing credential

**This is normal.** N8N's credential test doesn't work for BrightData's API format. The credential will work fine during actual workflow execution.

### Issue: Node still shows ⚠️ after saving

**Refresh the page** or **deactivate and reactivate** the workflow to clear the warning cache.

### Issue: Can't find Header Auth in credentials

Make sure you're on the **"Scrape LinkedIn Profile"** node, not a Supabase node. Only the BrightData HTTP Request node needs Header Auth.

---

**Next Step:** Once credentials are configured, activate the workflow and run the test!
