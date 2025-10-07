# DeepAgent Instructions: Update SAM Landing Page CTAs

## Mission
Update the SAM landing page (https://innovareai.com/sam/) to change CTA buttons from Calendly demo links to direct signup links.

---

## Prerequisites

### WordPress Credentials
- **URL**: https://innovareai.com/wp-admin
- **Username**: admin@innovareai.com
- **Application Password**: AUM1a6SGg6QTmDpSuCXuujt0F231cvJb

### Target Page
- **Page Name**: SAM
- **Page ID**: 7318
- **Live URL**: https://innovareai.com/sam/
- **Editor**: Elementor

---

## Method 1: WordPress REST API (Automated)

### Step 1: Authenticate with WordPress

Use HTTP Basic Authentication with Application Password:

```bash
USERNAME="admin@innovareai.com"
APP_PASSWORD="AUM1a6SGg6QTmDpSuCXuujt0F231cvJb"
AUTH_HEADER=$(echo -n "${USERNAME}:${APP_PASSWORD}" | base64)
```

### Step 2: Fetch Current Page Data

```bash
curl -X GET "https://innovareai.com/wp-json/wp/v2/pages/7318" \
  -H "Authorization: Basic ${AUTH_HEADER}" \
  -H "Content-Type: application/json" \
  > sam-page-backup.json
```

**Expected Response**: JSON with page content, including Elementor data

### Step 3: Extract Elementor Data

Elementor page content is stored in the `content.raw` field as HTML with `data-settings` attributes.

The page structure uses Elementor widgets. Look for:
- `elementor-widget-button` class
- `href` attributes in anchor tags
- Button text in `elementor-button-text` spans

### Step 4: Identify CTA Buttons to Update

**Current CTA buttons:**

1. **Top Navigation "Let's Talk" Button**
   - Element ID: `a8ab196`
   - Current href: `https://calendly.com/innovareai/ai-agent-demo-meeting`
   - New href: `https://app.meet-sam.com/signup/innovareai?source=sam-nav-cta`

2. **Hero Section "Book A Demo" Button**
   - Element ID: `3dbcb40`
   - Current href: `https://calendly.com/innovareai/ai-agent-demo-meeting`
   - New href: `https://app.meet-sam.com/signup/innovareai?source=sam-hero-cta`

### Step 5: Update Page Content

**Find and replace these URLs in the page content:**

```javascript
// In the fetched JSON content
const content = pageData.content.raw;

// Replace Calendly links with signup links
const updatedContent = content
  .replace(
    'https://calendly.com/innovareai/ai-agent-demo-meeting',
    'https://app.meet-sam.com/signup/innovareai?source=sam-landing-page'
  );
```

### Step 6: Update Page via REST API

⚠️ **CRITICAL**: WordPress REST API may block PUT/POST requests due to security settings.

Try this request:

```bash
curl -X POST "https://innovareai.com/wp-json/wp/v2/pages/7318" \
  -H "Authorization: Basic ${AUTH_HEADER}" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "<!-- UPDATED CONTENT HERE -->"
  }'
```

**If you get 403 Forbidden**: WordPress blocks write operations via REST API. Use Method 2 instead.

---

## Method 2: Browser Automation (Selenium/Puppeteer)

This is the most reliable method since WordPress/Elementor visual editor requires browser interaction.

### Step 1: Launch Headless Browser

```javascript
const puppeteer = require('puppeteer');

const browser = await puppeteer.launch({
  headless: false, // Set to true for production
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

const page = await browser.newPage();
```

### Step 2: Navigate to WordPress Login

```javascript
await page.goto('https://innovareai.com/wp-login.php', {
  waitUntil: 'networkidle2'
});
```

### Step 3: Login to WordPress

```javascript
// Fill login form
await page.type('#user_login', 'admin@innovareai.com');
await page.type('#user_pass', 'YOUR_WORDPRESS_PASSWORD'); // NOT the app password

// Click login button
await page.click('#wp-submit');

// Wait for dashboard to load
await page.waitForNavigation({ waitUntil: 'networkidle2' });
```

⚠️ **Note**: Application passwords work for REST API but regular WordPress password is needed for browser login.

### Step 4: Navigate to Pages

```javascript
await page.goto('https://innovareai.com/wp-admin/edit.php?post_type=page', {
  waitUntil: 'networkidle2'
});
```

### Step 5: Find and Edit SAM Page

```javascript
// Find the SAM page row (ID: 7318)
const samPageLink = await page.$('tr#post-7318 .row-title');

// Hover to reveal "Edit with Elementor" link
await samPageLink.hover();

// Click "Edit with Elementor"
await page.evaluate(() => {
  document.querySelector('tr#post-7318 .elementor-edit-link').click();
});

// Wait for Elementor to load
await page.waitForTimeout(5000); // Elementor takes time to initialize
```

### Step 6: Wait for Elementor Editor to Load

```javascript
// Wait for Elementor editor panel
await page.waitForSelector('#elementor-panel', { timeout: 30000 });

// Switch to Elementor iframe
const elementorFrame = await page.frames().find(f =>
  f.name() === 'elementor-preview'
);
```

### Step 7: Locate Top Navigation Button

```javascript
// Click on the top navigation button (Element ID: a8ab196)
await elementorFrame.click('[data-id="a8ab196"]');

// Wait for settings panel to load
await page.waitForSelector('#elementor-panel-elements', { timeout: 5000 });
```

### Step 8: Update Top Navigation Button Link

```javascript
// Click on "Content" tab in Elementor panel
await page.click('#elementor-controls .elementor-panel-navigation-tab[data-tab="content"]');

// Wait for link input field
await page.waitForSelector('input[data-setting="link"]');

// Clear existing link
await page.$eval('input[data-setting="link"]', el => el.value = '');

// Enter new signup link
await page.type('input[data-setting="link"]', 'https://app.meet-sam.com/signup/innovareai?source=sam-nav-cta');

// Optional: Update button text
await page.click('input[data-setting="text"]');
await page.keyboard.selectAll();
await page.type('input[data-setting="text"]', 'Start Free Trial');
```

### Step 9: Locate Hero Section Button

```javascript
// Click on the hero section button (Element ID: 3dbcb40)
await elementorFrame.click('[data-id="3dbcb40"]');

// Wait for settings panel to update
await page.waitForTimeout(1000);
```

### Step 10: Update Hero Button Link

```javascript
// Update link field
await page.$eval('input[data-setting="link"]', el => el.value = '');
await page.type('input[data-setting="link"]', 'https://app.meet-sam.com/signup/innovareai?source=sam-hero-cta');

// Optional: Update button text
await page.click('input[data-setting="text"]');
await page.keyboard.selectAll();
await page.type('input[data-setting="text"]', 'Start Free Trial');
```

### Step 11: Publish Changes

```javascript
// Click "Update" button in Elementor panel
await page.click('#elementor-panel-saver-button-publish');

// Wait for save confirmation
await page.waitForSelector('.elementor-update-preview-button', { timeout: 10000 });

// Wait for success message
await page.waitForSelector('.dialog-message', { timeout: 5000 });

console.log('✅ Page updated successfully');
```

### Step 12: Verify Changes

```javascript
// Navigate to live page
await page.goto('https://innovareai.com/sam/', { waitUntil: 'networkidle2' });

// Check top navigation button
const navButton = await page.$eval('a.elementor-button[href*="signup"]', el => ({
  href: el.href,
  text: el.textContent.trim()
}));

console.log('Top nav button:', navButton);

// Check hero button
const heroButton = await page.$$eval('a.elementor-button[href*="signup"]', els =>
  els.map(el => ({
    href: el.href,
    text: el.textContent.trim()
  }))
);

console.log('Hero button:', heroButton);
```

### Step 13: Close Browser

```javascript
await browser.close();
```

---

## Method 3: Direct Database Update (Advanced)

⚠️ **USE WITH EXTREME CAUTION** - Direct database manipulation can break WordPress.

### Step 1: Connect to WordPress Database

You'll need database credentials (host, username, password, database name).

These are typically in `wp-config.php` file on the server.

### Step 2: Locate Page Content

```sql
SELECT ID, post_title, post_content
FROM wp_posts
WHERE ID = 7318;
```

### Step 3: Update Content

```sql
UPDATE wp_posts
SET post_content = REPLACE(
  post_content,
  'https://calendly.com/innovareai/ai-agent-demo-meeting',
  'https://app.meet-sam.com/signup/innovareai?source=sam-landing-page'
)
WHERE ID = 7318;
```

### Step 4: Clear WordPress Cache

After direct database updates, you must clear caches:

```bash
# Via WP-CLI (if available)
wp cache flush

# Or delete cache files
rm -rf /path/to/wordpress/wp-content/cache/*
```

---

## Method 4: WordPress Plugin API

If you can install a custom plugin, you can programmatically update Elementor data.

### Step 1: Create Custom Plugin

Create file: `/wp-content/plugins/sam-cta-updater/sam-cta-updater.php`

```php
<?php
/**
 * Plugin Name: SAM CTA Updater
 * Description: Updates SAM landing page CTAs programmatically
 * Version: 1.0.0
 */

function update_sam_page_ctas() {
    $page_id = 7318;

    // Get current content
    $content = get_post_field('post_content', $page_id);

    // Replace Calendly links with signup links
    $updated_content = str_replace(
        'https://calendly.com/innovareai/ai-agent-demo-meeting',
        'https://app.meet-sam.com/signup/innovareai?source=sam-landing-page',
        $content
    );

    // Update the page
    wp_update_post([
        'ID' => $page_id,
        'post_content' => $updated_content
    ]);

    // Clear Elementor cache
    if (class_exists('Elementor\Plugin')) {
        \Elementor\Plugin::$instance->files_manager->clear_cache();
    }

    echo 'SAM page CTAs updated successfully!';
}

// Run the update
add_action('admin_init', 'update_sam_page_ctas');
```

### Step 2: Activate Plugin

Upload to server and activate via:
- WordPress admin → Plugins → SAM CTA Updater → Activate
- Or via WP-CLI: `wp plugin activate sam-cta-updater`

---

## Recommended Approach for DeepAgent

**Use Method 2 (Browser Automation)** because:

1. ✅ Elementor requires visual editor interaction
2. ✅ Works regardless of REST API restrictions
3. ✅ Handles Elementor's JavaScript-heavy interface
4. ✅ Can verify changes visually
5. ✅ No server access needed (only WordPress login)

**Required Tools:**
- Puppeteer or Selenium
- WordPress admin password (not just application password)
- Ability to handle iframes and dynamic content

---

## Complete Puppeteer Script

```javascript
const puppeteer = require('puppeteer');

async function updateSamPageCTAs() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();

  try {
    // Login
    console.log('1. Logging into WordPress...');
    await page.goto('https://innovareai.com/wp-login.php');
    await page.type('#user_login', 'admin@innovareai.com');
    await page.type('#user_pass', 'YOUR_WP_PASSWORD'); // NOT app password
    await page.click('#wp-submit');
    await page.waitForNavigation();

    // Navigate to SAM page in Elementor
    console.log('2. Opening Elementor editor...');
    await page.goto('https://innovareai.com/wp-admin/post.php?post=7318&action=elementor');
    await page.waitForTimeout(10000); // Wait for Elementor to load

    // Get Elementor iframe
    const frames = page.frames();
    const elementorFrame = frames.find(f => f.name() === 'elementor-preview');

    // Update top nav button
    console.log('3. Updating top navigation button...');
    await elementorFrame.click('[data-id="a8ab196"]');
    await page.waitForTimeout(2000);
    await page.$eval('input[data-setting="link"]', el => el.value = '');
    await page.type('input[data-setting="link"]',
      'https://app.meet-sam.com/signup/innovareai?source=sam-nav-cta');

    // Update hero button
    console.log('4. Updating hero section button...');
    await elementorFrame.click('[data-id="3dbcb40"]');
    await page.waitForTimeout(2000);
    await page.$eval('input[data-setting="link"]', el => el.value = '');
    await page.type('input[data-setting="link"]',
      'https://app.meet-sam.com/signup/innovareai?source=sam-hero-cta');

    // Publish
    console.log('5. Publishing changes...');
    await page.click('#elementor-panel-saver-button-publish');
    await page.waitForTimeout(5000);

    console.log('✅ Successfully updated SAM page CTAs!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

updateSamPageCTAs();
```

---

## Security Notes

- ⚠️ Application passwords only work for REST API, NOT browser login
- ⚠️ Store WordPress admin password securely
- ⚠️ Use headless mode in production
- ⚠️ Clear browser session after completion
- ⚠️ Log all actions for audit trail

---

## Validation Steps

After making changes, verify:

1. Visit https://innovareai.com/sam/
2. Check top nav button links to signup
3. Check hero button links to signup
4. Verify URL includes `?source=sam-...` parameter
5. Test signup flow end-to-end

---

**Created**: October 6, 2025
**Target**: SAM landing page (ID: 7318)
**Recommended Method**: Browser Automation (Puppeteer)
**Estimated Time**: 2-5 minutes (automated)
