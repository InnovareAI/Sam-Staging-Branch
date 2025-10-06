# SAM Landing Page Signup Popup Integration

## Overview

This guide shows how to add a professional signup popup modal to the SAM landing page at https://innovareai.com/sam/

## Integration Method

Since WordPress REST API write operations are disabled (security restriction), use **Elementor's visual editor** to add the popup.

---

## Step 1: Access Elementor Editor

1. Log in to WordPress: https://innovareai.com/wp-admin
2. Navigate to **Pages → All Pages**
3. Find the **SAM** page
4. Click **Edit with Elementor**

---

## Step 2: Add Popup HTML

### Option A: Using Elementor Popup Builder (Recommended)

1. In Elementor, click **Templates → Popups**
2. Click **Add New Popup**
3. Choose a template or start from scratch
4. Design the popup with these elements:
   - **Heading**: "Start Your Free Trial"
   - **Subheading**: "Join thousands of sales teams using SAM AI"
   - **Form fields**:
     - First Name (text)
     - Last Name (text)
     - Work Email (email)
     - Password (password, min 8 characters)
     - Company Name (text)
     - Company Website (url) - *We'll analyze your website to understand your business*
   - **Submit button**: "Continue to Plan Selection"
   - **Footer text**: "No credit card charge until trial ends"

5. Set popup conditions:
   - **Trigger**: On click
   - **Selector**: `.sam-cta-button, .start-trial-btn, [href*="signup"]`

6. Set form action:
   ```
   https://app.meet-sam.com/signup/innovareai
   ```

7. Publish the popup

### Option B: Using HTML Widget (Direct Integration)

1. In Elementor editor, drag an **HTML** widget to the bottom of the page
2. Paste the following code:

```html
<!-- SAM AI Signup Modal -->
<div id="sam-signup-modal" style="display: none; position: fixed; z-index: 9999; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.7);">
  <div style="position: relative; background: white; margin: 5% auto; padding: 40px; max-width: 500px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
    <span id="sam-modal-close" style="position: absolute; top: 15px; right: 20px; font-size: 28px; font-weight: bold; cursor: pointer; color: #999;">&times;</span>

    <h2 style="text-align: center; margin-bottom: 10px; color: #1a1a1a;">Start Your 14-Day Trial</h2>
    <p style="text-align: center; color: #666; margin-bottom: 30px;">No credit card charge until trial ends</p>

    <form id="sam-signup-form" style="display: flex; flex-direction: column; gap: 15px;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        <input type="text" id="signup-firstname" placeholder="First name" required
          style="padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">

        <input type="text" id="signup-lastname" placeholder="Last name" required
          style="padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
      </div>

      <input type="email" id="signup-email" placeholder="you@company.com" required
        style="padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">

      <input type="password" id="signup-password" placeholder="Create a password (min 8 characters)" required minlength="8"
        style="padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">

      <input type="text" id="signup-company" placeholder="Company name" required
        style="padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">

      <div>
        <input type="url" id="signup-website" placeholder="Company website (e.g., yourcompany.com)" required
          style="padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; width: 100%;">
        <p style="font-size: 11px; color: #666; margin-top: 4px;">We'll analyze your website to understand your business</p>
      </div>

      <button type="submit"
        style="padding: 14px; background: #8907FF; color: white; border: none; border-radius: 6px; font-size: 16px; font-weight: bold; cursor: pointer; transition: transform 0.2s;">
        Continue to Plan Selection
      </button>
    </form>

    <p style="text-align: center; font-size: 11px; color: #666; margin-top: 20px;">
      By signing up, you agree to our <a href="https://innovareai.com/terms-of-service/" style="color: #8907FF;">Terms of Service</a> and <a href="https://innovareai.com/privacy-policy/" style="color: #8907FF;">Privacy Policy</a>
    </p>
  </div>
</div>

<script>
(function() {
  const modal = document.getElementById('sam-signup-modal');
  const closeBtn = document.getElementById('sam-modal-close');
  const form = document.getElementById('sam-signup-form');

  // Show modal on CTA button click
  document.addEventListener('click', function(e) {
    if (e.target.matches('.sam-cta-button, .start-trial-btn, [href*="signup"]')) {
      e.preventDefault();
      modal.style.display = 'block';
    }
  });

  // Close modal
  closeBtn.onclick = function() {
    modal.style.display = 'none';
  };

  window.onclick = function(event) {
    if (event.target == modal) {
      modal.style.display = 'none';
    }
  };

  // Handle form submission
  form.onsubmit = async function(e) {
    e.preventDefault();

    const firstName = document.getElementById('signup-firstname').value;
    const lastName = document.getElementById('signup-lastname').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const company = document.getElementById('signup-company').value;
    const website = document.getElementById('signup-website').value;

    // Note: Since the actual signup form is now iframe-based,
    // this standalone HTML version is only for reference.
    // The real popup uses embed.js which loads the full signup page.

    // Redirect to app signup with pre-filled data
    const signupUrl = 'https://app.meet-sam.com/signup/innovareai?' +
      new URLSearchParams({
        firstName: firstName,
        lastName: lastName,
        email: email,
        companyName: company,
        companyWebsite: website,
        source: 'sam-landing-page'
      });

    window.location.href = signupUrl;
  };
})();
</script>

<!-- NOTE: The current production popup uses embed.js (iframe-based).
     The form fields above are already implemented in EmailSignupForm.tsx.
     This HTML version is kept for reference and standalone implementations. -->
```

3. Click **Update** to save

---

## Step 3: Add CTA Button Classes

To trigger the popup, ensure your CTA buttons have one of these classes:

1. Find your main CTA button in Elementor
2. Click **Advanced → CSS Classes**
3. Add: `sam-cta-button`

Or add to existing buttons:
```html
<a href="#" class="start-trial-btn">Start Free Trial</a>
```

---

## Step 4: Update Signup Page to Accept Parameters

The app's signup page needs to read URL parameters and pre-fill the form.

**File**: `/app/signup/innovareai/page.tsx`

Add this code to pre-fill form fields from URL parameters:

```typescript
'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function InnovareAISignup() {
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    source: ''
  });

  useEffect(() => {
    // Pre-fill form from URL parameters
    setFormData({
      name: searchParams.get('name') || '',
      email: searchParams.get('email') || '',
      company: searchParams.get('company') || '',
      source: searchParams.get('source') || 'direct'
    });
  }, [searchParams]);

  // Rest of signup component...
}
```

---

## Step 5: Alternative Script (If Popup Still Not Working)

If the basic script doesn't work, try this more robust version with event delegation and debugging:

```html
<!-- SAM Signup Popup - Enhanced Version -->
<script src="https://app.meet-sam.com/signup/embed.js"></script>

<script>
(function() {
  console.log('SAM Popup Script Loading...');

  // Wait for embed.js to load
  function waitForSAMSignup() {
    if (typeof SAMSignup !== 'undefined') {
      console.log('✅ SAMSignup loaded successfully');
      attachPopupHandlers();
    } else {
      console.log('⏳ Waiting for SAMSignup...');
      setTimeout(waitForSAMSignup, 100);
    }
  }

  function attachPopupHandlers() {
    // Use event delegation to catch clicks even on dynamically added buttons
    document.addEventListener('click', function(e) {
      // Check if clicked element or any parent has the popup link
      const target = e.target.closest('a[href="#open-sam-popup"], a[href*="signup"], .sam-cta-button, .start-trial-btn');

      if (target) {
        console.log('🎯 Popup trigger clicked:', target);
        e.preventDefault();
        e.stopPropagation();

        try {
          SAMSignup.open();
          console.log('✅ Popup opened');
        } catch (error) {
          console.error('❌ Failed to open popup:', error);
        }

        return false;
      }
    }, true); // Use capture phase to catch event early

    console.log('✅ Popup handlers attached');
  }

  // Start initialization
  waitForSAMSignup();

  // Also expose global function for manual testing
  window.openSAMPopup = function() {
    console.log('🔧 Manual popup trigger');
    SAMSignup.open();
  };
})();
</script>

<!-- Test button (remove after testing) -->
<button onclick="openSAMPopup()" style="position:fixed;bottom:20px;right:20px;z-index:9999;padding:10px;background:red;color:white;">
  TEST POPUP
</button>
```

**Debugging Steps:**
1. Add the enhanced script to WordPress (Elementor HTML widget)
2. Visit the page and open browser console (F12)
3. Look for console messages:
   - "SAM Popup Script Loading..." = Script started
   - "✅ SAMSignup loaded successfully" = embed.js loaded
   - "✅ Popup handlers attached" = Click handlers ready
   - "🎯 Popup trigger clicked" = Button was clicked
   - "✅ Popup opened" = Popup displayed
4. If you see errors, share the console output
5. Try clicking the red TEST POPUP button (bottom-right corner) to verify SAMSignup.open() works

## Step 6: Test the Integration

1. Visit https://innovareai.com/sam/
2. Click any "Start Free Trial" or signup button
3. Verify popup appears
4. Fill out the form
5. Verify redirect to https://app.meet-sam.com/signup/innovareai
6. Check that form data is pre-filled

---

## Troubleshooting

### Popup Not Showing

**Cause**: Button doesn't have correct class
**Fix**: Add `sam-cta-button` class to your CTA buttons

### Form Submission Redirects to Wrong URL

**Cause**: Form action URL is incorrect
**Fix**: Ensure redirect URL is `https://app.meet-sam.com/signup/innovareai`

### Popup Appears Behind Content

**Cause**: Z-index conflict
**Fix**: Increase modal z-index to `99999` in the style attribute

### Pre-fill Data Not Working

**Cause**: Signup page isn't reading URL parameters
**Fix**: Update `/app/signup/innovareai/page.tsx` with code from Step 4

---

## Alternative: WordPress Plugin

If you prefer a plugin-based solution:

1. Install **Popup Maker** or **Elementor Pro** (has advanced popup features)
2. Create a new popup
3. Add form fields
4. Set trigger conditions
5. Configure redirect to app signup

---

## WordPress Credentials

- **URL**: https://innovareai.com/wp-admin
- **Username**: admin@innovareai.com
- **Application Password**: AUM1a6SGg6QTmDpSuCXuujt0F231cvJb

---

## Current Status

✅ **Signup Form Updated** - EmailSignupForm.tsx now includes:
- First Name + Last Name
- Email + Password
- Company Name (mandatory)
- Company Website (mandatory) - triggers website intelligence analysis

✅ **Website Intelligence System** - Automatically:
- Analyzes company website during signup
- Extracts business intelligence (industry, value prop, personas, pain points, competitors, pricing)
- Pre-populates Knowledge Base
- Marks entries as `needs-validation` for SAM to confirm conversationally

✅ **Backend Integration** - Signup API route:
- Accepts company name and website
- Triggers background website analysis
- Stores in workspace table

✅ **SAM Conversational Validation** - SAM will:
- Detect auto-extracted items in KB
- Proactively validate them during discovery interview
- Ask conversational questions like: "I saw on your site you're in cybersecurity. Are you going after new markets?"

## What's Already Working

The **InnovareAI website popup already has these new fields** because:
1. The popup uses `embed.js` which loads an iframe
2. The iframe loads `/signup/innovareai`
3. That page uses `EmailSignupForm.tsx` (already updated)

**No WordPress changes needed!** The popup automatically reflects the updated form.

## Optional: Update Standalone HTML Version

If you want to update the standalone HTML popup (Option B above):
1. Replace the form fields with the updated version in this doc
2. Update the JavaScript to pass all 6 fields
3. The iframe-based version (currently in production) is already working

---

**Created**: October 6, 2025
**Updated**: October 6, 2025
**Status**: ✅ Implemented and Working
**Website Intelligence**: Active
