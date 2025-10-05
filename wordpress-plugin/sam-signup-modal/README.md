# SAM AI Signup Modal - WordPress Plugin

WordPress plugin for InnovareAI landing page to add SAM AI signup modal functionality.

## Features

- ✅ Auto-loads signup modal script on SAM landing page
- ✅ Shortcode support: `[sam_signup_button]`
- ✅ Elementor widget with visual controls
- ✅ Customizable button styling
- ✅ Mobile responsive

## Installation via SSH (10Web)

### Step 1: Connect to 10Web via SSH

```bash
ssh sftp_live_sLxM0@34.136.237.175 -p 55031
# Password: 9ZwwWS8zmr9rj3q1BuMQDeKHDkN2XHgD8G
```

### Step 2: Navigate to plugins directory

```bash
cd wp-content/plugins/
```

### Step 3: Upload plugin files

**Option A: Using SCP (from your local machine)**

```bash
# From your local machine (not SSH session)
scp -P 55031 -r /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/wordpress-plugin/sam-signup-modal sftp_live_sLxM0@34.136.237.175:/path/to/wp-content/plugins/
```

**Option B: Create files manually via SSH**

```bash
# Create plugin directory
mkdir -p sam-signup-modal/includes

# Create main plugin file
cat > sam-signup-modal/sam-signup-modal.php << 'EOF'
[Paste contents of sam-signup-modal.php here]
EOF

# Create Elementor widget file
cat > sam-signup-modal/includes/elementor-widget.php << 'EOF'
[Paste contents of elementor-widget.php here]
EOF
```

### Step 4: Activate plugin

**Via WordPress Admin:**
1. Go to Plugins → Installed Plugins
2. Find "SAM AI Signup Modal"
3. Click "Activate"

**Via WP-CLI (if available on 10Web):**
```bash
wp plugin activate sam-signup-modal
```

## Usage

### Method 1: Elementor Widget (Recommended)

1. Edit your SAM landing page in Elementor
2. Search for "SAM Signup Button" widget
3. Drag to desired location
4. Customize text, colors, and styling in widget settings
5. Update page

### Method 2: Shortcode

Add this anywhere in your content:

```
[sam_signup_button]
```

**Custom text:**
```
[sam_signup_button text="Try SAM Free"]
```

**Custom styling:**
```
[sam_signup_button text="Get Started" class="my-custom-class" style="background: #8907FF; padding: 20px 40px;"]
```

### Method 3: PHP Template

In your theme template files:

```php
<?php echo do_shortcode('[sam_signup_button]'); ?>
```

## Customization

### Change Button Text

Default: "Start 14-Day Free Trial"

**Via shortcode:**
```
[sam_signup_button text="Sign Up Now"]
```

**Via Elementor widget:** Edit widget settings → Content → Button Text

### Change Button Styling

**Via Elementor widget:** Edit widget settings → Style tab

**Via shortcode CSS:**
```css
.sam-cta-button {
    background: #8907FF !important; /* Your brand color */
    border-radius: 25px !important;
}
```

### Auto-load on Specific Pages Only

Edit `sam-signup-modal.php` line 47:

```php
// Current (loads on SAM page and homepage)
if (is_page('sam') || is_front_page()) {

// Load only on SAM page
if (is_page('sam')) {

// Load on all pages
if (true) {
```

## Troubleshooting

### Button doesn't trigger modal

**Check:**
1. Plugin is activated
2. Browser console for JavaScript errors (F12)
3. Script is loading: View source and search for `app.meet-sam.com/signup/embed.js`

**Fix:**
```bash
# Clear WordPress cache
wp cache flush

# Regenerate assets
wp elementor flush-css
```

### Modal not appearing

**Check:**
1. Pop-up blocker is disabled
2. Browser console for errors
3. Script loaded correctly

**Test manually:**
Open browser console (F12) and type:
```javascript
SAMSignup.open()
```

If error appears, the embed script isn't loading.

### Styling conflicts

If button styling looks wrong, add this CSS via Appearance → Customize → Additional CSS:

```css
.sam-cta-button {
    all: unset;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
    color: white !important;
    padding: 16px 32px !important;
    font-size: 18px !important;
    font-weight: 600 !important;
    border-radius: 8px !important;
    cursor: pointer !important;
    display: inline-block !important;
}
```

## Uninstallation

1. Deactivate plugin via WordPress admin
2. Delete plugin files:

```bash
# Via SSH
ssh sftp_live_sLxM0@34.136.237.175 -p 55031
cd wp-content/plugins/
rm -rf sam-signup-modal
```

## Support

- **Documentation:** `/docs/signup/WORDPRESS_ELEMENTOR_INTEGRATION.md`
- **Signup page:** https://app.meet-sam.com/signup/innovareai
- **Embed script:** https://app.meet-sam.com/signup/embed.js

## Version History

**1.0.0** (2025-10-06)
- Initial release
- Elementor widget support
- Shortcode support
- Auto-load on SAM page
