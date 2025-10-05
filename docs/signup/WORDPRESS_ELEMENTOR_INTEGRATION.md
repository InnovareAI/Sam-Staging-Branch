# WordPress/Elementor Integration Guide

## InnovareAI Signup Modal Integration

This guide explains how to integrate the SAM AI signup flow into your WordPress/Elementor landing page at innovareai.com/sam.

---

## Quick Start

### Option 1: Modal Overlay (Recommended)

Add this code to your WordPress page (Custom HTML widget or Code Embed in Elementor):

```html
<!-- Load the SAM Signup modal script -->
<script src="https://app.meet-sam.com/signup/embed.js"></script>

<!-- Add a button to trigger signup -->
<button
  onclick="SAMSignup.open()"
  class="sam-cta-button"
  style="
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 16px 32px;
    font-size: 18px;
    font-weight: 600;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    transition: all 0.3s;
  "
  onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(102, 126, 234, 0.5)';"
  onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(102, 126, 234, 0.4)';"
>
  Start Your 14-Day Free Trial →
</button>
```

**Why this is recommended:**
- Better conversion rates (users stay on your landing page)
- Smooth modal overlay experience
- Avoids conflicts with 3cubed's invite-based onboarding
- Automatic redirect to workspace after signup completion

---

### Option 2: Iframe Embed

If you prefer an inline embedded signup form:

```html
<div style="width: 100%; max-width: 800px; margin: 0 auto;">
  <iframe
    src="https://app.meet-sam.com/signup/innovareai"
    style="width: 100%; height: 800px; border: none; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);"
    title="SAM AI Signup"
  ></iframe>
</div>
```

**Use case:**
- Dedicated signup page (not landing page)
- Full-page signup experience
- Works on any WordPress page

---

### Option 3: Direct Link (Fallback)

Simple link that opens signup in a new tab:

```html
<a
  href="https://app.meet-sam.com/signup/innovareai"
  target="_blank"
  class="sam-cta-button"
  style="
    display: inline-block;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 16px 32px;
    font-size: 18px;
    font-weight: 600;
    text-decoration: none;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  "
>
  Start Your 14-Day Free Trial →
</a>
```

---

## Elementor-Specific Instructions

### Method 1: Using Code Embed Widget

1. **Add Code Embed Widget**
   - Drag "Code Embed" widget from Elementor sidebar
   - Paste the modal script + button code (Option 1 above)
   - Click "Apply"

2. **Customize Button Styling**
   - Use Elementor's visual editor to adjust button appearance
   - Or keep the inline styles provided above

### Method 2: Using Custom HTML Widget

1. **Add HTML Widget**
   - Drag "HTML" widget to your desired section
   - Paste the modal integration code
   - Update and publish

### Method 3: Using Button Widget + Custom Code

1. **Add Button Widget**
   - Set button text: "Start Your 14-Day Free Trial"
   - Set button link: `#` (placeholder)
   - Add custom CSS class: `sam-signup-trigger`

2. **Add Custom Code to Page**
   - In Elementor > Settings > Custom Code
   - Add this JavaScript:

```html
<script src="https://app.meet-sam.com/signup/embed.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.sam-signup-trigger').forEach(function(button) {
      button.addEventListener('click', function(e) {
        e.preventDefault();
        SAMSignup.open();
      });
    });
  });
</script>
```

---

## Signup Flow

Once the modal opens, users go through these steps:

1. **Email Signup** → Create account with email + password
2. **Plan Selection** → Choose Per Seat ($99/seat) or SME ($499/month)
3. **Payment Setup** → Add payment method (Stripe - no charge during trial)
4. **Redirect** → Automatically redirected to `https://app.meet-sam.com/workspace/[workspaceId]`

**Timeline:**
- Day 0: Trial starts (14 days free)
- Day 14: Auto-charge payment method
- Day 44: EU customers must sign DPA (30-day grace period from first charge)

---

## Modal Features

### Auto-Close on Completion
The modal automatically closes and redirects to the workspace when signup is complete.

### Close Button
Users can close the modal by:
- Clicking the X button in top-right
- Clicking outside the modal overlay
- Pressing ESC key

### Security
- Modal listens for secure postMessage from iframe
- Only accepts messages from `https://app.meet-sam.com` origin
- Prevents XSS attacks

---

## Customization

### Change Modal Appearance

Edit `/public/signup/embed.js` to customize:

```javascript
// Modal overlay background
this.modal.style.cssText = `
  background: rgba(0, 0, 0, 0.6);  // Change opacity here
  ...
`;

// Container styling
container.style.cssText = `
  max-width: 800px;        // Change modal width
  max-height: 900px;       // Change modal height
  border-radius: 12px;     // Change border radius
  ...
`;
```

### Auto-Open on Page Load

To automatically open the modal when the page loads:

```html
<script src="https://app.meet-sam.com/signup/embed.js"></script>
<script>
  window.addEventListener('load', function() {
    // Auto-open after 2 seconds
    setTimeout(function() {
      SAMSignup.open();
    }, 2000);
  });
</script>
```

### Open on Exit Intent

Trigger modal when user is about to leave:

```html
<script src="https://app.meet-sam.com/signup/embed.js"></script>
<script>
  let modalOpened = false;
  document.addEventListener('mouseout', function(e) {
    if (!modalOpened && e.clientY < 0) {
      SAMSignup.open();
      modalOpened = true;
    }
  });
</script>
```

---

## Tracking & Analytics

### Track Modal Opens

```javascript
<script>
  // Override the open function to track
  const originalOpen = SAMSignup.open;
  SAMSignup.open = function() {
    // Send to Google Analytics
    gtag('event', 'signup_modal_opened', {
      'event_category': 'signup',
      'event_label': 'InnovareAI Signup Modal'
    });

    // Call original function
    originalOpen.call(this);
  };
</script>
```

### Track Signup Completion

The modal automatically sends a completion message. Listen for it:

```javascript
<script>
  window.addEventListener('message', function(event) {
    if (event.origin !== 'https://app.meet-sam.com') return;

    if (event.data.type === 'SAM_SIGNUP_COMPLETE') {
      // Track conversion
      gtag('event', 'signup_completed', {
        'event_category': 'conversion',
        'value': 99  // Plan amount
      });

      // Facebook Pixel
      fbq('track', 'CompleteRegistration', {
        value: 99,
        currency: 'USD'
      });
    }
  });
</script>
```

---

## Testing

### Test in Staging

Before deploying to production, test with staging environment:

```html
<!-- Development/Staging -->
<script src="https://devin-next-gen-staging.netlify.app/signup/embed.js"></script>
```

### Test Payment Flow

Use Stripe test cards:
- **Success:** 4242 4242 4242 4242
- **Decline:** 4000 0000 0000 0002
- **3D Secure:** 4000 0025 0000 3155

---

## Troubleshooting

### Modal doesn't open

**Check:**
1. Is the script loaded? View page source and verify `<script src="https://app.meet-sam.com/signup/embed.js">`
2. Console errors? Open browser DevTools (F12) and check Console tab
3. Is `SAMSignup` defined? Type `SAMSignup` in console - should return an object

### Iframe not loading

**Check:**
1. X-Frame-Options headers (should allow iframe embedding)
2. Network tab in DevTools - verify iframe URL loads successfully
3. CORS issues - check for any CORS errors in console

### Redirect not working after signup

**Check:**
1. postMessage listener is working (check `/components/signup/SignupFlow.tsx`)
2. Workspace ID is being passed correctly
3. Browser is not blocking the redirect (pop-up blocker)

---

## Support

For issues or questions:

1. **Check logs:** Browser DevTools Console tab
2. **Test locally:** Download embed.js and test modifications locally
3. **Contact support:** Include browser version, error messages, and screenshots

---

## Files Reference

- **Embed script:** `/public/signup/embed.js`
- **Signup page:** `/app/signup/innovareai/page.tsx`
- **Signup flow component:** `/components/signup/SignupFlow.tsx`
- **Plan selector:** `/components/signup/PlanSelector.tsx`
- **Stripe payment:** `/components/signup/StripePaymentSetup.tsx`

---

**Last Updated:** 2025-10-06
**Status:** Production Ready
**Tested Platforms:** WordPress 6.x, Elementor 3.x, Chrome, Firefox, Safari
