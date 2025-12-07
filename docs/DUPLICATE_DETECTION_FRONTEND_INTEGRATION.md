# Duplicate Detection - Frontend Integration Guide

**Status:** Backend Complete | Frontend Pending
**Date:** December 7, 2025

---

## ✅ Backend Implementation (COMPLETED)

### 1. API Changes

**File:** `app/api/prospect-approval/upload-prospects/route.ts`

- Campaign-type-aware duplicate detection
- Returns `duplicate_warnings` array in response
- Email duplicates: `blocking: false` (warning only)
- LinkedIn duplicates: `blocking: true` (hard block)

**File:** `app/api/prospect-approval/remove-from-campaign/route.ts` (NEW)

- DELETE endpoint to remove prospects from campaigns
- Parameters: `campaign_id`, `identifier`, `type`
- Security: workspace membership validation

---

## 🎨 Frontend Integration (TO IMPLEMENT)

### Step 1: Add Duplicate Warning UI Component

Add this component to `DataCollectionHub.tsx` after the type definitions:

```typescript
// Duplicate Warning Badge Component
function DuplicateWarningBadge({
  warning,
  prospectId,
  onRemoveFromCampaign
}: {
  warning: DuplicateWarning
  prospectId: string
  onRemoveFromCampaign: (campaignId: string, identifier: string, type: string) => Promise<void>
}) {
  const [isRemoving, setIsRemoving] = useState(false)

  const handleRemove = async () => {
    setIsRemoving(true)
    try {
      await onRemoveFromCampaign(
        warning.existing_campaign_id,
        warning.identifier,
        warning.type
      )
      toastSuccess(`Removed from ${warning.existing_campaign_name}`)
    } catch (error) {
      toastError('Failed to remove from campaign')
    } finally {
      setIsRemoving(false)
    }
  }

  if (warning.blocking) {
    // LinkedIn campaigns - hard block
    return (
      <div className="mt-2 p-2 bg-red-600/20 border border-red-600/30 rounded flex items-start gap-2">
        <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 text-xs">
          <p className="text-red-300 font-medium">
            🚫 Already in {warning.existing_campaign_name}
          </p>
          <p className="text-red-400/80 mt-0.5">
            LinkedIn profiles can only be in one campaign at a time
          </p>
        </div>
      </div>
    )
  }

  // Email campaigns - warning with action
  return (
    <div className="mt-2 p-2 bg-yellow-600/20 border border-yellow-600/30 rounded flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1 text-xs">
        <p className="text-yellow-300 font-medium">
          ⚠️ Also in {warning.existing_campaign_name}
        </p>
        <p className="text-yellow-400/80 mt-0.5">
          This email is already in another campaign
        </p>
        <button
          onClick={handleRemove}
          disabled={isRemoving}
          className="mt-1 px-2 py-1 text-xs bg-yellow-600/30 hover:bg-yellow-600/50 rounded text-yellow-200 disabled:opacity-50"
        >
          {isRemoving ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
              Removing...
            </>
          ) : (
            'Remove from that campaign'
          )}
        </button>
      </div>
    </div>
  )
}
```

### Step 2: Add Remove Function

Add this function inside the DataCollectionHub component:

```typescript
// Remove prospect from existing campaign
const handleRemoveFromCampaign = async (
  campaignId: string,
  identifier: string,
  type: 'email' | 'linkedin'
) => {
  try {
    const response = await fetch(
      `/api/prospect-approval/remove-from-campaign?` +
      `campaign_id=${campaignId}&identifier=${encodeURIComponent(identifier)}&type=${type}`,
      { method: 'DELETE' }
    )

    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to remove prospect')
    }

    // Update local state - remove duplicate warning for this prospect
    const updatedWarnings = new Map(duplicateWarnings)
    // Find and remove the warning by matching identifier
    for (const [key, warning] of updatedWarnings) {
      if (warning.identifier === identifier && warning.type === type) {
        updatedWarnings.delete(key)
      }
    }
    setDuplicateWarnings(updatedWarnings)

    // Update prospect data to remove duplicate warning
    setProspectData(prev => prev.map(p => {
      const prospectIdentifier = type === 'email'
        ? (p.email || p.contact?.email)
        : (p.contact?.linkedin_url || p.linkedin_url || p.linkedinUrl)

      if (prospectIdentifier === identifier) {
        return { ...p, duplicateWarning: undefined }
      }
      return p
    }))

    return data
  } catch (error) {
    console.error('Remove from campaign error:', error)
    throw error
  }
}
```

### Step 3: Update CSV Upload Handler

Modify the `handleCsvUpload` function to capture duplicate warnings:

```typescript
// Inside handleCsvUpload, after successful upload:
const data = await response.json()

if (data.success) {
  // Store duplicate warnings
  if (data.duplicate_warnings && data.duplicate_warnings.length > 0) {
    const warningsMap = new Map<string, DuplicateWarning>()
    data.duplicate_warnings.forEach((warning: DuplicateWarning) => {
      // Use identifier as key
      warningsMap.set(warning.identifier, warning)
    })
    setDuplicateWarnings(warningsMap)

    // Show summary toast
    toastInfo(
      `Uploaded ${data.count} prospects. ` +
      `${data.duplicate_warnings.length} duplicate(s) detected - review warnings during approval.`
    )
  } else {
    toastSuccess(data.message)
  }

  // ... rest of existing code
}
```

### Step 4: Attach Warnings to Prospects

After loading prospects from the database, match them with duplicate warnings:

```typescript
// Inside fetchProspectApprovalData or wherever prospects are loaded:
const prospectsWithWarnings = prospectsFromDB.map(prospect => {
  // Check for duplicate warning by LinkedIn URL
  const linkedinUrl = prospect.contact?.linkedin_url || prospect.linkedin_url
  if (linkedinUrl) {
    const warning = duplicateWarnings.get(linkedinUrl)
    if (warning) {
      return { ...prospect, duplicateWarning: warning }
    }
  }

  // Check for duplicate warning by email
  const email = prospect.email || prospect.contact?.email
  if (email) {
    const warning = duplicateWarnings.get(email)
    if (warning) {
      return { ...prospect, duplicateWarning: warning }
    }
  }

  return prospect
})

setProspectData(prospectsWithWarnings)
```

### Step 5: Display Warning in Prospect Cards

Find where prospect cards are rendered (look for the approval list rendering) and add:

```typescript
{/* Inside prospect card rendering - after prospect name/title */}
{prospect.duplicateWarning && (
  <DuplicateWarningBadge
    warning={prospect.duplicateWarning}
    prospectId={prospect.id}
    onRemoveFromCampaign={handleRemoveFromCampaign}
  />
)}
```

### Step 6: Disable Approval for Blocking Duplicates

Update the approval checkbox logic:

```typescript
// Inside prospect card checkbox:
<input
  type="checkbox"
  checked={prospect.approvalStatus === 'approved'}
  disabled={prospect.duplicateWarning?.blocking} // ← Add this
  onChange={() => handleApproveProspect(prospect.id)}
  className={`... ${prospect.duplicateWarning?.blocking ? 'opacity-50 cursor-not-allowed' : ''}`}
/>
```

---

## 🧪 Testing Checklist

### Email Campaigns (Warning Only)
- [ ] Upload CSV with duplicate email
- [ ] See yellow warning badge
- [ ] Click "Remove from that campaign"
- [ ] Warning disappears
- [ ] Can approve prospect for new campaign

### LinkedIn Campaigns (Blocking)
- [ ] Upload CSV with duplicate LinkedIn URL
- [ ] See red error badge
- [ ] Checkbox is disabled
- [ ] Cannot approve prospect
- [ ] Message explains LinkedIn limitation

### Edge Cases
- [ ] Same prospect in multiple campaigns (multiple warnings)
- [ ] Remove from one campaign, warning updates
- [ ] Hard refresh preserves warnings
- [ ] Campaign creation fails if blocking duplicates approved

---

## 📊 User Experience

### Email Campaign Duplicates
```
[✓] john@acme.com - Marketing Manager
    Company: Acme Corp

    ⚠️ Also in "Q1 Product Launch"
    This email is already in another campaign
    [Remove from that campaign]
```

### LinkedIn Campaign Duplicates
```
[ ] jane-doe (disabled)
    Senior Developer @ TechCo

    🚫 Already in "Engineering Outreach 2025"
    LinkedIn profiles can only be in one campaign at a time
```

---

## 🔗 Related Files

- **Backend API:** `app/api/prospect-approval/upload-prospects/route.ts`
- **Remove API:** `app/api/prospect-approval/remove-from-campaign/route.ts`
- **Frontend (to modify):** `components/DataCollectionHub.tsx`
- **Type definitions:** Already added to DataCollectionHub.tsx (lines 25-33, 53)

---

## ✅ Next Steps

1. Add `DuplicateWarningBadge` component to DataCollectionHub.tsx
2. Add `handleRemoveFromCampaign` function
3. Update CSV upload handler to capture warnings
4. Attach warnings to prospects after loading
5. Display warnings in prospect cards
6. Disable checkboxes for blocking duplicates
7. Test with real data
8. Deploy to production

**Estimated Time:** 45 minutes
