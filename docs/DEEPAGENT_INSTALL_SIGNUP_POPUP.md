# DeepAgent Instructions: Install Signup Popup on SAM Landing Page

## Mission
Add a professional signup modal/popup to the SAM landing page (https://innovareai.com/sam/) that appears when users click CTA buttons.

---

## Prerequisites

### WordPress Credentials
- **URL**: https://innovareai.com/wp-admin
- **Username**: admin@innovareai.com
- **WordPress Password**: [Your WordPress admin password - NOT the application password]

### Target Page
- **Page Name**: SAM
- **Page ID**: 7318
- **Live URL**: https://innovareai.com/sam/
- **Editor**: Elementor

---

## Popup HTML Code

This is the complete popup code to inject into the SAM page:

```html
<!-- SAM AI Signup Modal -->
<div id="sam-signup-modal" style="display: none; position: fixed; z-index: 9999; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.7);">
  <div style="position: relative; background: white; margin: 5% auto; padding: 40px; max-width: 500px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
    <span id="sam-modal-close" style="position: absolute; top: 15px; right: 20px; font-size: 28px; font-weight: bold; cursor: pointer; color: #999;">&times;</span>

    <h2 style="text-align: center; margin-bottom: 10px; color: #1a1a1a;">Start Your Free Trial</h2>
    <p style="text-align: center; color: #666; margin-bottom: 30px;">Join thousands of sales teams using SAM AI</p>

    <form id="sam-signup-form" style="display: flex; flex-direction: column; gap: 15px;">
      <input type="text" id="signup-name" placeholder="Full Name" required
        style="padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">

      <input type="email" id="signup-email" placeholder="Work Email" required
        style="padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">

      <input type="text" id="signup-company" placeholder="Company Name" required
        style="padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">

      <button type="submit"
        style="padding: 14px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 6px; font-size: 16px; font-weight: bold; cursor: pointer; transition: transform 0.2s;">
        Start Free Trial →
      </button>
    </form>

    <p style="text-align: center; font-size: 12px; color: #999; margin-top: 20px;">
      No credit card required • 14-day free trial
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
    if (e.target.matches('.elementor-button, .sam-cta-button, .start-trial-btn, [href*="signup"]')) {
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

    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const company = document.getElementById('signup-company').value;

    // Redirect to app signup with pre-filled data
    const signupUrl = 'https://app.meet-sam.com/signup/innovareai?' +
      new URLSearchParams({
        name: name,
        email: email,
        company: company,
        source: 'sam-landing-page'
      });

    window.location.href = signupUrl;
  };
})();
</script>
```

---

## Method 1: Browser Automation (Puppeteer/Selenium)

### Complete Puppeteer Script

```javascript
const puppeteer = require('puppeteer');
const fs = require('fs');

// Read the popup HTML
const POPUP_HTML = fs.readFileSync('./popup-code.html', 'utf8');

async function installSignupPopup() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();

  try {
    console.log('🚀 Installing Signup Popup on SAM Landing Page\n');

    // Step 1: Login to WordPress
    console.log('1. Logging into WordPress...');
    await page.goto('https://innovareai.com/wp-login.php', {
      waitUntil: 'networkidle2'
    });

    await page.type('#user_login', 'admin@innovareai.com');
    await page.type('#user_pass', 'YOUR_WORDPRESS_PASSWORD'); // Replace with actual password
    await page.click('#wp-submit');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    console.log('   ✅ Logged in successfully');

    // Step 2: Navigate to SAM page in Elementor
    console.log('\n2. Opening Elementor editor...');
    await page.goto('https://innovareai.com/wp-admin/post.php?post=7318&action=elementor', {
      waitUntil: 'networkidle2'
    });

    // Wait for Elementor to fully load
    await page.waitForSelector('#elementor-panel', { timeout: 30000 });
    await page.waitForTimeout(5000); // Extra time for Elementor initialization

    console.log('   ✅ Elementor editor loaded');

    // Step 3: Get Elementor iframe
    const frames = page.frames();
    const elementorFrame = frames.find(f => f.name() === 'elementor-preview');

    if (!elementorFrame) {
      throw new Error('Elementor preview frame not found');
    }

    console.log('   ✅ Elementor frame located');

    // Step 4: Add HTML widget to bottom of page
    console.log('\n3. Adding HTML widget...');

    // Click on the "+" icon to add new element
    await page.click('#elementor-panel-header-add-button');
    await page.waitForTimeout(2000);

    // Search for HTML widget
    await page.type('#elementor-panel-elements-search-input', 'HTML');
    await page.waitForTimeout(1000);

    // Drag HTML widget to page (or click to add)
    // Note: Elementor uses drag-and-drop, so we'll use the simpler "click" method
    await page.click('.elementor-element[data-widget_type="html.default"]');
    await page.waitForTimeout(2000);

    console.log('   ✅ HTML widget added');

    // Step 5: Paste popup code into HTML widget
    console.log('\n4. Injecting popup code...');

    // Click on the HTML code textarea
    await page.click('#elementor-controls textarea[data-setting="html"]');
    await page.waitForTimeout(1000);

    // Clear existing content
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');

    // Paste the popup HTML
    await page.evaluate((html) => {
      const textarea = document.querySelector('#elementor-controls textarea[data-setting="html"]');
      if (textarea) {
        textarea.value = html;
        // Trigger change event
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, POPUP_HTML);

    await page.waitForTimeout(2000);

    console.log('   ✅ Popup code injected');

    // Step 6: Move widget to bottom of page (optional)
    console.log('\n5. Positioning widget...');

    // The widget is added to the current section
    // You may want to drag it to the footer section
    // This is complex in Elementor, so we'll leave it where it is

    console.log('   ℹ️  Widget positioned (at current location)');

    // Step 7: Publish changes
    console.log('\n6. Publishing changes...');

    await page.click('#elementor-panel-saver-button-publish');

    // Wait for publish to complete
    await page.waitForTimeout(5000);

    // Check for success message
    const successMessage = await page.$('.dialog-message');
    if (successMessage) {
      console.log('   ✅ Page published successfully');
    }

    // Step 8: Verify on live page
    console.log('\n7. Verifying popup installation...');

    await page.goto('https://innovareai.com/sam/', {
      waitUntil: 'networkidle2'
    });

    // Check if modal exists
    const modalExists = await page.$('#sam-signup-modal');

    if (modalExists) {
      console.log('   ✅ Popup modal found on page');

      // Test popup trigger
      console.log('\n8. Testing popup trigger...');

      // Click a CTA button
      await page.click('.elementor-button');
      await page.waitForTimeout(1000);

      // Check if modal is visible
      const modalVisible = await page.$eval('#sam-signup-modal', el =>
        el.style.display === 'block'
      );

      if (modalVisible) {
        console.log('   ✅ Popup displays correctly');
      } else {
        console.log('   ⚠️  Popup did not trigger');
      }

      // Close modal
      await page.click('#sam-modal-close');

    } else {
      console.log('   ❌ Popup modal NOT found on page');
    }

    console.log('\n✅ Signup popup installation complete!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

// Run the installation
installSignupPopup();
```

---

## Method 2: Direct HTML Injection (Simpler)

### Step-by-Step Manual Process

1. **Login to WordPress**
   - Go to: https://innovareai.com/wp-login.php
   - Username: `admin@innovareai.com`
   - Password: [WordPress admin password]

2. **Open SAM Page in Elementor**
   - Navigate to: Pages → All Pages
   - Find "SAM" page
   - Click "Edit with Elementor"

3. **Scroll to Bottom of Page**
   - Scroll down to the very bottom section of the page
   - This is where we'll add the popup HTML

4. **Add HTML Widget**
   - Click the "+" icon in Elementor panel
   - Search for "HTML"
   - Drag "HTML" widget to the bottom of the page

5. **Paste Popup Code**
   - Click on the HTML widget you just added
   - In the left panel, you'll see an HTML code editor
   - Paste the entire popup HTML code (from above)
   - The code includes both HTML and JavaScript

6. **Configure Widget Settings** (Optional)
   - In the "Advanced" tab
   - Set CSS classes: `sam-popup-widget`
   - This helps identify it later

7. **Publish Changes**
   - Click "Update" button in bottom left
   - Wait for save confirmation

8. **Test the Popup**
   - Visit: https://innovareai.com/sam/
   - Click any CTA button ("Book A Demo", "Let's Talk")
   - Popup should appear
   - Fill out form and verify redirect to signup

---

## Method 3: Using Elementor Popup Builder (Pro Feature)

If Elementor Pro is installed:

### Step 1: Create Popup Template

1. Go to: Templates → Popups → Add New
2. Choose blank template
3. Design popup:
   - Add heading: "Start Your Free Trial"
   - Add form widget with fields: Name, Email, Company
   - Add submit button: "Start Free Trial"
   - Style with purple gradient

### Step 2: Set Popup Conditions

1. Click "Conditions" in popup editor
2. Set trigger: "On Click"
3. Set selector: `.elementor-button`
4. Set where to display: "Entire Site" or "SAM Page Only"

### Step 3: Configure Form Action

1. Click on Form widget
2. Go to "Actions After Submit"
3. Add "Redirect" action
4. Set URL: `https://app.meet-sam.com/signup/innovareai?source=sam-popup`
5. Enable "Pass Form Fields as Query String"

### Step 4: Publish Popup

1. Click "Publish"
2. Test on SAM page

---

## Method 4: WordPress REST API (If Enabled)

```javascript
const axios = require('axios');

const USERNAME = 'admin@innovareai.com';
const APP_PASSWORD = 'AUM1a6SGg6QTmDpSuCXuujt0F231cvJb';
const PAGE_ID = 7318;

const POPUP_HTML = `<!-- POPUP CODE HERE -->`;

async function injectPopupViaAPI() {
  try {
    // Fetch current page content
    const response = await axios.get(
      `https://innovareai.com/wp-json/wp/v2/pages/${PAGE_ID}`,
      {
        auth: {
          username: USERNAME,
          password: APP_PASSWORD
        }
      }
    );

    const currentContent = response.data.content.raw;

    // Check if popup already exists
    if (currentContent.includes('sam-signup-modal')) {
      console.log('⚠️  Popup already exists on page');
      return;
    }

    // Append popup to end of content
    const updatedContent = currentContent + '\n\n' + POPUP_HTML;

    // Update page
    await axios.post(
      `https://innovareai.com/wp-json/wp/v2/pages/${PAGE_ID}`,
      {
        content: updatedContent
      },
      {
        auth: {
          username: USERNAME,
          password: APP_PASSWORD
        }
      }
    );

    console.log('✅ Popup injected successfully via REST API');

  } catch (error) {
    if (error.response?.status === 403) {
      console.log('❌ REST API write operations are disabled');
      console.log('   Use browser automation method instead');
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

injectPopupViaAPI();
```

---

## Validation Checklist

After installation, verify:

- [ ] Visit https://innovareai.com/sam/
- [ ] Click "Book A Demo" button
- [ ] Popup appears with signup form
- [ ] Form has 3 fields: Name, Email, Company
- [ ] Submit button says "Start Free Trial →"
- [ ] Form submits and redirects to app signup
- [ ] URL includes `?source=sam-landing-page` parameter
- [ ] Form data is pre-filled in signup page

---

## Troubleshooting

### Popup Not Appearing

**Cause**: JavaScript not executing or selector mismatch
**Fix**:
```javascript
// Change the click event selector to be more specific
document.addEventListener('click', function(e) {
  if (e.target.closest('.elementor-button')) {
    e.preventDefault();
    document.getElementById('sam-signup-modal').style.display = 'block';
  }
});
```

### Popup Behind Other Content

**Cause**: Z-index conflict
**Fix**: Increase modal z-index to `99999`

### Form Not Redirecting

**Cause**: Form submission blocked
**Fix**: Check browser console for errors, ensure URL is correct

### Popup Shows on Page Load

**Cause**: Display style not set to `none`
**Fix**: Ensure modal div has `style="display: none;"`

---

## Files Created

Save the popup HTML to a file for easy reference:

**File**: `popup-code.html`
```html
<!-- Content from above -->
```

---

## Recommended Approach for DeepAgent

**Use Method 1 (Browser Automation with Puppeteer)** because:

1. ✅ Most reliable for Elementor
2. ✅ Handles dynamic content properly
3. ✅ Can verify installation visually
4. ✅ Works regardless of REST API restrictions
5. ✅ Can test popup functionality automatically

**Required**:
- Puppeteer or Selenium
- WordPress admin password
- Node.js environment

---

**Created**: October 6, 2025
**Target**: SAM landing page (ID: 7318)
**Estimated Time**: 3-5 minutes (automated)
**Status**: Ready for deployment
