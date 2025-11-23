# LinkedIn Auto-Commenting System - Complete Setup Guide

**Cost:** $0/month (Replaces $5-15/month Apify solution)
**Stack:** Supabase + Unipile + n8n + OpenRouter
**Date:** November 23, 2025

---

## 🎯 What This Does

Automatically discovers and comments on LinkedIn posts from profiles you follow:

1. **Scrapes posts** from LinkedIn profiles you specify (Andrew Ng, Sam Altman, etc.)
2. **Filters posts** by keywords (#GenAI, #AI, etc.)
3. **Generates AI comments** using Claude 3.5 Sonnet (sounds like you)
4. **Posts comments** directly to LinkedIn
5. **Tracks everything** in Supabase database

**Example Comment Generated:**
> "This is honestly pretty wild. The barrier to pulling live data just dropped to basically zero. I'm already thinking about how this changes research workflows. What specific tasks are you finding it handles best?"

---

## 💰 Cost Breakdown

| Service | Cost | Purpose |
|---------|------|---------|
| **Unipile** | $0/month | Profile scraping + commenting (FREE API) |
| **Supabase** | $0/month | Database (free tier: 500MB) |
| **OpenRouter** | ~$3-5/month | AI comment generation (~1000 comments) |
| **n8n** | $0/month | Workflow automation (self-hosted) |
| **TOTAL** | **~$3-5/month** | vs $20+/month with Apify |

---

## 📋 Prerequisites

- [ ] Unipile account (free)
- [ ] Supabase project (existing SAM database)
- [ ] n8n instance (you already have this)
- [ ] OpenRouter account (~$5 credits)
- [ ] LinkedIn account connected to Unipile

---

## 🚀 Step 1: Run Database Migration

### Open Supabase SQL Editor

1. Go to https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog
2. Click "SQL Editor" in left sidebar
3. Click "New Query"
4. Copy contents of `sql/migrations/017-linkedin-commenting-complete-system.sql`
5. Paste into editor
6. Click "Run" button

### Verify Tables Created

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'linkedin_%'
ORDER BY table_name;
```

You should see:
- `linkedin_brand_guidelines`
- `linkedin_discovered_posts`
- `linkedin_profiles_to_monitor`

---

## 🔧 Step 2: Configure Unipile

### 2.1 Get Your Unipile Credentials

1. Go to https://app.unipile.com
2. Click "Access Tokens" (left sidebar)
3. Click "Generate Token"
4. Name: `n8n-linkedin-commenting`
5. Select all scopes
6. Copy API Key: `39qOAzhn.7ks6QfCYBMSYSEx4op78j57lD5ZItVooPcsN1Fu1EbE=`

### 2.2 Get Your DSN and Account ID

1. Go to "Accounts" tab
2. Copy **DSN**: `api6.unipile.com:13670`
3. Copy **Account ID**: `mERQmojtSZq5GeomZZazlw`

### 2.3 Test Unipile Connection

Run this test script:

```bash
node scripts/js/test-legacy-profile-lookup.mjs
```

Expected output:
```
✅ SUCCESS with LinkedIn profile ID!
Total posts: 100
```

---

## 🗄️ Step 3: Add LinkedIn Profiles to Monitor

### Option A: Via Supabase SQL Editor

```sql
INSERT INTO linkedin_profiles_to_monitor (
  workspace_id,
  vanity_name,
  keywords,
  is_active
) VALUES
  ('babdcab8-1a78-4b2f-913e-6e9fd9821009', 'tvonlinz', ARRAY['#GenAI', '#AI'], true),
  ('babdcab8-1a78-4b2f-913e-6e9fd9821009', 'sama', ARRAY['#AI', '#OpenAI'], true),
  ('babdcab8-1a78-4b2f-913e-6e9fd9821009', 'andrewng', ARRAY['#AI', '#MachineLearning'], true),
  ('babdcab8-1a78-4b2f-913e-6e9fd9821009', 'ylecun', ARRAY['#AI', '#DeepLearning'], true),
  ('babdcab8-1a78-4b2f-913e-6e9fd9821009', 'karpathy', ARRAY['#AI', '#LLM'], true);
```

### Option B: Via UI (TODO - Build this)

We'll add a UI to manage profiles in the SAM dashboard later.

### How to Find LinkedIn Vanity Names

1. Go to someone's LinkedIn profile: `https://linkedin.com/in/thorsten-linz-123456/`
2. Vanity name is the part after `/in/`: `thorsten-linz-123456`
3. **Just use the part before the numbers**: `tvonlinz` (cleaner, still works)

---

## 📝 Step 4: Configure Brand Voice Guidelines

### Edit Your Brand Voice

```sql
UPDATE linkedin_brand_guidelines
SET
  tone_of_voice = 'Talk like you''re texting a smart friend who gets business. Be confident without being a know-it-all.',
  writing_style = 'Cut the fluff. Say what you mean. Short, punchy sentences. Focus on what''s possible, not what''s broken.',
  topics_and_perspective = 'AI, automation, B2B SaaS, sales processes, productivity, entrepreneurship',
  dos_and_donts = E'DO: Be optimistic, practical, curious\nDON''T: Use emojis, hashtags, semicolons, em-dashes, "game changer", "here''s the kicker"',
  comment_framework = 'ACA+I: Acknowledge the post, Add nuance or perspective, drop an I-statement (I''ve noticed this too), ask a warm question',
  max_characters = 300
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
```

### Test Your Brand Voice

Create a sample post and see what AI generates:

```sql
INSERT INTO linkedin_discovered_posts (
  workspace_id,
  profile_id,
  social_id,
  post_url,
  post_text,
  author_name,
  comment_status
) VALUES (
  'babdcab8-1a78-4b2f-913e-6e9fd9821009',
  (SELECT id FROM linkedin_profiles_to_monitor LIMIT 1),
  'test-post-123',
  'https://linkedin.com/posts/test',
  'AI tools are completely replacing Photoshop for creative workflows. Google''s new AI can edit photos with simple text prompts. The barrier to entry just dropped to zero.',
  'Test Author',
  'new'
);
```

Then run the commenting workflow manually in n8n to see generated comment.

---

## 🔄 Step 5: Import n8n Workflow

### 5.1 Add Environment Variables to n8n

Edit your n8n `docker-compose.yml`:

```yaml
environment:
  - WORKSPACE_ID=babdcab8-1a78-4b2f-913e-6e9fd9821009
  - UNIPILE_DSN=api6.unipile.com:13670
  - UNIPILE_API_KEY=39qOAzhn.7ks6QfCYBMSYSEx4op78j57lD5ZItVooPcsN1Fu1EbE=
  - UNIPILE_ACCOUNT_ID=mERQmojtSZq5GeomZZazlw
```

Restart n8n:
```bash
docker-compose restart n8n
```

### 5.2 Import Workflow JSON

1. Go to https://workflows.innovareai.com
2. Click "Workflows" → "Add Workflow"
3. Click "Import from File"
4. Select `n8n-workflows/linkedin-commenting-supabase-unipile.json`
5. Click "Import"

### 5.3 Configure Credentials

#### Supabase PostgreSQL Connection

1. Click any Supabase node
2. Click "Credentials" dropdown
3. Click "Create New Credential"
4. Enter:
   - **Host**: `db.latxadqrvrrrcvkktrog.supabase.co`
   - **Database**: `postgres`
   - **User**: `postgres`
   - **Password**: `[Your Supabase password]`
   - **Port**: `5432`
   - **SSL**: Enabled
5. Click "Save"

#### Unipile API Key (HTTP Header Auth)

1. Click "Unipile: Lookup LinkedIn Profile" node
2. Click "Credentials" dropdown
3. Click "Create New Credential"
4. Select "Header Auth"
5. Enter:
   - **Name**: `X-API-KEY`
   - **Value**: `39qOAzhn.7ks6QfCYBMSYSEx4op78j57lD5ZItVooPcsN1Fu1EbE=`
6. Click "Save"

#### OpenRouter API

1. Go to https://openrouter.ai
2. Sign up / Log in
3. Click "API Keys"
4. Copy API key
5. In n8n, click "AI: Generate Comment" node
6. Click "Credentials" dropdown
7. Paste API key
8. Click "Save"

---

## ✅ Step 6: Test the Workflows

### Test Part 1: Scrape Posts

1. Click "Schedule: Scrape Posts (Daily)" node
2. Click "Execute Node" (play button)
3. Watch workflow run through each step
4. Expected: 5-10 posts saved to database

**Verify in Supabase:**
```sql
SELECT
  post_text,
  author_name,
  comment_status,
  created_at
FROM linkedin_discovered_posts
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
ORDER BY created_at DESC
LIMIT 10;
```

### Test Part 2: Generate & Post Comments

1. Click "Schedule: Comment on Posts (Every 73 min)" node
2. Click "Execute Node"
3. Watch AI generate comment
4. Watch comment post to LinkedIn

**Expected Output:**
```
✅ Post fetched from Supabase
✅ Brand guidelines loaded
✅ AI comment generated (Claude 3.5 Sonnet)
✅ Comment posted to LinkedIn
✅ Database updated (status: commented)
```

**Check LinkedIn:**
1. Go to the post URL from database
2. Scroll to comments
3. Find your comment (posted 30 seconds ago)

---

## 📊 Step 7: Monitor & Adjust

### View All Discovered Posts

```sql
SELECT
  ldp.post_text,
  ldp.author_name,
  ldp.ai_comment,
  ldp.comment_status,
  lp.vanity_name as profile_monitored
FROM linkedin_discovered_posts ldp
JOIN linkedin_profiles_to_monitor lp ON ldp.profile_id = lp.id
WHERE ldp.workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
ORDER BY ldp.created_at DESC
LIMIT 20;
```

### View Comment Performance

```sql
SELECT
  comment_status,
  COUNT(*) as total
FROM linkedin_discovered_posts
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
GROUP BY comment_status;
```

Expected output:
```
comment_status | total
---------------|------
new            | 15
commented      | 5
skipped        | 2
```

### Adjust Scheduling

**Scraping Frequency:**
- Current: Daily at 5am
- Recommended: 1-2x per day
- Edit "Schedule: Scrape Posts" node → Change interval

**Commenting Frequency:**
- Current: Every 73 minutes
- Recommended: 60-120 minutes (randomized)
- Too frequent = spam detection
- Too slow = miss engagement opportunities

---

## 🐛 Troubleshooting

### Issue 1: No Posts Scraped

**Check:**
```sql
SELECT * FROM linkedin_profiles_to_monitor
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
```

**Fix:**
- Ensure `is_active = true`
- Verify vanity names are correct (check LinkedIn URLs)
- Test profile lookup: `node scripts/js/test-legacy-profile-lookup.mjs`

### Issue 2: "Invalid Recipient" Error

**Cause:** Using wrong Unipile endpoint

**Fix:** Ensure n8n uses:
- ✅ `GET /api/v1/users/{vanity}?account_id=...` (legacy endpoint)
- ❌ NOT `GET /api/v1/users/profile?identifier=...` (broken)

### Issue 3: Comments Not Posting

**Check Unipile Account Status:**
1. Go to https://app.unipile.com
2. Click "Accounts"
3. Verify LinkedIn account shows "Connected"

**Test Manually:**
```bash
curl -X POST https://api6.unipile.com:13670/api/v1/posts/7386026924579397633/comments \
  -H "X-API-KEY: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "account_id": "YOUR_ACCOUNT_ID",
    "text": "Test comment from API"
  }'
```

### Issue 4: AI Comments Sound Robotic

**Adjust Brand Guidelines:**
- Make tone_of_voice MORE specific
- Add examples of your actual writing
- Lower temperature in OpenRouter node (0.8 → 0.6)

**Test Different Models:**
- Current: Claude 3.5 Sonnet
- Alternative: GPT-4 Turbo
- Alternative: DeepSeek (cheaper)

---

## 📈 Optimization Tips

### 1. Profile Selection Strategy

**Good Profiles:**
- ✅ Active posters (3+ posts/week)
- ✅ Engage with their audience (reply to comments)
- ✅ In your niche/industry
- ✅ 1st or 2nd connections

**Avoid:**
- ❌ Mega-influencers (100k+ followers) - low engagement per comment
- ❌ Inactive accounts (< 1 post/month)
- ❌ Out of network (3rd connections)

### 2. Keyword Filtering

**Current:** Posts saved regardless of content
**Optimization:** Filter by keywords BEFORE saving

Update workflow:
1. Add "Filter: Check Keywords" node after "Split: Individual Posts"
2. Only save posts containing keywords from profile config

### 3. Comment Quality Scoring

**Add:**
- Track reply rate (did author respond?)
- Track likes on your comment
- Use feedback to improve prompts

### 4. Rate Limiting

**LinkedIn Limits:**
- Max 10-20 comments/day per account
- Space comments 30+ minutes apart
- Vary comment length and style

**Current Setup:**
- 73-minute intervals = ~19 comments/day ✅
- Random phrasing via AI ✅

---

## 🎯 Next Steps

### Phase 1: Basic Automation (Complete after setup)
- [x] Database schema created
- [x] n8n workflow imported
- [ ] Test scraping 5 profiles
- [ ] Test generating 3 comments
- [ ] Verify comments appear on LinkedIn

### Phase 2: UI Integration (Week 2)
- [ ] Add "Commenting Agent" section to SAM dashboard
- [ ] UI to add/remove profiles
- [ ] UI to edit brand guidelines
- [ ] View discovered posts + generated comments
- [ ] Manual approve/reject comments before posting

### Phase 3: Analytics (Week 3)
- [ ] Track comment engagement (likes, replies)
- [ ] A/B test different comment styles
- [ ] Show ROI metrics (connections gained, profile views)

### Phase 4: Advanced Features (Week 4+)
- [ ] Multi-account support (comment from different accounts)
- [ ] Team collaboration (approve comments together)
- [ ] Custom comment templates per profile type
- [ ] Integration with CRM (track leads from comments)

---

## 💡 Pro Tips

1. **Start Small:** Test with 3-5 profiles for first week
2. **Monitor Quality:** Manually review first 10 comments before automating
3. **Adjust Tone:** Refine brand guidelines based on what gets replies
4. **Engage Back:** If someone replies to your comment, respond manually (builds relationships)
5. **Track Results:** After 30 days, measure:
   - Profile views increase
   - Connection requests received
   - Inbound messages from comments

---

## 📞 Support

**Issues with Setup?**
- Check n8n execution logs: Workflows → [Your workflow] → Executions
- Check Supabase logs: Project → Logs
- Test endpoints manually: `scripts/js/test-*.mjs`

**Database Questions?**
- View schema: Supabase → Table Editor
- Query data: SQL Editor
- Check RLS: Authentication → Policies

**Workflow Not Running?**
- Verify n8n environment variables are set
- Check credentials are configured
- Enable "Execute on activation" for schedule triggers

---

## ✅ Checklist: You're Ready When...

- [ ] Migration 017 ran successfully
- [ ] 5+ profiles added to `linkedin_profiles_to_monitor`
- [ ] Brand guidelines configured
- [ ] n8n workflow imported and credentials set
- [ ] Test scrape returned 10+ posts
- [ ] Test comment posted successfully to LinkedIn
- [ ] Can see your comment on LinkedIn.com
- [ ] Database shows `comment_status = 'commented'`

**Total Setup Time:** 60-90 minutes
**Monthly Cost:** ~$3-5 (vs $20+ with Apify)
**Posts Monitored:** 100+ per day
**Comments Posted:** 10-20 per day

---

**Congratulations! You now have a $0/month LinkedIn automation system powered by Unipile + Supabase!** 🎉
