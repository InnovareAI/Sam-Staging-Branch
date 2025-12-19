# SAM LinkedIn Extension - Installation

## ✅ Icons Created!

Your extension now has all required icons:
- ✅ icon16.png (16x16)
- ✅ icon48.png (48x48)
- ✅ icon128.png (128x128)

## 📦 Installation Steps

### 1. Add SAM API Endpoint

Copy the new endpoint to your Sam project:

```bash
cp sam-api-endpoint.ts ~/Dev_Master/InnovareAI/Sam-New-Sep-7/app/api/linkedin-commenting/generate-from-text/route.ts
```

Then push to GitHub to deploy Sam with the new endpoint.

### 2. Load Extension in Chrome

1. Open Chrome browser
2. Navigate to: `chrome://extensions/`
3. Enable **"Developer mode"** (toggle in top-right corner)
4. Click **"Load unpacked"**
5. Select this folder: `/Users/tvonlinz/Dev_Master/3cubed/Brand Assistant/linkedin-sam-extension`
6. The SAM extension icon should appear in your toolbar

### 3. Configure Extension

1. Click the SAM extension icon in Chrome toolbar
2. Enter your settings:
   - **SAM API URL**: `https://your-sam-instance.netlify.app`
   - **Workspace ID**: Get from Sam workspace settings (UUID format)
   - **API Key**: Leave blank unless you have auth enabled
3. Click **"Save Configuration"**
4. Status should show **"Connected" ✅**

### 4. Test on LinkedIn

1. Go to [LinkedIn Feed](https://www.linkedin.com/feed/)
2. Look for pink **"Generate with SAM"** buttons on posts
3. Click a button to test comment generation
4. Review the generated comment in LinkedIn's comment box
5. Edit if needed, then click LinkedIn's "Post" button

## 🎯 Quick Test

After installation, test the connection:

1. Click SAM extension icon
2. Check status shows "Connected"
3. Go to LinkedIn feed
4. Find any post
5. Click "Generate with SAM"
6. Should see "Generating..." then comment appears

## 🐛 Troubleshooting

**Extension won't load:**
→ Make sure all files are in the folder
→ Check that icons folder has the 3 PNG files
→ Reload extension in chrome://extensions/

**"SAM not configured" error:**
→ Click extension icon
→ Enter SAM URL and Workspace ID
→ Click Save

**Buttons don't appear on LinkedIn:**
→ Refresh the LinkedIn page
→ Check extension is enabled in chrome://extensions/
→ Open browser console (F12) to check for errors

**"Failed to generate comment":**
→ Verify SAM API endpoint is deployed
→ Check SAM commenting agent is enabled for workspace
→ Review SAM application logs for errors

## 📁 Extension Files

Your extension includes:
```
linkedin-sam-extension/
├── manifest.json              ✅ Extension config
├── icons/
│   ├── icon16.png            ✅ Toolbar icon
│   ├── icon48.png            ✅ Management icon
│   └── icon128.png           ✅ Store icon
├── background/
│   └── background.js         ✅ Service worker
├── content/
│   ├── content.js            ✅ LinkedIn integration
│   └── content.css           ✅ Button styles
└── popup/
    ├── popup.html            ✅ Settings UI
    ├── popup.css             ✅ Popup styles
    └── popup.js              ✅ Settings logic
```

## 🚀 You're Ready!

Once installed and configured, you can:
- ✅ Generate AI comments on any LinkedIn post
- ✅ Use your SAM knowledge base and brand voice
- ✅ Review before posting (human-in-the-loop)
- ✅ Track stats in extension popup

Enjoy your SAM-powered LinkedIn engagement! 🎉
