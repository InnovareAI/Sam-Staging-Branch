# Campaign Editor Settings & Templates - Handover Document
**Date:** October 7, 2025
**Session Focus:** Campaign Steps Editor Settings Integration + Email Providers + Industry Templates

---

## ✅ Completed Work

### 1. **Campaign Steps Editor - Settings Feature**
- **Location:** `/app/components/CampaignStepsEditor.tsx`
- **Added components:**
  - Settings button in header toolbar (gray background with Settings icon)
  - Back button with arrow icon (replaces close X in top left)
  - Comprehensive settings modal matching Campaign Hub style

#### Settings Modal Sections:
1. **Campaign Name** - Rename campaign with character counter
2. **Campaign Limits** - Daily send limits for:
   - New connection requests/emails
   - Follow-up messages/emails
3. **Campaign Priority** - High/Medium/Low priority with toggle
4. **Schedule Campaign** - DateTime picker with timezone info
5. **Prospects** - LinkedIn/Email specific prospect settings
6. **Campaign Status** - Dropdown to change active/paused/inactive/completed/archived
7. **Delete Campaign** - Red delete button with warning text

#### Key Features:
- **Adaptive UI** - Settings change based on campaign type (LinkedIn vs Email)
- **Sticky headers** - Header and footer sticky for long scroll
- **Save/Cancel** - Action buttons at bottom
- **Backend integration** - Placeholder for save handler (needs implementation)

**Lines modified:** 1-4, 88, 225-804

---

## 📋 User Requirements Captured

### 1. **Back Button Implementation** ✅ COMPLETE
**User Request:** "make sure all subpages have a back function"

**Solution:**
- Added `<ArrowLeft>` icon button in Campaign Steps Editor header
- Button positioned prominently in top-left
- Calls `onClose()` to return to Campaign Hub
- Includes tooltip text "Back to campaigns"

**Location:** CampaignStepsEditor.tsx:230-237

### 2. **Email Provider Integration** ⚠️ EXISTING (needs verification)
**User Request:** "we need to connect Google and Micorsoft to Unipile (under settings & profile and email integration)"

**Status:**
- Email Providers modal **ALREADY EXISTS** at `/app/components/EmailProvidersModal.tsx`
- Supports Google OAuth, Microsoft OAuth, and SMTP
- Uses Unipile hosted auth for Google (`/api/unipile/hosted-auth`)
- Microsoft OAuth uses Azure AD

**Integration Points Found:**
```typescript
// Google via Unipile
POST /api/unipile/hosted-auth
{
  "provider": "GOOGLE",
  "api_url": "..."
}

// Microsoft OAuth
POST /api/email-providers/microsoft/connect
```

**Verification Needed:**
- ✅ Modal component exists
- ✅ API routes exist
- ⚠️ Need to verify if modal is accessible in Settings
- ⚠️ Need to verify Unipile Google OAuth flow works
- ⚠️ Need OAuth credentials configured in Azure/Google Cloud

**Documentation:** `/docs/email-providers-setup.md`

### 3. **Industry-Specific Templates** 🚧 TO BE BUILT
**User Request:** "we need to build over time messaging templates that work - by industry"

**Current State:**
- Template library exists (`sam_template_library` table)
- API endpoints exist:
  - GET `/api/sam/template-library`
  - POST `/api/sam/template-library`
  - POST `/api/sam/process-user-template`
- Template system not yet industry-segmented

**Proposed Implementation:**
1. Add `industry` column to templates (may already exist - needs verification)
2. Build industry-specific template collections:
   - **SaaS/Technology**
   - **Real Estate**
   - **Financial Services**
   - **Healthcare**
   - **Manufacturing**
   - **Professional Services**
   - **E-commerce/Retail**
3. Create template performance tracking by industry
4. Add industry filter to template library UI
5. Implement A/B testing for industry templates

**Database Schema (sam_template_library):**
```sql
- id (UUID)
- workspace_id (UUID)
- created_by (UUID)
- name (TEXT)
- type (TEXT) -- 'connection_request', 'follow_up_1', etc.
- content (TEXT)
- variables (TEXT[])
- industry (TEXT) -- ⚠️ VERIFY THIS EXISTS
- campaign_type (TEXT)
- performance_data (JSONB)
- usage_count (INTEGER)
```

---

## 🗂️ Files Modified

### 1. `/app/components/CampaignStepsEditor.tsx` (808 lines)
**Changes:**
- Imported `Settings` and `ArrowLeft` icons from lucide-react
- Added `showSettings` state variable
- Modified header to include Back button and Settings button
- Added comprehensive settings modal (lines 614-804)
- Settings modal uses campaign type helpers (`isLinkedInCampaign`, `getCampaignTypeLabel`)

**Key sections:**
```typescript
// Line 4: New imports
import { Settings, ArrowLeft } from 'lucide-react';

// Line 88: New state
const [showSettings, setShowSettings] = useState(false);

// Lines 230-237: Back button
<button onClick={onClose} className="...">
  <ArrowLeft size={20} />
  <span className="text-sm">Back</span>
</button>

// Lines 244-251: Settings button
<button onClick={() => setShowSettings(true)} className="...">
  <Settings size={18} />
  Settings
</button>

// Lines 615-804: Settings modal
{showSettings && (
  <div className="fixed inset-0 bg-black bg-opacity-75 ...">
    {/* Full settings modal */}
  </div>
)}
```

---

## 🔗 Related Components & Files

### Email Provider Integration:
1. **Modal:** `/app/components/EmailProvidersModal.tsx`
2. **API Routes:**
   - `/app/api/email-providers/route.ts` - GET/POST for providers
   - `/app/api/email-providers/[id]/route.ts` - DELETE individual provider
   - `/app/api/unipile/hosted-auth/route.ts` - Google OAuth via Unipile
   - `/app/api/unipile/hosted-auth/callback/route.ts` - OAuth callback
3. **Documentation:**
   - `/docs/email-providers-setup.md` - Setup guide
   - `/docs/OAUTH_SETUP_GUIDE.md` - OAuth configuration
4. **Migration:** `/supabase/migrations/20250916_create_email_providers.sql`

### Template Library:
1. **API Routes:**
   - `/app/api/sam/template-library/route.ts`
   - `/app/api/sam/process-user-template/` (upload handler)
   - `/app/api/campaigns/templates/`
2. **Database:** `sam_template_library` table
3. **UI:** Template library modal in CampaignStepsEditor (lines 493-612)

---

## 🚧 Pending Work

### 1. **Backend Integration for Settings** (High Priority)
**Current State:** Settings modal has placeholder save handler

**Needs Implementation:**
1. Create API endpoint: `PUT /api/campaigns/{campaignId}/settings`
2. Connect form inputs to state management
3. Validate all settings before save
4. Update campaign in database
5. Show success/error notifications
6. Refresh campaign data after save

**Backend Route Structure:**
```typescript
// /app/api/campaigns/[campaignId]/settings/route.ts
export async function PUT(req: NextRequest, { params }: { params: { campaignId: string } }) {
  // Validate user owns campaign
  // Parse settings from request body
  // Update campaigns table
  // Return updated campaign
}
```

### 2. **Email Provider Settings Integration** (Medium Priority)
**User Requirement:** "connect Google and Micorsoft to Unipile (under settings & profile and email integration)"

**Tasks:**
1. **Verify Email Providers Modal Location:**
   - Check if EmailProvidersModal is accessible from Settings page
   - If not, add email integration section to Settings

2. **Test Google OAuth via Unipile:**
   - Verify Unipile hosted auth endpoint works
   - Test OAuth flow: click → Unipile → Google → callback → stored
   - Check `email_providers` table for successful connection

3. **Test Microsoft OAuth:**
   - Configure Azure AD app credentials
   - Test OAuth flow
   - Verify token storage and refresh

4. **Add to Settings Page:**
   - Create "Email Integration" section in `/app/workspace/[workspaceId]/settings/page.tsx`
   - Include EmailProvidersModal component
   - Show connected accounts with status badges

**Example Settings Integration:**
```typescript
<div className="border-b border-gray-700 pb-6">
  <h4 className="text-white font-medium mb-2">Email Integration</h4>
  <p className="text-gray-400 text-sm mb-4">
    Connect your Google or Microsoft email accounts for cold email campaigns.
  </p>
  <button
    onClick={() => setShowEmailProviders(true)}
    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
  >
    Manage Email Accounts
  </button>
</div>

{showEmailProviders && (
  <EmailProvidersModal
    isOpen={showEmailProviders}
    onClose={() => setShowEmailProviders(false)}
  />
)}
```

### 3. **Industry-Specific Template System** (High Priority)
**User Requirement:** "we need to build over time messaging templates that work - by industry"

**Phase 1: Data Structure** (1-2 hours)
1. Verify `industry` column exists in `sam_template_library`
2. If not, create migration to add industry field
3. Add industry enum/validation
4. Create template categories by industry

**Phase 2: Template Creation** (4-6 hours)
Create 3-5 templates per industry for each message type:

**Industries to cover:**
1. **SaaS/Technology**
   - Connection request
   - Follow-up 1: Value proposition
   - Follow-up 2: Case study
   - Follow-up 3: Demo offer

2. **Real Estate**
   - Connection request
   - Follow-up 1: Market insights
   - Follow-up 2: Success story
   - Follow-up 3: Meeting invitation

3. **Financial Services**
   - Connection request (compliance-friendly)
   - Follow-up 1: Industry challenge
   - Follow-up 2: Solution approach
   - Follow-up 3: Consultation offer

4. **Healthcare**
   - Connection request (HIPAA-aware)
   - Follow-up 1: Patient outcomes focus
   - Follow-up 2: Efficiency gains
   - Follow-up 3: Demo/walkthrough

5. **Manufacturing**
   - Connection request
   - Follow-up 1: Operational efficiency
   - Follow-up 2: ROI focus
   - Follow-up 3: Site visit/demo

**Template Structure:**
```typescript
{
  id: string,
  name: "SaaS - Connection Request - Value Focus",
  industry: "saas",
  campaign_type: "connector",
  type: "connection_request",
  content: "Hi {{first_name}}, noticed {{company_name}} is scaling...",
  variables: ["first_name", "company_name", "industry", "pain_point"],
  performance_data: {
    sent_count: 0,
    response_rate: 0,
    positive_response_rate: 0,
    avg_response_time_hours: 0
  },
  usage_count: 0,
  tags: ["value-first", "non-salesy", "consultative"]
}
```

**Phase 3: UI Integration** (2-3 hours)
1. Add industry filter to template library modal
2. Show template performance metrics by industry
3. Implement "Use Template" button functionality
4. Add template preview with variable highlighting
5. Create "Upload Custom Template" feature

**Phase 4: Performance Tracking** (2-3 hours)
1. Track template usage per campaign
2. Calculate response rates by template + industry
3. Show "Top Performing" templates
4. Add A/B testing framework for templates
5. Create template recommendation engine

### 4. **Settings Persistence** (Medium Priority)
**Tasks:**
1. Save settings to localStorage for quick access
2. Implement settings validation before save
3. Add unsaved changes warning
4. Create settings history/audit log
5. Add "Reset to Default" option

---

## 🎯 Next Steps Summary

### Immediate (This Session)
1. ✅ Add settings button to Campaign Steps Editor - **COMPLETE**
2. ✅ Add back button to Campaign Steps Editor - **COMPLETE**
3. ✅ Create comprehensive settings modal - **COMPLETE**
4. ⚠️ Verify email provider integration exists - **FOUND EXISTING**
5. 🚧 Design industry template system - **DOCUMENTED**

### Short Term (Next Session)
1. **Backend Settings API** - Create PUT endpoint for campaign settings
2. **Email Integration Verification** - Test Google/Microsoft OAuth flows
3. **Template System Phase 1** - Set up industry categorization
4. **Template Creation** - Build initial template library (15-25 templates)

### Medium Term (Next 2-3 Sessions)
1. **Template Performance Tracking** - Add analytics to templates
2. **Template Recommendations** - AI-powered template suggestions
3. **A/B Testing Framework** - Test templates against each other
4. **Settings Audit Log** - Track all campaign setting changes

---

## 💡 Technical Notes

### Campaign Type Detection:
The settings modal uses the existing `isLinkedInCampaign()` helper function to adapt UI based on campaign type:
```typescript
function isLinkedInCampaign(type: string): boolean {
  return ['connector', 'messenger', 'open_inmail', 'builder', 'group',
          'event_invite', 'inbound', 'event_participants', 'recovery',
          'company_follow'].includes(type);
}
```

This ensures LinkedIn campaigns show LinkedIn-specific settings, and email campaigns show email-specific settings.

### Settings Modal Styling:
- Uses sticky positioning for header and footer
- max-h-[90vh] with overflow-y-auto for long content
- z-50 to ensure modal appears above all other content
- backdrop blur for better focus

### Back Button UX:
- Positioned prominently in top-left (standard navigation pattern)
- Includes both icon and text for clarity
- Maintains same `onClose()` behavior as close X button
- Hover states for visual feedback

---

## 🔍 Verification Checklist

Before deploying to production:

### Settings Feature:
- [ ] Settings button opens modal
- [ ] Back button returns to Campaign Hub
- [ ] All form inputs work correctly
- [ ] Save button calls backend API
- [ ] Settings persist after save
- [ ] Cancel button discards changes
- [ ] Modal closes on successful save
- [ ] Error handling for failed saves

### Email Integration:
- [ ] EmailProvidersModal accessible from Settings
- [ ] Google OAuth flow completes successfully
- [ ] Microsoft OAuth flow completes successfully
- [ ] Connected accounts show correct status
- [ ] Account disconnect works properly
- [ ] SMTP configuration validates correctly

### Template System:
- [ ] Templates categorized by industry
- [ ] Template library shows industry filter
- [ ] "Use Template" applies content correctly
- [ ] Variable substitution works
- [ ] Performance metrics display
- [ ] Template upload functionality works

---

## 📊 Database Schema References

### Campaigns Table:
```sql
- id (UUID)
- workspace_id (UUID)
- name (TEXT)
- type (TEXT) -- 'connector', 'messenger', 'email', etc.
- status (TEXT) -- 'active', 'paused', 'inactive', 'completed', 'archived'
- priority (TEXT) -- 'high', 'medium', 'low'
- daily_connection_limit (INTEGER)
- daily_followup_limit (INTEGER)
- schedule_start (TIMESTAMPTZ)
- settings (JSONB) -- Additional settings storage
```

### Email Providers Table:
```sql
- id (UUID)
- user_id (UUID)
- workspace_id (UUID)
- provider_type (TEXT) -- 'google', 'microsoft', 'smtp'
- email_address (TEXT)
- status (TEXT) -- 'connected', 'disconnected', 'error'
- oauth_access_token (TEXT, encrypted)
- oauth_refresh_token (TEXT, encrypted)
- oauth_expires_at (TIMESTAMPTZ)
- config (JSONB)
```

### Sam Template Library Table:
```sql
- id (UUID)
- workspace_id (UUID)
- created_by (UUID)
- name (TEXT)
- type (TEXT)
- content (TEXT)
- variables (TEXT[])
- industry (TEXT) -- ⚠️ VERIFY/ADD IF MISSING
- campaign_type (TEXT)
- performance_data (JSONB)
- usage_count (INTEGER)
- tags (TEXT[]) -- ⚠️ ADD IF MISSING
```

---

## ✨ Summary

**Session Achievement:** Successfully added comprehensive settings feature to Campaign Steps Editor with back button navigation. Identified existing email provider integration and documented industry template system requirements.

**What Works:**
- ✅ Settings button in Campaign Steps Editor header
- ✅ Back button for easy navigation
- ✅ Comprehensive settings modal with all sections
- ✅ Campaign type-adaptive UI (LinkedIn vs Email)
- ✅ Clean, professional styling matching Campaign Hub
- ✅ Sticky header/footer for long scroll

**What's Needed:**
- Backend API for saving settings
- Email provider integration verification
- Industry template system implementation
- Template performance tracking
- Settings persistence and validation

---

**Session Status:** ✅ Core Settings Feature Complete
**Deployment:** Ready for backend integration
**Next Agent:** Implement settings save API + verify email integration + build industry templates
