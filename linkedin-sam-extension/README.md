# SAM LinkedIn Assistant - Chrome Extension

> Generate AI-powered LinkedIn comments directly in your feed using SAM's knowledge base

## Features

- 🤖 **AI-Powered Comments** - Generate contextual comments using SAM's commenting agent
- 📚 **Knowledge Base Integration** - Leverages your workspace KB and brand guidelines
- 🎯 **One-Click Generation** - Add "Generate with SAM" buttons to LinkedIn posts
- ✨ **Anti-Detection** - Uses SAM's built-in variance and quality controls
- 👤 **Brand Voice** - Maintains your configured tone, style, and expertise
- 🔒 **Secure** - Connects directly to your SAM instance

## Installation

### 1. Set Up SAM API Endpoint

First, add the new API endpoint to your SAM instance:

1. Copy `sam-api-endpoint.ts` to your Sam project:
   ```bash
   cp sam-api-endpoint.ts /path/to/Sam-New-Sep-7/app/api/linkedin-commenting/generate-from-text/route.ts
   ```

2. Deploy Sam with the new endpoint

### 2. Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `linkedin-sam-extension` folder
5. The extension icon should appear in your toolbar

### 3. Configure Extension

1. Click the SAM extension icon in Chrome toolbar
2. Enter your **SAM API URL** (e.g., `https://your-sam-instance.netlify.app`)
3. Enter your **Workspace ID** (found in SAM workspace settings)
4. (Optional) Enter **API Key** if your SAM has authentication
5. Click "Save Configuration"
6. Status should change to "Connected"

### 4. Get Your Workspace ID

To find your Workspace ID in SAM:

1. Log into your SAM application
2. Go to Workspace Settings
3. Copy the workspace ID (UUID format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

## Usage

### Generating Comments

1. **Go to LinkedIn** - Navigate to your LinkedIn feed
2. **Look for SAM buttons** - Each post will have a pink "Generate with SAM" button
3. **Click to Generate** - SAM will analyze the post and generate a contextual comment
4. **Review & Edit** - The comment appears in LinkedIn's comment box for you to review
5. **Post Manually** - Click LinkedIn's "Post" button when ready

### What Gets Generated

SAM uses your configured:
- ✅ Brand guidelines (tone, formality, length)
- ✅ Expertise areas and talking points
- ✅ Knowledge base content (if enabled)
- ✅ Comment frameworks (ACA+I, VAR, Hook-Value-Bridge)
- ✅ Example comments for style matching
- ✅ Anti-detection variance (random length, style, openers)

### Tips for Best Results

- **Configure Brand Guidelines** in SAM first for personalized comments
- **Enable Knowledge Base** in brand guidelines to reference your content
- **Review before posting** - Always check comments for context appropriateness
- **Edit as needed** - Treat generated comments as drafts, not final copy
- **Watch engagement** - Monitor which styles get best responses

## Extension UI

### Popup Interface

- **Status Indicator** - Shows connection status (Connected/Not configured)
- **Configuration** - SAM API URL, Workspace ID, API Key
- **Session Stats** - Tracks comments generated and posts processed
- **Instructions** - Quick help guide

### LinkedIn Interface

- **Pink Button** - "Generate with SAM" appears on each post
- **Loading State** - Shows spinner while generating
- **Success Banner** - Displays confidence score after generation
- **Error Messages** - Clear feedback if something goes wrong

## Troubleshooting

### "SAM not configured" Error

- Check that you've entered SAM API URL and Workspace ID in extension popup
- Verify the URL format (must include https://)
- Ensure Workspace ID is correct UUID format

### "Failed to generate comment" Error

- Verify your SAM instance is running and accessible
- Check that commenting agent is enabled for your workspace
- Ensure you have brand guidelines configured (optional but recommended)
- Look at browser console (F12) for detailed error messages

### "Could not find comment input box"

- Make sure you're on a regular LinkedIn post (not article/video)
- Try clicking LinkedIn's "Comment" button first to open the comment box
- Refresh the page and try again

### Comments Look Generic

- Configure brand guidelines in SAM for better quality
- Add example comments to train the AI on your style
- Enable "Use Workspace Knowledge" in brand guidelines
- Check that your expertise areas are specific, not generic

## Architecture

### Files

```
linkedin-sam-extension/
├── manifest.json              # Extension configuration
├── background/
│   └── background.js          # Service worker (handles API calls)
├── content/
│   ├── content.js             # Injects buttons & handles UI
│   └── content.css            # Styles for buttons & notifications
├── popup/
│   ├── popup.html             # Extension settings UI
│   ├── popup.css              # Popup styles
│   └── popup.js               # Settings logic
├── icons/                     # Extension icons (16/48/128px)
└── sam-api-endpoint.ts        # New SAM API route (copy to Sam)
```

### How It Works

1. **Content Script** (`content.js`) runs on LinkedIn pages
2. **Detects posts** using LinkedIn's DOM structure
3. **Adds SAM buttons** to each post's action bar
4. **On click**, extracts post data (text, author, engagement)
5. **Calls SAM API** at `/api/linkedin-commenting/generate-from-text`
6. **SAM generates comment** using configured brand guidelines + KB
7. **Inserts comment** into LinkedIn's comment box
8. **User reviews** and posts manually

## API Endpoint

### POST `/api/linkedin-commenting/generate-from-text`

Request:
```json
{
  "workspace_id": "uuid-here",
  "post_text": "The actual LinkedIn post content...",
  "author_name": "John Doe",
  "author_title": "CEO at Company",
  "engagement": {
    "likes": 42,
    "comments": 7
  }
}
```

Response (Success):
```json
{
  "success": true,
  "comment_text": "Generated comment text here...",
  "confidence_score": 0.87,
  "reasoning": "Why this comment was generated",
  "quality_indicators": {
    "adds_value": true,
    "on_topic": true,
    "appropriate_tone": true,
    "avoids_sales_pitch": true,
    "references_post_specifically": true
  }
}
```

Response (Skipped):
```json
{
  "skipped": true,
  "reason": "Post too short to add value"
}
```

## Privacy & Security

- **No data stored** - Extension doesn't save your LinkedIn data
- **Direct to SAM** - Connects only to your SAM instance
- **Manual posting** - You control what gets posted to LinkedIn
- **Local config** - API keys stored in Chrome's secure storage
- **Open source** - Full transparency, no hidden tracking

## Requirements

- Chrome browser (v88+)
- Active SAM instance with commenting agent enabled
- Valid workspace with brand guidelines configured
- LinkedIn account

## Development

### Testing Locally

1. Make changes to extension files
2. Go to `chrome://extensions/`
3. Click "Reload" button on SAM extension
4. Test on LinkedIn feed

### Debugging

- **Extension popup**: Right-click extension icon → Inspect popup
- **Content script**: Open DevTools (F12) on LinkedIn page
- **Background worker**: chrome://extensions/ → Inspect service worker

## Known Limitations

- Only works on LinkedIn feed posts (not articles, videos, or profiles)
- Requires manual posting (Chrome extensions cannot auto-post to LinkedIn)
- LinkedIn DOM changes may require extension updates
- Rate limits apply based on SAM API configuration

## Future Enhancements

- [ ] Support for LinkedIn articles and videos
- [ ] Reply to existing comments
- [ ] Bulk comment generation
- [ ] A/B testing different comment styles
- [ ] Analytics dashboard
- [ ] Firefox & Edge support

## License

MIT License - See LICENSE file for details

## Support

For issues or questions:
1. Check SAM connection in extension popup
2. Review browser console for errors
3. Verify SAM API endpoint is deployed
4. Check SAM application logs

## Credits

Built to integrate with **SAM (Social AI Manager)** - InnovareAI's LinkedIn automation platform.
