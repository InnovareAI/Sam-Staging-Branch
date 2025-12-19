# SAM LinkedIn Extension - Installation Checklist

Use this checklist to ensure everything is set up correctly.

## ✅ Pre-Installation Checks

- [ ] Sam application is running and accessible
- [ ] Commenting agent is enabled in Sam workspace
- [ ] Brand guidelines configured in Sam (recommended)
- [ ] Knowledge base has content (optional but recommended)
- [ ] You know your Sam API URL (e.g., https://sam.netlify.app)
- [ ] You have your Workspace ID from Sam settings

## ✅ Extension Files

- [x] manifest.json exists
- [x] icons/icon16.png exists (3.9KB)
- [x] icons/icon48.png exists (2.9KB)
- [x] icons/icon128.png exists (1.0KB)
- [x] background/background.js exists
- [x] content/content.js exists
- [x] content/content.css exists
- [x] popup/popup.html exists
- [x] popup/popup.js exists
- [x] popup/popup.css exists

**All files ready!** ✅

## ✅ Sam API Endpoint Deployment

- [ ] Copy `sam-api-endpoint.ts` to Sam project:
  ```bash
  cp sam-api-endpoint.ts ~/Dev_Master/InnovareAI/Sam-New-Sep-7/app/api/linkedin-commenting/generate-from-text/route.ts
  ```

- [ ] Commit to Git:
  ```bash
  cd ~/Dev_Master/InnovareAI/Sam-New-Sep-7
  git add app/api/linkedin-commenting/generate-from-text/
  git commit -m "Add Chrome extension API endpoint"
  ```

- [ ] Push to deploy:
  ```bash
  git push
  ```

- [ ] Wait for Netlify deployment to complete (~2 min)

- [ ] Test endpoint is live:
  ```bash
  curl https://your-sam.netlify.app/api/linkedin-commenting/settings?workspace_id=YOUR_ID
  ```

## ✅ Chrome Extension Installation

- [ ] Open Chrome browser
- [ ] Navigate to: `chrome://extensions/`
- [ ] Enable "Developer mode" (toggle in top-right)
- [ ] Click "Load unpacked"
- [ ] Select folder: `/Users/tvonlinz/Dev_Master/3cubed/Brand Assistant/linkedin-sam-extension`
- [ ] Extension icon appears in Chrome toolbar
- [ ] No errors shown in chrome://extensions/

## ✅ Extension Configuration

- [ ] Click SAM extension icon in toolbar
- [ ] Popup window opens
- [ ] Enter SAM API URL (must start with https://)
- [ ] Enter Workspace ID (UUID format)
- [ ] Enter API Key (if Sam has auth - otherwise leave blank)
- [ ] Click "Save Configuration"
- [ ] Status changes to "Connected" with green dot
- [ ] No error messages appear

## ✅ LinkedIn Integration Test

- [ ] Go to https://www.linkedin.com/feed/
- [ ] Page loads normally
- [ ] Scroll through feed
- [ ] Pink "Generate with SAM" buttons appear on posts
- [ ] Buttons are visible and styled correctly
- [ ] At least 3-5 posts show SAM buttons

## ✅ Comment Generation Test

- [ ] Find a post with good content (50+ characters)
- [ ] Click "Generate with SAM" button
- [ ] Button changes to "Generating..." with spinner
- [ ] Wait 2-5 seconds
- [ ] Success notification appears with confidence score
- [ ] Comment appears in LinkedIn's comment box
- [ ] Comment is relevant to the post
- [ ] Comment box is highlighted (yellow background)
- [ ] You can edit the comment
- [ ] LinkedIn's "Post" button is available

## ✅ Quality Checks

- [ ] Generated comment is 2-3 sentences
- [ ] Comment references specific point from post
- [ ] Tone matches your brand guidelines
- [ ] No generic phrases ("Great post!", "Thanks for sharing!")
- [ ] Sounds natural, not AI-generated
- [ ] Confidence score is reasonable (70%+)

## ✅ Error Handling Test

- [ ] Try on very short post (<20 chars) → Should skip or generate simple comment
- [ ] Disconnect internet → Should show clear error message
- [ ] Wrong Workspace ID → Should show authentication error
- [ ] Test "Regenerate" button → Should generate new comment

## ✅ Extension Features Test

- [ ] Click extension icon → Popup opens
- [ ] Stats section shows counts (if you've generated comments)
- [ ] Reset Stats button works
- [ ] Status indicator updates correctly
- [ ] Configuration persists after closing popup
- [ ] Configuration persists after browser restart

## ✅ Performance Checks

- [ ] Comment generation completes in <5 seconds
- [ ] LinkedIn page doesn't slow down
- [ ] Scrolling is smooth
- [ ] Extension doesn't interfere with LinkedIn features
- [ ] Can still like/comment/share normally

## ✅ Browser Console Checks

- [ ] Open DevTools: F12 on LinkedIn
- [ ] Go to Console tab
- [ ] Look for: "🤖 SAM LinkedIn Assistant loaded"
- [ ] Look for: "🔍 SAM is watching for LinkedIn posts..."
- [ ] No red errors in console
- [ ] After generating: "✅ Added SAM button to post"
- [ ] After generating: "✅ Comment generated"

## 🐛 If Something's Wrong

**Extension won't load:**
```bash
# Check all files present
cd "/Users/tvonlinz/Dev_Master/3cubed/Brand Assistant/linkedin-sam-extension"
ls manifest.json background/ content/ popup/ icons/
```

**Buttons don't appear:**
- Check extension enabled: chrome://extensions/
- Refresh LinkedIn page: Ctrl+R or Cmd+R
- Check console for errors: F12

**"Failed to generate comment":**
- Verify Sam API URL is correct
- Check Workspace ID matches
- Confirm commenting agent enabled in Sam
- Review Sam Netlify logs

**Comments are low quality:**
- Configure brand guidelines in Sam
- Add example comments
- Enable workspace knowledge
- Add expertise areas

## 📊 Success Criteria

You're ready to use SAM when:
- ✅ Extension loads without errors
- ✅ Buttons appear on LinkedIn posts
- ✅ Comments generate in <5 seconds
- ✅ Comments are relevant and on-brand
- ✅ You can edit before posting
- ✅ Stats track correctly

## 🎉 Post-Installation

After successful installation:
1. Test on 5-10 different posts
2. Note which comment styles work best
3. Refine brand guidelines based on results
4. Monitor engagement on posted comments
5. Adjust tone/style in Sam settings
6. Scale up your LinkedIn presence!

---

**Questions?** Check:
- [START_HERE.md](START_HERE.md) - Quick overview
- [INSTALL.md](INSTALL.md) - Detailed installation
- [PREVIEW.md](PREVIEW.md) - Visual guide
- [README.md](README.md) - Full documentation

---

**Status:** All files ready ✅ | Icons created ✅ | Ready to install! 🚀
