# SAM LinkedIn Extension - Quick Start Guide

## ⚡ 5-Minute Setup

### Step 1: Create Icons (1 min)

You need 3 icon files. Easiest way:

1. Go to https://www.canva.com/create/icons/
2. Search "chat bubble icon"
3. Customize with pink/purple gradient
4. Download as PNG in 3 sizes:
   - 16x16px → save as `icons/icon16.png`
   - 48x48px → save as `icons/icon48.png`
   - 128x128px → save as `icons/icon128.png`

OR use any 128px pink icon and resize to 16px and 48px.

### Step 2: Add API Endpoint to SAM (2 min)

1. Copy this file:
   ```bash
   cp sam-api-endpoint.ts /path/to/Sam-New-Sep-7/app/api/linkedin-commenting/generate-from-text/route.ts
   ```

2. Deploy SAM to Netlify (it will auto-deploy if you push to GitHub)

### Step 3: Load Extension in Chrome (1 min)

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (toggle top-right)
4. Click "Load unpacked"
5. Select the `linkedin-sam-extension` folder

### Step 4: Configure Extension (1 min)

1. Click the SAM extension icon in Chrome toolbar
2. Enter:
   - **SAM API URL**: `https://your-sam.netlify.app`
   - **Workspace ID**: Get from SAM workspace settings (UUID format)
   - **API Key**: Leave blank if SAM has no auth
3. Click "Save Configuration"
4. Status should show "Connected" ✅

## 🚀 Usage

1. **Go to LinkedIn** - Open your LinkedIn feed
2. **See SAM buttons** - Pink "Generate with SAM" button on each post
3. **Click to generate** - SAM analyzes post and creates comment
4. **Review & post** - Comment appears in LinkedIn box, you click "Post"

## ❓ FAQ

**Q: Do I need a LinkedIn developer account?**
A: No! This works entirely in your browser, no LinkedIn API needed.

**Q: Will this auto-post comments?**
A: No. It only fills in the comment box. You manually review and post.

**Q: What if I get an error?**
A: Check:
- SAM URL is correct
- Workspace ID is correct
- SAM commenting agent is enabled
- Brand guidelines are configured in SAM

**Q: Can LinkedIn detect this?**
A: No. You're manually reviewing and posting. SAM just helps you write.

**Q: Does it work on mobile?**
A: No, Chrome extensions only work on desktop.

## 🎯 Next Steps

1. Configure brand guidelines in SAM for better quality comments
2. Add knowledge base content to reference in comments
3. Test on different post types (questions, thought leadership, etc.)
4. Monitor which comment styles get best engagement

## 🐛 Troubleshooting

**Extension doesn't load**
→ Check all files are in the `linkedin-sam-extension` folder
→ Make sure icons exist (even placeholder images work)

**"SAM not configured"**
→ Open extension popup and enter SAM URL + Workspace ID

**"Failed to generate comment"**
→ Open browser console (F12), check error message
→ Verify SAM API endpoint is deployed
→ Check SAM logs for errors

**Buttons don't appear on LinkedIn**
→ Refresh the LinkedIn page
→ Check if extension is enabled in chrome://extensions/

## 📞 Need Help?

1. Check browser console (F12) for errors
2. Check SAM application logs
3. Verify brand guidelines are configured
4. Test the SAM API directly using curl/Postman

---

**That's it!** You now have SAM-powered comment generation directly in LinkedIn. 🎉
