# SAM Landing Page - CTA Update Instructions

## Current State Analysis

Based on the SAM page at https://innovareai.com/sam/, here are all the CTAs and their current links:

### Top Navigation
- **"Let's Talk" button** → `https://calendly.com/innovareai/ai-agent-demo-meeting`

### Hero Section
- **"Book A Demo" button** → `https://calendly.com/innovareai/ai-agent-demo-meeting`

---

## Recommended Updates

### Option 1: Change ALL CTAs to Signup

Replace all Calendly demo links with direct signup:

**Old URL**: `https://calendly.com/innovareai/ai-agent-demo-meeting`
**New URL**: `https://app.meet-sam.com/signup/innovareai?source=sam-landing-page`

**Buttons to update:**
1. Top navigation "Let's Talk" button
2. Hero section "Book A Demo" button

**Benefits:**
- Direct conversion path
- Lower friction (no calendar booking required)
- Track signups with `source=sam-landing-page` parameter

---

### Option 2: Mixed CTA Strategy (Recommended)

**Top Navigation "Let's Talk"** → Keep as demo link (for high-intent visitors)
**Hero "Book A Demo"** → Change to: `https://app.meet-sam.com/signup/innovareai?source=sam-landing-hero`

**Add New CTA Button** → "Start Free Trial" → `https://app.meet-sam.com/signup/innovareai?source=sam-landing-cta`

**Benefits:**
- Serve both self-service and sales-assisted buyers
- Track conversion sources with different `source` parameters
- Maintain demo option for enterprise buyers

---

## How to Make Changes in WordPress

### Step 1: Log into WordPress
1. Go to: https://innovareai.com/wp-admin
2. Username: `admin@innovareai.com`
3. Password: [use your WordPress password]

### Step 2: Edit SAM Page with Elementor
1. Navigate to **Pages → All Pages**
2. Find the **SAM** page (ID: 7318)
3. Click **Edit with Elementor**

### Step 3: Update Top Navigation "Let's Talk" Button
1. Click on the **top navigation section** (sticky header)
2. Find the **"Let's Talk" button**
3. Click the button to select it
4. In the left panel, find **Link** section
5. Change URL to: `https://app.meet-sam.com/signup/innovareai?source=sam-nav-cta`
6. Change button text to: **"Start Free Trial"** (optional)

### Step 4: Update Hero "Book A Demo" Button
1. Scroll to the **hero section** (large section with heading)
2. Click on the **"Book A Demo" button**
3. In the left panel, find **Link** section
4. Change URL to: `https://app.meet-sam.com/signup/innovareai?source=sam-hero-cta`
5. Change button text to: **"Start Free Trial"** (optional)

### Step 5: Add Additional CTA (Optional)
1. Find a strategic location (e.g., after "How It Works" section)
2. Drag a **Button** widget to the page
3. Configure:
   - **Text**: "Start Your Free Trial"
   - **Link**: `https://app.meet-sam.com/signup/innovareai?source=sam-section-cta`
   - **Style**: Match existing brand colors (purple gradient)
4. Click **Update** to publish

---

## Alternative: Add Signup Popup (Best UX)

Instead of changing links, trigger a popup modal:

### Benefits:
- Capture leads without navigation away
- Show value proposition in popup
- Pre-qualify with form fields
- Better conversion rates

### Implementation:
Follow instructions in: `docs/SAM_LANDING_PAGE_POPUP_INTEGRATION.md`

This adds a professional signup popup that appears when clicking any CTA button.

---

## URL Parameters for Tracking

Use these `source` parameters to track which CTA converts best:

| Button Location | Source Parameter | Full URL |
|----------------|------------------|----------|
| Top nav | `sam-nav-cta` | `https://app.meet-sam.com/signup/innovareai?source=sam-nav-cta` |
| Hero section | `sam-hero-cta` | `https://app.meet-sam.com/signup/innovareai?source=sam-hero-cta` |
| Middle section | `sam-section-cta` | `https://app.meet-sam.com/signup/innovareai?source=sam-section-cta` |
| Footer | `sam-footer-cta` | `https://app.meet-sam.com/signup/innovareai?source=sam-footer-cta` |

These parameters will show up in your signup analytics and help identify which page sections convert best.

---

## Testing Checklist

After making changes:

- [ ] Visit https://innovareai.com/sam/
- [ ] Click top navigation CTA - should redirect to signup
- [ ] Click hero section CTA - should redirect to signup
- [ ] Verify URL includes `?source=sam-...` parameter
- [ ] Complete signup flow to verify it works end-to-end
- [ ] Check analytics to confirm source tracking works

---

## Signup Page Pre-fill Integration

To make the signup experience even better, update the signup page to pre-fill user data from the popup modal.

**File to update**: `/app/signup/innovareai/page.tsx`

Add URL parameter reading logic (see `SAM_LANDING_PAGE_POPUP_INTEGRATION.md` for full code).

---

## Next Steps

1. Choose Option 1 (all signup) or Option 2 (mixed CTAs)
2. Log into WordPress and edit with Elementor
3. Update button links as specified
4. Test the flow end-to-end
5. Monitor conversion metrics by source parameter

**Estimated time**: 10-15 minutes

---

**Created**: October 6, 2025
**Page ID**: 7318
**Page URL**: https://innovareai.com/sam/
