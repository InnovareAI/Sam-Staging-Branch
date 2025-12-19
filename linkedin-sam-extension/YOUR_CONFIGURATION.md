# 🔧 Your Chrome Extension Configuration

## ✅ Everything is Ready!

All systems are deployed and your API key has been generated. Here's what you need to configure the extension.

---

## 📋 Configuration Details

### Open the SAM Extension Popup

Click the SAM extension icon in your Chrome toolbar (pink/purple icon).

### Enter These Values:

**1. SAM API URL:**
```
https://app.meet-sam.com
```

**2. Workspace ID:**
```
babdcab8-1a78-4b2f-913e-6e9fd9821009
```

**3. API Key:**
```
sk_live_qbfolkYqB1ZMDeqEKpfaffdop1g1L
```

*(Your API key is in your clipboard - just paste it!)*

### Click "Save Configuration"

Status should change to: **✅ Connected**

---

## 🚀 Test It Out!

### Step 1: Go to LinkedIn
https://www.linkedin.com/feed/

### Step 2: Look for SAM Buttons
Scroll through posts and you'll see pink **"Generate with SAM"** buttons on each post.

### Step 3: Generate a Comment
1. Click "Generate with SAM" on any post
2. Wait 2-5 seconds while SAM analyzes the post
3. Review the generated comment in LinkedIn's comment box
4. Edit if needed
5. Click LinkedIn's "Post" button

---

## ✨ What You Get

SAM will use your configured:
- ✅ Brand guidelines (tone, formality, style)
- ✅ Knowledge base content
- ✅ Expertise areas
- ✅ Example comments
- ✅ Anti-detection variance

**Result:** Natural, on-brand comments that sound like you!

---

## 📊 Extension Features

### Automatic Features:
- Detects all LinkedIn posts in feed
- Adds "Generate with SAM" buttons
- Extracts post text, author, engagement
- Calls your Sam API with authentication
- Inserts generated comment into LinkedIn
- Tracks session stats

### You Control:
- Review every comment before posting
- Edit as needed
- Post manually via LinkedIn
- Full transparency

---

## 🔒 Security

- ✅ API key securely stored in Chrome
- ✅ All requests authenticated
- ✅ Workspace isolation enforced
- ✅ No data stored externally
- ✅ You control all posting

---

## 🐛 Troubleshooting

### "Failed to connect to SAM"
- Check that Sam is deployed: https://app.meet-sam.com
- Verify API key is correct (paste from above)
- Check Netlify deployment status

### "Unauthorized" Error
- Make sure API key is entered exactly as shown
- Includes the `sk_live_` prefix
- No extra spaces

### Buttons Don't Appear
- Refresh LinkedIn page
- Check extension is enabled: chrome://extensions/
- Look for errors in browser console (F12)

### Comment Quality Issues
- Configure brand guidelines in Sam
- Add knowledge base content
- Enable "Use workspace knowledge" in brand guidelines

---

## 📈 Next Steps

1. ✅ Configure extension (paste values above)
2. ✅ Test on 5-10 LinkedIn posts
3. ✅ Refine brand guidelines based on results
4. ✅ Monitor which comment styles get best engagement
5. ✅ Scale up your LinkedIn presence!

---

## 🔑 API Key Security

**Important:**
- ✅ Save this page or store API key in password manager
- ✅ Never commit API key to version control
- ✅ Never share API key publicly
- ✅ If compromised, deactivate in Supabase and generate new one

**To deactivate this key:**
1. Go to Supabase dashboard
2. Open SQL Editor
3. Run: `UPDATE api_keys SET is_active = false WHERE key_prefix = 'sk_live_dZW3g3Pg';`

**To generate a new key:**
```bash
cd ~/Dev_Master/InnovareAI/Sam-New-Sep-7
node scripts/create-api-key.cjs "New Key Name" babdcab8-1a78-4b2f-913e-6e9fd9821009
```

---

## 🎉 You're All Set!

1. Paste the 3 values above into the extension popup
2. Click "Save Configuration"
3. Go to LinkedIn and start generating comments!

**Happy commenting! 🚀**
