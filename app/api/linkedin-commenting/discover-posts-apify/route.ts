import { supabaseAdmin } from '@/app/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;

/**
 * CRITICAL: Resolve the correct URN from Unipile
 *
 * Apify returns activity URNs from LinkedIn URLs (e.g., urn:li:activity:7400583686523469824)
 * But Unipile needs the actual post URN (e.g., urn:li:ugcPost:7400583515781890048)
 * These have DIFFERENT numeric IDs!
 *
 * This function queries Unipile to get the correct URN for posting comments.
 */
/**
 * HIRING POST FILTER
 *
 * Detects job posting/hiring posts that should not be commented on.
 * These posts are typically recruiting announcements where promotional
 * comments would be inappropriate and spammy.
 */
const HIRING_POST_PATTERNS = [
  // Direct hiring announcements - STRONG PATTERNS
  /\bis\s+hiring\b/i,                                    // "Company is hiring"
  /\b(we['']?re|we are|i['']?m|i am)\s+hiring\b/i,
  /\bhiring\s+(now|immediately|urgently|asap|for|to)\b/i,
  /\b(job|position|role)\s+(opening|available|vacancy|opportunity)\b/i,
  /\bnow\s+hiring\b/i,
  /\bcurrently\s+hiring\b/i,

  // Job application requests
  /\b(apply|applications?)\s+(now|here|below|today)\b/i,
  /\bsend\s+(your\s+)?(cv|resume|application)\b/i,
  /\b(dm|message)\s+(me|us)\s+(for|if|to)\s+(apply|application|details|info)\b/i,

  // Job postings with specific roles - EXPANDED LIST
  /\blooking\s+for\s+(a|an)?\s*[\w\s]*(developer|engineer|designer|manager|analyst|specialist|coordinator|assistant|intern|professional|expert|lead|consultant)\b/i,
  /\bseeking\s+(a|an)?\s*[\w\s]*(developer|engineer|designer|manager|analyst|specialist|coordinator|assistant|intern|professional|expert|lead|consultant)\b/i,

  // Generic recruitment language
  /\bjoin\s+(our|my|the)\s+team\b/i,
  /\b(come|want\s+to)\s+work\s+(with|for)\s+(us|me)\b/i,
  /\bopen\s+(position|role)s?\b/i,
  /\bcareer\s+opportunit(y|ies)\b/i,

  // Hashtag patterns - EXPANDED
  /#hiring\b/i,                                          // Removed \b at start for hashtags
  /#job(s|opening|alert|search)?\b/i,
  /#\w*jobs\b/i,                                         // Catches #AIJobs, #TechJobs, etc.
  /#careers?\b/i,
  /#nowhiring\b/i,
  /#opentowork\b/i,
  /#techjobs?\b/i,
  /#werehiring\b/i,

  // Remote/location-based job posts
  /\b(remote|hybrid|onsite)\s+(position|role|job|opportunity)\b/i,
  /\b(full[-\s]?time|part[-\s]?time|contract|freelance)\s+(position|role|opportunity|opening)\b/i,

  // Job description patterns - NEW
  /\bwhat\s+(we['']?re|you['']?ll)\s+(looking\s+for|do)\b/i,       // "What we're looking for", "What you'll do"
  /\b\d+[-–]\d+\s+years?\s+(of\s+)?experience\b/i,                  // "5-12 years of experience"
  /\byears?\s+(of\s+)?experience\s+(in|with)\b/i,                   // "years of experience in"
  /\brequirements?\s*:/i,                                           // "Requirements:"
  /\bqualifications?\s*:/i,                                         // "Qualifications:"
  /\bresponsibilities?\s*:/i,                                       // "Responsibilities:"
  /\blocation\s*:\s*(india|usa|uk|remote|hybrid)/i                  // "Location: India"
];

/**
 * Check if a post is a hiring/job posting
 */
function isHiringPost(postContent: string): { isHiring: boolean; matchedPattern?: string } {
  if (!postContent || typeof postContent !== 'string') {
    return { isHiring: false };
  }

  const normalizedContent = postContent.toLowerCase().trim();

  for (const pattern of HIRING_POST_PATTERNS) {
    if (pattern.test(normalizedContent)) {
      const match = normalizedContent.match(pattern);
      return {
        isHiring: true,
        matchedPattern: match ? match[0].substring(0, 50) : 'hiring pattern matched'
      };
    }
  }

  return { isHiring: false };
}

/**
 * ENGAGEMENT BAIT FILTER
 *
 * Detects posts where the author requests one-word engagement bait comments
 * like "yes", "No", "send it", "like if you agree", etc.
 *
 * These posts should be IGNORED because:
 * 1. They're low-value engagement farming
 * 2. Any thoughtful comment would look out of place
 * 3. Our AI comments are designed for genuine engagement, not one-word responses
 */
const ENGAGEMENT_BAIT_PATTERNS = [
  // Direct requests for one-word comments
  /\b(comment|drop|type|say|reply|respond)[\s:]+["']?(yes|no|send|agree|done|interested|ready|me|want|need|please|now|true|info)["']?\b/i,
  /\b(yes|no|send it|interested)[\s:]+in[\s:]+the[\s:]+comments?\b/i,

  // "Like/Comment if..." patterns
  /\b(like|comment|share|repost)[\s:]+if[\s:]+you[\s:]+(agree|want|need|like|love)\b/i,
  /\bif[\s:]+you[\s:]+(agree|want)[\s:,]+comment/i,

  // "Drop a..." patterns
  /\bdrop[\s:]+a?[\s:]?["']?[🔥💯👇✅❤️💪🙌🎯⬇️yes]+["']?\b/i,
  /\bdrop[\s:]+["']?(yes|no|me|send|want|need|agree|interested|info)["']?\b/i,

  // "Comment [emoji]" patterns
  /\bcomment[\s:]+["']?[🔥💯👇✅❤️💪🙌🎯⬇️]+["']?\s*(if|to|for|and)?\b/i,

  // "Say/Type [word]" patterns
  /\b(say|type)[\s:]+["']?(yes|no|me|send|agree|ready|want|need|interested)["']?\b/i,

  // "Reply with..." patterns
  /\breply[\s:]+with[\s:]+(yes|no|me|a\s+)?["']?\w{1,10}["']?\b/i,

  // Generic engagement farming
  /\bwho[\s:]+wants?[\s:]+this[\s:]*\??\s*(comment|drop|type)/i,
  /\bcomment[\s:]["']?[\w]{1,8}["']?[\s:]+(below|here|now)/i,

  // "I'll send..." patterns (common DM bait)
  /\b(i'll|ill|i will)[\s:]+send[\s:]+.{0,20}(comment|drop|type|say)/i,

  // Poll-like requests
  /\b(yes|no)\s+or\s+(yes|no)[\s:]*\??\s*(in|below|here)?/i,

  // "Who's in?" / "Who wants?" bait
  /\bwho['']?s[\s:]+in\??\s*(comment|drop|reply)?/i,
  /\bwho[\s:]+needs?[\s:]+this\??\s*(comment|type|drop)?/i,

  // Simple one-word CTAs
  /^[\s\S]*?(comment|type|drop)[\s:]+["']?(yes|no|me|send|want|now|info)["']?[\s:]*[!.?]*$/i
];

/**
 * Check if a post is engagement bait requesting one-word comments
 */
function isEngagementBait(postContent: string): { isBait: boolean; matchedPattern?: string } {
  if (!postContent || typeof postContent !== 'string') {
    return { isBait: false };
  }

  // Normalize content - lowercase and collapse whitespace
  const normalizedContent = postContent.toLowerCase().trim();

  // Skip very short posts (likely not enough context to determine)
  if (normalizedContent.length < 20) {
    return { isBait: false };
  }

  for (const pattern of ENGAGEMENT_BAIT_PATTERNS) {
    if (pattern.test(normalizedContent)) {
      // Extract matched portion for logging
      const match = normalizedContent.match(pattern);
      return {
        isBait: true,
        matchedPattern: match ? match[0].substring(0, 50) : 'pattern matched'
      };
    }
  }

  return { isBait: false };
}

async function resolveCorrectUrn(
  activityUrn: string,
  unipileAccountId: string
): Promise<{ socialId: string; authorName?: string; authorHeadline?: string; postContent?: string } | null> {
  try {
    // Query Unipile with the activity URN to get the actual post details
    const response = await fetch(
      `${UNIPILE_BASE_URL}/api/v1/posts/${encodeURIComponent(activityUrn)}?account_id=${unipileAccountId}`,
      {
        method: 'GET',
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.warn(`⚠️ Could not resolve URN from Unipile: ${response.status}`);
      return null;
    }

    const data = await response.json();

    // Unipile returns the correct social_id (usually ugcPost format)
    if (data.social_id) {
      console.log(`✅ Resolved URN: ${activityUrn} → ${data.social_id}`);
      // Extract post content - Unipile uses 'text' or 'body' fields
      const postContent = data.text || data.body || data.content || '';
      return {
        socialId: data.social_id,
        authorName: data.author?.name,
        authorHeadline: data.author?.headline,
        postContent: postContent
      };
    }

    return null;
  } catch (error) {
    console.error(`❌ Error resolving URN:`, error);
    return null;
  }
}

/**
 * LinkedIn Post Discovery using Apify
 *
 * This endpoint scrapes LinkedIn profiles AND hashtags using Apify and stores posts.
 * Supports two monitor types:
 * - PROFILE:vanity_name - Scrapes posts from a specific LinkedIn profile
 * - HASHTAG:keyword - Searches posts by hashtag/keyword (e.g., #genAI, #sales)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = supabaseAdmin();

    console.log('🔍 Starting Apify-based post discovery...');

    // Fetch all active monitors
    const { data: monitors, error: monitorsError } = await supabase
      .from('linkedin_post_monitors')
      .select('*')
      .eq('status', 'active');

    if (monitorsError) {
      console.error('❌ Error fetching monitors:', monitorsError);
      return NextResponse.json({ error: monitorsError.message }, { status: 500 });
    }

    if (!monitors || monitors.length === 0) {
      return NextResponse.json({ message: 'No active monitors', discovered: 0 });
    }

    console.log(`📋 Found ${monitors.length} active monitors`);

    // Filter for profile monitors (PROFILE:vanity_name)
    const profileMonitors = monitors.filter(m =>
      m.hashtags?.some((h: string) => h.startsWith('PROFILE:'))
    );

    console.log(`👤 Processing ${profileMonitors.length} profile monitors`);

    // Filter for hashtag monitors (HASHTAG:keyword)
    const hashtagMonitors = monitors.filter(m =>
      m.hashtags?.some((h: string) => h.startsWith('HASHTAG:'))
    );

    console.log(`#️⃣ Processing ${hashtagMonitors.length} hashtag monitors`);

    // Filter for company monitors (COMPANY:company_slug)
    const companyMonitors = monitors.filter(m =>
      m.hashtags?.some((h: string) => h.startsWith('COMPANY:'))
    );

    console.log(`🏢 Processing ${companyMonitors.length} company monitors`);

    let totalDiscovered = 0;
    const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;

    // DAILY LIMIT: Max 25 Apify API calls per workspace per day (across ALL monitor types)
    // Each API call = 1 post returned. 25 calls × $0.005/result = $0.125/day max per workspace
    // Rate limiting is enforced by increment_apify_call_counter() function in database
    const MAX_APIFY_REQUESTS_PER_DAY = 25;
    const today = new Date().toISOString().split('T')[0];

    // Helper function to check and increment Apify call counter
    // Returns true if allowed to make API call, false if limit reached
    const canMakeApifyCall = async (workspaceId: string): Promise<boolean> => {
      const { data, error } = await supabase.rpc('increment_apify_call_counter', {
        p_workspace_id: workspaceId
      });
      if (error) {
        console.error(`❌ Error checking rate limit for ${workspaceId}:`, error);
        // On error, be conservative and block
        return false;
      }
      return data === true;
    };

    // Track API calls made per workspace (for logging, actual limit in DB)
    const workspacePostsToday = new Map<string, number>();

    // Get remaining calls for logging
    const workspaceIdsAll = [...new Set(monitors.map(m => m.workspace_id))];
    for (const wsId of workspaceIdsAll) {
      const { data } = await supabase.rpc('get_remaining_apify_calls', { p_workspace_id: wsId });
      // Store used count (25 - remaining)
      workspacePostsToday.set(wsId, MAX_APIFY_REQUESTS_PER_DAY - (data || 0));
    }

    console.log(`📊 Apify calls used today per workspace:`, Object.fromEntries(workspacePostsToday));

    // Debug: Log hashtag monitors configuration
    const hashtagsBeingSearched = hashtagMonitors.map(m => ({
      id: m.id,
      hashtags: m.hashtags?.filter((h: string) => h.startsWith('HASHTAG:')).map((h: string) => h.replace('HASHTAG:', ''))
    }));
    console.log('🔍 Hashtags being searched:', JSON.stringify(hashtagsBeingSearched));

    // Actor URLs
    const PROFILE_ACTOR = 'apimaestro~linkedin-profile-posts';
    // Custom hashtag actor from InnovareAI Apify organization
    const HASHTAG_ACTOR = 'HTdyczuehykuGguHO';
    // Company actor: Use same profile actor - it works with company vanity names too
    const COMPANY_ACTOR = 'apimaestro~linkedin-profile-posts';

    if (!APIFY_API_TOKEN) {
      console.error('❌ Missing APIFY_API_TOKEN');
      return NextResponse.json({ error: 'Apify API token not configured' }, { status: 500 });
    }

    // Get unique workspace IDs from profile monitors
    const workspaceIds = [...new Set(profileMonitors.map(m => m.workspace_id))];

    // Load settings for each workspace
    const { data: workspaceSettings } = await supabase
      .from('linkedin_brand_guidelines')
      .select('workspace_id, profile_scrape_interval_days, max_profile_scrapes_per_day')
      .in('workspace_id', workspaceIds);

    const settingsMap = new Map(
      (workspaceSettings || []).map(s => [s.workspace_id, s])
    );

    // Track scrapes per workspace today
    const scrapesPerWorkspace = new Map<string, number>();
    // Note: 'today' is already declared above for daily limit tracking

    // Process each profile monitor with rate limiting
    let profilesScrapedThisRun = 0;
    const MAX_PROFILES_PER_RUN = 20; // Hard limit per run

    for (const monitor of profileMonitors) {
      try {
        // Check hard limit per run
        if (profilesScrapedThisRun >= MAX_PROFILES_PER_RUN) {
          console.log(`⏸️ Reached max profiles per run (${MAX_PROFILES_PER_RUN}), stopping`);
          break;
        }

        // UNIFIED DAILY LIMIT: 25 API calls per workspace per day (across all monitor types)
        // Check and increment counter atomically using database function
        const canProceed = await canMakeApifyCall(monitor.workspace_id);
        if (!canProceed) {
          const currentDailyCount = workspacePostsToday.get(monitor.workspace_id) || 0;
          console.log(`⏸️ Workspace ${monitor.workspace_id} hit daily Apify limit (${currentDailyCount}/${MAX_APIFY_REQUESTS_PER_DAY})`);
          continue;
        }
        // Increment local counter for logging
        workspacePostsToday.set(monitor.workspace_id, (workspacePostsToday.get(monitor.workspace_id) || 0) + 1);

        const settings = settingsMap.get(monitor.workspace_id) || {
          profile_scrape_interval_days: 1
        };

        // Check if this monitor was scraped recently
        const lastScrapedAt = monitor.last_scraped_at ? new Date(monitor.last_scraped_at) : null;
        if (lastScrapedAt) {
          const daysSinceLastScrape = (Date.now() - lastScrapedAt.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceLastScrape < settings.profile_scrape_interval_days) {
            console.log(`⏸️ Skipping monitor ${monitor.id} - scraped ${daysSinceLastScrape.toFixed(1)} days ago (interval: ${settings.profile_scrape_interval_days} days)`);
            continue;
          }
        }

        // Reset daily counter if it's a new day
        if (monitor.scrape_count_reset_date !== today) {
          await supabase
            .from('linkedin_post_monitors')
            .update({
              scrapes_today: 0,
              scrape_count_reset_date: today
            })
            .eq('id', monitor.id);
        }

        const profileHashtag = monitor.hashtags.find((h: string) => h.startsWith('PROFILE:'));
        if (!profileHashtag) continue;

        const vanityName = profileHashtag.replace('PROFILE:', '').replace(/\/$/, '');
        console.log(`\n🔍 Scraping profile: ${vanityName}`);

        // Start Apify actor run (asynchronous)
        console.log(`📡 Starting Apify actor for ${vanityName}...`);

        const startRunUrl = `https://api.apify.com/v2/acts/${PROFILE_ACTOR}/runs?token=${APIFY_API_TOKEN}`;

        const startResponse = await fetch(startRunUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: vanityName,
            page_number: 1,
            total_posts: 1  // Only scrape 1 post per profile
          })
        });

        if (!startResponse.ok) {
          console.error(`❌ Failed to start Apify actor: ${startResponse.status}`);
          const errorText = await startResponse.text();
          console.error(`   Error: ${errorText}`);
          continue;
        }

        const runData = await startResponse.json();
        const runId = runData.data.id;
        const defaultDatasetId = runData.data.defaultDatasetId;

        console.log(`⏳ Waiting for run ${runId} to complete...`);

        // Poll for completion (wait up to 60 seconds)
        let attempts = 0;
        let runComplete = false;

        while (attempts < 60 && !runComplete) {
          await new Promise(resolve => setTimeout(resolve, 1000));

          const statusResponse = await fetch(
            `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`
          );

          if (statusResponse.ok) {
            const status = await statusResponse.json();
            if (status.data.status === 'SUCCEEDED') {
              runComplete = true;
              console.log(`✅ Run completed successfully`);
            } else if (status.data.status === 'FAILED') {
              console.error(`❌ Run failed`);
              break;
            }
          }
          attempts++;
        }

        if (!runComplete) {
          console.error(`❌ Run timed out after 60 seconds`);
          continue;
        }

        // Get dataset items
        const datasetUrl = `https://api.apify.com/v2/datasets/${defaultDatasetId}/items?token=${APIFY_API_TOKEN}`;
        const dataResponse = await fetch(datasetUrl);

        if (!dataResponse.ok) {
          console.error(`❌ Failed to get dataset items: ${dataResponse.status}`);
          continue;
        }

        const data = await dataResponse.json();

        // Log the raw response structure for debugging
        console.log(`📦 Raw Apify response:`, JSON.stringify(data).substring(0, 500));

        // Apify apimaestro actor returns an array of posts directly: [{...}, {...}]
        const posts = Array.isArray(data) ? data : [];

        console.log(`📦 Apify returned ${posts.length} posts`);

        if (!posts || posts.length === 0) {
          console.log(`⚠️ No posts found for ${vanityName}`);
          continue;
        }

        console.log(`📝 Found ${posts.length} posts from profile`);

        if (posts.length === 0) continue;

        // Filter posts by age (last 7 days)
        // Fresh posts get more visibility when commented on quickly
        // Note: 30 minutes was too aggressive - most hashtag search results are older
        const maxAgeDays = 7;
        const cutoffDate = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);

        const recentPosts = posts.filter((post: any) => {
          // Apify returns timestamp in milliseconds
          const postTimestamp = post.posted_at?.timestamp;
          if (!postTimestamp) return false;
          return postTimestamp >= cutoffDate;
        });

        console.log(`⏰ Found ${recentPosts.length} posts from last ${maxAgeDays} days`);

        // Check which posts already exist (check both URL and social_id)
        const existingUrls = recentPosts.map((p: any) => p.url).filter(Boolean);

        // Extract original social_ids from Apify response for duplicate checking
        // We preserve the original URN format but also extract numeric IDs for robust matching
        const existingSocialIds = recentPosts
          .map((p: any) => p.urn?.activity_urn || p.full_urn)
          .filter(Boolean);

        // Query existing posts - check by URL or by original social_id
        const { data: existingPosts } = await supabase
          .from('linkedin_posts_discovered')
          .select('share_url, social_id')
          .eq('workspace_id', monitor.workspace_id)
          .or(`share_url.in.(${existingUrls.join(',')}),social_id.in.(${existingSocialIds.join(',')})`);

        const existingUrlSet = new Set(existingPosts?.map(p => p.share_url) || []);
        // Extract numeric IDs from existing DB records for robust comparison
        const existingDbNumericIds = new Set(
          existingPosts?.map(p => {
            const match = String(p.social_id || '').match(/(\d{16,20})/);
            return match ? match[1] : null;
          }).filter(Boolean) || []
        );

        const newPostsRaw = recentPosts.filter((p: any) => {
          // Check URL first
          if (existingUrlSet.has(p.url)) return false;

          // Compare using numeric ID (handles any URN format variation)
          const socialId = p.urn?.activity_urn || p.full_urn;
          if (!socialId) return true; // No social_id, assume new

          const numericMatch = String(socialId).match(/(\d{16,20})/);
          if (numericMatch && existingDbNumericIds.has(numericMatch[1])) {
            return false; // Numeric ID already exists
          }

          return true;
        });

        // FILTER OUT UNWANTED POSTS
        // Skip hiring posts and engagement bait posts
        let hiringSkipped = 0;
        let engagementBaitSkipped = 0;
        let authorCooldownSkipped = 0;

        // Get authors we've commented on in the last 10 days (author cooldown)
        const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recentComments } = await supabase
          .from('linkedin_post_comments')
          .select('post:linkedin_posts_discovered!inner(author_profile_id)')
          .eq('workspace_id', monitor.workspace_id)
          .in('status', ['posted', 'scheduled'])
          .gte('created_at', tenDaysAgo);

        const recentlyCommentedAuthors = new Set(
          (recentComments || [])
            .map((c: any) => c.post?.author_profile_id)
            .filter(Boolean)
        );
        console.log(`🔄 Authors with recent comments (10d cooldown): ${recentlyCommentedAuthors.size}`);

        const newPosts = newPostsRaw.filter((p: any) => {
          const postContent = p.text || '';
          const authorProfileId = p.author?.username || vanityName;

          // Check author 10-day cooldown
          if (recentlyCommentedAuthors.has(authorProfileId)) {
            authorCooldownSkipped++;
            console.log(`⏳ Skipping post - author ${authorProfileId} commented on within 10 days`);
            return false;
          }

          // Check for hiring posts first
          const hiringCheck = isHiringPost(postContent);
          if (hiringCheck.isHiring) {
            hiringSkipped++;
            console.log(`💼 Skipping hiring post: "${hiringCheck.matchedPattern}" - ${postContent.substring(0, 80)}...`);
            return false;
          }

          // Check for engagement bait
          const baitCheck = isEngagementBait(postContent);
          if (baitCheck.isBait) {
            engagementBaitSkipped++;
            console.log(`🚫 Skipping engagement bait post: "${baitCheck.matchedPattern}" - ${postContent.substring(0, 80)}...`);
            return false;
          }
          return true;
        });

        if (authorCooldownSkipped > 0) {
          console.log(`⏳ Filtered out ${authorCooldownSkipped} posts (10-day author cooldown)`);
        }
        if (hiringSkipped > 0) {
          console.log(`💼 Filtered out ${hiringSkipped} hiring posts`);
        }
        if (engagementBaitSkipped > 0) {
          console.log(`🚫 Filtered out ${engagementBaitSkipped} engagement bait posts`);
        }

        console.log(`🆕 Found ${newPosts.length} new posts to store (${recentPosts.length - newPostsRaw.length} already exist, ${authorCooldownSkipped} author cooldown, ${hiringSkipped} hiring, ${engagementBaitSkipped} bait)`);

        // Store new posts
        if (newPosts.length > 0) {
          // Get Unipile account for this workspace to resolve correct URNs
          const { data: linkedinAccount } = await supabase
            .from('workspace_accounts')
            .select('unipile_account_id')
            .eq('workspace_id', monitor.workspace_id)
            .eq('account_type', 'linkedin')
            .eq('connection_status', 'connected')
            .limit(1)
            .single();

          const unipileAccountId = linkedinAccount?.unipile_account_id;

          // CRITICAL: Resolve correct URNs from Unipile before storing
          // Apify returns activity URNs from URLs, but Unipile needs ugcPost URNs to post comments
          // These have DIFFERENT numeric IDs!
          const postsToInsert = await Promise.all(newPosts.map(async (post: any) => {
            let apifySocialId = post.urn?.activity_urn || post.full_urn;

            // Normalize to URN format if just a number
            if (apifySocialId && /^\d+$/.test(apifySocialId)) {
              apifySocialId = `urn:li:activity:${apifySocialId}`;
            }

            // Resolve the correct URN from Unipile (activity → ugcPost)
            let finalSocialId = apifySocialId;
            let resolvedAuthor: { authorName?: string; authorHeadline?: string } = {};

            if (unipileAccountId && apifySocialId) {
              const resolved = await resolveCorrectUrn(apifySocialId, unipileAccountId);
              if (resolved) {
                finalSocialId = resolved.socialId;
                resolvedAuthor = {
                  authorName: resolved.authorName,
                  authorHeadline: resolved.authorHeadline
                };
              }
            }

            return {
              workspace_id: monitor.workspace_id,
              monitor_id: monitor.id,
              social_id: finalSocialId,
              share_url: post.url || `https://www.linkedin.com/feed/update/${post.full_urn}`,
              post_content: post.text || '',
              author_name: resolvedAuthor.authorName || (post.author?.first_name ? `${post.author.first_name} ${post.author.last_name || ''}`.trim() : vanityName),
              author_profile_id: post.author?.username || vanityName,
              author_title: resolvedAuthor.authorHeadline || post.author?.headline || post.author?.title || null,
              author_headline: resolvedAuthor.authorHeadline || post.author?.headline || post.author?.title || null,
              hashtags: [],
              post_date: new Date(post.posted_at?.timestamp).toISOString(),
              engagement_metrics: {
                comments: post.stats?.comments_count || 0,
                reactions: post.stats?.total_reactions || 0,
                reposts: post.stats?.reposts_count || 0
              },
              status: 'discovered'
            };
          }));

          const { data: insertedPosts, error: insertError } = await supabase
            .from('linkedin_posts_discovered')
            .insert(postsToInsert)
            .select();

          if (insertError) {
            // Check if it's a duplicate key error (unique constraint violation)
            if (insertError.code === '23505') {
              console.warn(`⚠️ Some posts already exist (duplicate prevented by database constraint)`);
              // Count how many were actually inserted by checking again
              const { count } = await supabase
                .from('linkedin_posts_discovered')
                .select('*', { count: 'exact', head: true })
                .eq('monitor_id', monitor.id)
                .gte('created_at', new Date(Date.now() - 60000).toISOString()); // Last minute

              if (count && count > 0) {
                totalDiscovered += count;
                console.log(`✅ Stored ${count} new posts (duplicates skipped)`);
              }
            } else {
              console.error(`❌ Error inserting posts:`, insertError);
            }
          } else {
            totalDiscovered += newPosts.length;
            // Update daily counter for this workspace
            workspacePostsToday.set(monitor.workspace_id, (workspacePostsToday.get(monitor.workspace_id) || 0) + newPosts.length);
            console.log(`✅ Stored ${newPosts.length} new posts (workspace daily total: ${workspacePostsToday.get(monitor.workspace_id)}/${MAX_APIFY_REQUESTS_PER_DAY})`);

            // 🤖 AUTO-GENERATE COMMENTS FOR NEW POSTS
            if (insertedPosts && insertedPosts.length > 0) {
              console.log(`🤖 Auto-generating comments for ${insertedPosts.length} new posts...`);

              // Trigger comment generation in background
              // Don't await - let it run async so discovery completes faster
              fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com'}/api/linkedin-commenting/auto-generate-comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  post_ids: insertedPosts.map(p => p.id),
                  workspace_id: monitor.workspace_id,
                  monitor_id: monitor.id
                })
              }).catch(err => console.error('❌ Error triggering auto-comment generation:', err));
            }
          }
        }

        // Update monitor tracking after successful scrape
        await supabase
          .from('linkedin_post_monitors')
          .update({
            last_scraped_at: new Date().toISOString(),
            scrapes_today: (monitor.scrapes_today || 0) + 1,
            scrape_count_reset_date: today
          })
          .eq('id', monitor.id);

        // Update tracking counters
        profilesScrapedThisRun++;
        scrapesPerWorkspace.set(
          monitor.workspace_id,
          (scrapesPerWorkspace.get(monitor.workspace_id) || 0) + 1
        );

        console.log(`📊 Profile scrapes this run: ${profilesScrapedThisRun}, workspace today: ${scrapesPerWorkspace.get(monitor.workspace_id)}`);

      } catch (error) {
        console.error(`❌ Error processing monitor ${monitor.id}:`, error);
        continue;
      }
    }

    // Process hashtag monitors - ONE AT A TIME (round-robin by last_scraped_at)
    // This prevents Netlify timeout (60s) since the Apify actor can take 8+ minutes for all hashtags
    // Sort by last_scraped_at (oldest first) to ensure fair rotation
    const sortedHashtagMonitors = [...hashtagMonitors].sort((a, b) => {
      const aTime = a.last_scraped_at ? new Date(a.last_scraped_at).getTime() : 0;
      const bTime = b.last_scraped_at ? new Date(b.last_scraped_at).getTime() : 0;
      return aTime - bTime; // Oldest first
    });

    // Only process ONE hashtag monitor per cron run
    const hashtagMonitorToProcess = sortedHashtagMonitors[0];
    const hashtagMonitorsToProcess = hashtagMonitorToProcess ? [hashtagMonitorToProcess] : [];

    // Debug collector for response
    const hashtagDebug: any = {
      runsFound: 0,
      runsChecked: 0,
      runMatchedId: null,
      datasetId: null,
      rawPostsCount: 0,
      matchingPostsCount: 0,
      newPostsCount: 0,
      insertedCount: 0,
      error: null
    };

    console.log(`#️⃣ Processing 1 of ${hashtagMonitors.length} hashtag monitors (round-robin by last_scraped_at)`);
    if (hashtagMonitorToProcess) {
      const hashtagEntry = hashtagMonitorToProcess.hashtags?.find((h: string) => h.startsWith('HASHTAG:'));
      console.log(`   Selected: ${hashtagEntry?.replace('HASHTAG:', '')} (last scraped: ${hashtagMonitorToProcess.last_scraped_at || 'never'})`);
    }

    for (const monitor of hashtagMonitorsToProcess) {
      try {
        // UNIFIED DAILY LIMIT: 25 API calls per workspace per day (across all monitor types)
        const canProceedHashtag = await canMakeApifyCall(monitor.workspace_id);
        if (!canProceedHashtag) {
          const currentDailyCount = workspacePostsToday.get(monitor.workspace_id) || 0;
          console.log(`⏸️ Workspace ${monitor.workspace_id} hit daily Apify limit (${currentDailyCount}/${MAX_APIFY_REQUESTS_PER_DAY}), skipping hashtag monitors`);
          continue;
        }
        // Increment local counter for logging
        workspacePostsToday.set(monitor.workspace_id, (workspacePostsToday.get(monitor.workspace_id) || 0) + 1);

        const hashtagEntry = monitor.hashtags.find((h: string) => h.startsWith('HASHTAG:'));
        if (!hashtagEntry) continue;

        const keyword = hashtagEntry.replace('HASHTAG:', '').trim();
        const currentDailyCount = workspacePostsToday.get(monitor.workspace_id) || 0;
        console.log(`\n#️⃣ Processing hashtag: ${keyword} (workspace daily: ${currentDailyCount}/${MAX_APIFY_REQUESTS_PER_DAY})`);

        // ASYNC POLLING APPROACH:
        // 1. Check for completed runs from previous cron invocations
        // 2. If no completed run found, start a new one (don't wait)
        // 3. Process any completed results

        const hashtagWithPrefix = keyword.startsWith('#') ? keyword : `#${keyword}`;
        const POSTS_PER_HASHTAG = 10;

        // Step 1: Check for recent runs (SUCCEEDED or ABORTED with data) for this actor (last 2 hours)
        // Note: ABORTED runs can still have partial data we can use
        console.log(`🔍 Checking for completed Apify runs for #${keyword}...`);
        const runsListUrl = `https://api.apify.com/v2/acts/${HASHTAG_ACTOR}/runs?token=${APIFY_API_TOKEN}&limit=10`;

        let datasetId: string | null = null;
        let runId: string | null = null;

        try {
          const runsResponse = await fetch(runsListUrl);
          if (runsResponse.ok) {
            const runsData = await runsResponse.json();
            const recentRuns = runsData.data?.items || [];
            hashtagDebug.runsFound = recentRuns.length;
            console.log(`📋 Found ${recentRuns.length} total Apify runs to check`);

            // Find a run that matches our hashtag (SUCCEEDED or ABORTED with data)
            for (const run of recentRuns) {
              hashtagDebug.runsChecked++;
              console.log(`   Checking run ${run.id}: status=${run.status}, age=${Math.round((Date.now() - new Date(run.startedAt).getTime()) / 60000)}min`);
              // Skip RUNNING runs - they're not ready yet
              if (run.status === 'RUNNING' || run.status === 'READY') continue;

              // Check if this run was for our hashtag (within last 2 hours)
              const runAge = Date.now() - new Date(run.startedAt).getTime();
              const twoHoursMs = 2 * 60 * 60 * 1000;

              if (runAge < twoHoursMs && (run.status === 'SUCCEEDED' || run.status === 'ABORTED')) {
                // Fetch the run's input to check which hashtag it was for
                const inputUrl = `https://api.apify.com/v2/key-value-stores/${run.defaultKeyValueStoreId}/records/INPUT?token=${APIFY_API_TOKEN}`;
                const inputResponse = await fetch(inputUrl);

                if (inputResponse.ok) {
                  const inputData = await inputResponse.json();
                  // Handle all input formats: {hashtags: ["#foo"]}, {hashtag: "#foo"}, {keyword: "foo"}
                  // Normalize by stripping # prefix and lowercasing for comparison
                  const normalizeHashtag = (h: string) => h.replace(/^#+/, '').toLowerCase();
                  const keywordNormalized = normalizeHashtag(keyword);

                  let runHashtags: string[] = [];
                  if (inputData.hashtags && Array.isArray(inputData.hashtags)) {
                    runHashtags = inputData.hashtags;
                  } else if (inputData.hashtag) {
                    runHashtags = [inputData.hashtag];
                  } else if (inputData.keyword) {
                    runHashtags = [inputData.keyword];
                  }

                  const runHashtagsNormalized = runHashtags.map(normalizeHashtag);
                  console.log(`      Input hashtags: ${JSON.stringify(runHashtags)} → ${JSON.stringify(runHashtagsNormalized)}, looking for: ${keywordNormalized}`);

                  if (runHashtagsNormalized.includes(keywordNormalized)) {
                    // CRITICAL FIX (Dec 4): Check if dataset has items before using
                    // SUCCEEDED runs can have 0 items, while ABORTED runs may have partial data
                    const datasetInfoUrl = `https://api.apify.com/v2/datasets/${run.defaultDatasetId}?token=${APIFY_API_TOKEN}`;
                    const datasetInfoResponse = await fetch(datasetInfoUrl);
                    if (datasetInfoResponse.ok) {
                      const datasetInfo = await datasetInfoResponse.json();
                      const itemCount = datasetInfo.data?.itemCount || 0;
                      if (itemCount === 0) {
                        console.log(`⚠️ Run ${run.id} (${run.status}) has 0 items, checking next run...`);
                        continue; // Skip runs with no items
                      }
                      console.log(`✅ Found run ${run.id} (${run.status}) for #${keyword} with ${itemCount} items (${Math.round(runAge / 60000)} min ago)`);
                    } else {
                      console.log(`✅ Found completed run ${run.id} for #${keyword} from ${Math.round(runAge / 60000)} minutes ago`);
                    }
                    datasetId = run.defaultDatasetId;
                    runId = run.id;
                    hashtagDebug.runMatchedId = run.id;
                    hashtagDebug.datasetId = run.defaultDatasetId;
                    break;
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error(`⚠️ Error checking existing runs:`, error);
          hashtagDebug.error = error instanceof Error ? error.message : String(error);
        }

        // Step 2: Check if there's already a RUNNING run for this hashtag (avoid duplicates)
        let runAlreadyInProgress = false;
        if (!datasetId) {
          try {
            const runningUrl = `https://api.apify.com/v2/acts/${HASHTAG_ACTOR}/runs?token=${APIFY_API_TOKEN}&status=RUNNING&limit=5`;
            const runningResponse = await fetch(runningUrl);
            if (runningResponse.ok) {
              const runningData = await runningResponse.json();
              for (const run of runningData.data?.items || []) {
                const inputUrl = `https://api.apify.com/v2/key-value-stores/${run.defaultKeyValueStoreId}/records/INPUT?token=${APIFY_API_TOKEN}`;
                const inputResponse = await fetch(inputUrl);
                if (inputResponse.ok) {
                  const inputData = await inputResponse.json();
                  // Handle all input formats with normalization
                  const normalizeHashtag = (h: string) => h.replace(/^#+/, '').toLowerCase();
                  const keywordNormalized = normalizeHashtag(keyword);

                  let runHashtags: string[] = [];
                  if (inputData.hashtags && Array.isArray(inputData.hashtags)) {
                    runHashtags = inputData.hashtags;
                  } else if (inputData.hashtag) {
                    runHashtags = [inputData.hashtag];
                  } else if (inputData.keyword) {
                    runHashtags = [inputData.keyword];
                  }

                  const runHashtagsNormalized = runHashtags.map(normalizeHashtag);
                  if (runHashtagsNormalized.includes(keywordNormalized)) {
                    console.log(`⏳ Run already in progress for #${keyword} (run ${run.id}). Skipping to avoid duplicate costs.`);
                    runAlreadyInProgress = true;
                    break;
                  }
                }
              }
            }
          } catch (e) {
            console.warn(`⚠️ Error checking running jobs:`, e);
          }

          if (runAlreadyInProgress) {
            // Update last_scraped_at anyway to rotate to next hashtag
            await supabase
              .from('linkedin_post_monitors')
              .update({ last_scraped_at: new Date().toISOString() })
              .eq('id', monitor.id);
            continue; // Skip this monitor
          }

          console.log(`📡 No completed/running run found. Starting new Apify run for #${keyword}...`);

          // Start WITHOUT waitForFinish - returns immediately
          const startRunUrl = `https://api.apify.com/v2/acts/${HASHTAG_ACTOR}/runs?token=${APIFY_API_TOKEN}`;

          // Actor parameters: hashtag (singular string), maxPages (limits Google pages searched)
          // The actor searches Google for "site:linkedin.com #hashtag" so more pages = more results
          const startResponse = await fetch(startRunUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              hashtag: hashtagWithPrefix, // Use singular hashtag parameter
              maxPages: 2 // Limit to 2 Google pages (~20 results) to save credits
            })
          });

          if (!startResponse.ok) {
            console.error(`❌ Failed to start Apify hashtag actor: ${startResponse.status}`);
            const errorText = await startResponse.text();
            console.error(`   Error: ${errorText}`);
            continue;
          }

          const runData = await startResponse.json();
          runId = runData.data?.id;
          const runStatus = runData.data?.status;

          console.log(`🚀 Started Apify run ${runId} (status: ${runStatus})`);
          console.log(`   Results will be available on next cron run (~5-10 minutes)`);

          // Update last_scraped_at to mark this monitor as recently processed
          await supabase
            .from('linkedin_post_monitors')
            .update({ last_scraped_at: new Date().toISOString() })
            .eq('id', monitor.id);

          continue; // Move to next monitor, results will be fetched on next cron run
        }

        if (!datasetId) {
          console.log(`❌ No datasetId found after run search - this shouldn't happen!`);
          continue;
        }
        console.log(`📦 Fetching results from dataset ${datasetId} (run ${runId})...`);

        // Get dataset items
        const datasetUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}`;
        const dataResponse = await fetch(datasetUrl);

        if (!dataResponse.ok) {
          console.error(`❌ Failed to get hashtag dataset items: ${dataResponse.status}`);
          continue;
        }

        const data = await dataResponse.json();

        // Log the raw response structure for debugging
        console.log(`📦 Raw Apify hashtag response:`, JSON.stringify(data).substring(0, 500));

        // Hashtag search actor returns array of posts
        // Actor returns: {author_name, hashtag, post_url}
        // CRITICAL: Filter by our target hashtag - runs may contain mixed results from multiple hashtags
        const rawPosts = Array.isArray(data) ? data : [];
        // CRITICAL FIX: Actor returns hashtags with double ## (e.g., "##genai")
        // Strip ALL leading # characters, not just one
        const normalizeHashtag = (h: string) => h.replace(/^#+/, '').toLowerCase();
        const keywordNormalized = normalizeHashtag(keyword);

        // Filter posts to only those matching our target hashtag
        const matchingPosts = rawPosts.filter((p: any) => {
          const postHashtag = p.hashtag ? normalizeHashtag(p.hashtag) : '';
          return postHashtag === keywordNormalized;
        });

        hashtagDebug.rawPostsCount = rawPosts.length;
        hashtagDebug.matchingPostsCount = matchingPosts.length;
        console.log(`📦 Apify returned ${rawPosts.length} total, ${matchingPosts.length} match #${keyword}`);

        // SAFETY: Slice to our limit even if Apify returns more (they charge per result!)
        const posts = matchingPosts.slice(0, POSTS_PER_HASHTAG);

        console.log(`📦 Using ${posts.length} posts for #${keyword}`);

        if (!posts || posts.length === 0) {
          console.log(`⚠️ No posts found for hashtag #${keyword}`);
          continue;
        }

        // Filter posts by age (last 7 days for hashtag searches)
        // CRITICAL FIX (Dec 4): Was 30 minutes - too aggressive, filtered out all posts
        // Hashtag searches return posts by relevance, not recency, so most are hours/days old
        const maxAgeDays = 7;
        const cutoffDate = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);

        // Debug: Log first post structure to understand the data format
        if (posts.length > 0) {
          console.log(`🔬 First hashtag post structure:`, JSON.stringify(posts[0], null, 2).substring(0, 1000));
        }

        const recentPosts = posts.filter((post: any) => {
          // Hashtag actor may use different timestamp field
          const postTimestamp = post.postedAt || post.posted_at?.timestamp || post.timestamp || post.date;
          if (!postTimestamp) {
            console.log(`⚠️ Post has no timestamp, including anyway (can't verify freshness)`);
            return true; // Include posts without timestamp - let other filters handle quality
          }
          const ts = typeof postTimestamp === 'number' ? postTimestamp : new Date(postTimestamp).getTime();
          const isRecent = ts >= cutoffDate;
          if (!isRecent) {
            console.log(`⏰ Post filtered out - older than ${maxAgeDays} days: ${new Date(ts).toISOString()}`);
          }
          return isRecent;
        });

        console.log(`⏰ Found ${recentPosts.length} posts from last ${maxAgeDays} days (filtered ${posts.length - recentPosts.length})`);

        // Check which posts already exist
        // Actor HTdyczuehykuGguHO returns: {author_name, hashtag, post_url}
        // Extract activity ID from post_url: https://www.linkedin.com/posts/username_hashtag-activity-7402050035590623232-xxxx
        const extractActivityId = (url: string): string | null => {
          const match = url?.match(/-activity-(\d+)/);
          return match ? match[1] : null;
        };

        const extractAuthorVanity = (url: string): string | null => {
          // URL format: /posts/username_hashtag-activity-... OR /posts/username-hashtag-activity-...
          const match = url?.match(/\/posts\/([^_-]+)/);
          return match ? match[1] : null;
        };

        const existingUrls = recentPosts.map((p: any) => p.post_url).filter(Boolean);

        // Extract activity IDs from URLs for duplicate checking
        const existingSocialIds = recentPosts
          .map((p: any) => {
            const activityId = extractActivityId(p.post_url);
            return activityId ? `urn:li:activity:${activityId}` : null;
          })
          .filter(Boolean);

        const { data: existingPosts } = await supabase
          .from('linkedin_posts_discovered')
          .select('share_url, social_id')
          .eq('workspace_id', monitor.workspace_id)
          .or(`share_url.in.(${existingUrls.join(',')}),social_id.in.(${existingSocialIds.join(',')})`);

        const existingUrlSet = new Set(existingPosts?.map(p => p.share_url) || []);
        // Extract numeric IDs from DB for robust comparison across URN formats
        const existingDbNumericIds = new Set(
          existingPosts?.map(p => {
            const match = String(p.social_id || '').match(/(\d{16,20})/);
            return match ? match[1] : null;
          }).filter(Boolean) || []
        );

        const newPostsRaw = recentPosts.filter((p: any) => {
          const url = p.post_url;
          if (!url) return false; // Skip posts without URL
          if (existingUrlSet.has(url)) return false;

          // Extract activity ID from URL and compare
          const activityId = extractActivityId(url);
          if (activityId && existingDbNumericIds.has(activityId)) {
            return false; // Numeric ID already exists
          }

          return true;
        });

        // FILTER OUT UNWANTED POSTS
        // Skip hiring posts, engagement bait, and authors on 10-day cooldown
        let hiringSkipped = 0;
        let engagementBaitSkipped = 0;
        let authorCooldownSkipped = 0;

        // Get authors we've commented on in the last 10 days (author cooldown)
        const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recentComments } = await supabase
          .from('linkedin_post_comments')
          .select('post:linkedin_posts_discovered!inner(author_profile_id)')
          .eq('workspace_id', monitor.workspace_id)
          .in('status', ['posted', 'scheduled'])
          .gte('created_at', tenDaysAgo);

        const recentlyCommentedAuthors = new Set(
          (recentComments || [])
            .map((c: any) => c.post?.author_profile_id)
            .filter(Boolean)
        );
        console.log(`🔄 Hashtag: Authors with recent comments (10d cooldown): ${recentlyCommentedAuthors.size}`);

        const newPosts = newPostsRaw.filter((p: any) => {
          // Actor HTdyczuehykuGguHO only returns {author_name, hashtag, post_url}
          // Extract author vanity from post_url for cooldown check
          const authorProfileId = extractAuthorVanity(p.post_url);

          // Check author 10-day cooldown
          if (authorProfileId && recentlyCommentedAuthors.has(authorProfileId)) {
            authorCooldownSkipped++;
            console.log(`⏳ Skipping hashtag post - author ${authorProfileId} commented on within 10 days`);
            return false;
          }

          // NOTE: Actor HTdyczuehykuGguHO only returns URLs, not post content
          // Hiring and engagement bait filtering will happen during comment generation
          // when we fetch the full post content via Unipile/resolveCorrectUrn
          return true;
        });

        if (authorCooldownSkipped > 0) {
          console.log(`⏳ Filtered out ${authorCooldownSkipped} hashtag posts (10-day author cooldown)`);
        }
        if (hiringSkipped > 0) {
          console.log(`💼 Filtered out ${hiringSkipped} hiring hashtag posts`);
        }
        if (engagementBaitSkipped > 0) {
          console.log(`🚫 Filtered out ${engagementBaitSkipped} engagement bait hashtag posts`);
        }

        hashtagDebug.newPostsCount = newPosts.length;
        console.log(`🆕 Found ${newPosts.length} new hashtag posts to store (${recentPosts.length - newPostsRaw.length} exist, ${authorCooldownSkipped} cooldown, ${hiringSkipped} hiring, ${engagementBaitSkipped} bait)`);

        // Store new posts
        if (newPosts.length > 0) {
          // Get Unipile account for this workspace to resolve correct URNs
          const { data: linkedinAccount } = await supabase
            .from('workspace_accounts')
            .select('unipile_account_id')
            .eq('workspace_id', monitor.workspace_id)
            .eq('account_type', 'linkedin')
            .eq('connection_status', 'connected')
            .limit(1)
            .single();

          const unipileAccountId = linkedinAccount?.unipile_account_id;

          // Actor HTdyczuehykuGguHO returns: {author_name, hashtag, post_url}
          // Extract activity ID from URL and resolve via Unipile for correct URN + post content
          const postsToInsert = await Promise.all(newPosts.map(async (post: any) => {
            // Extract activity ID from post_url
            const activityId = extractActivityId(post.post_url);
            const authorVanity = extractAuthorVanity(post.post_url);
            let apifySocialId = activityId ? `urn:li:activity:${activityId}` : null;

            // Resolve the correct URN from Unipile (activity → ugcPost)
            // This also fetches post content, author details, and engagement metrics
            let finalSocialId = apifySocialId;
            let resolvedAuthor: { authorName?: string; authorHeadline?: string } = {};
            let postContent = '';

            if (unipileAccountId && apifySocialId) {
              const resolved = await resolveCorrectUrn(apifySocialId, unipileAccountId);
              if (resolved) {
                finalSocialId = resolved.socialId;
                resolvedAuthor = {
                  authorName: resolved.authorName,
                  authorHeadline: resolved.authorHeadline
                };
                // resolveCorrectUrn may return post content in the future
                postContent = resolved.postContent || '';
              }
            }

            return {
              workspace_id: monitor.workspace_id,
              monitor_id: monitor.id,
              social_id: finalSocialId || apifySocialId,
              share_url: post.post_url,
              post_content: postContent, // Will be empty until fetched via Unipile
              author_name: resolvedAuthor.authorName || post.author_name || 'Unknown',
              author_profile_id: authorVanity || null,
              author_title: resolvedAuthor.authorHeadline || null,
              author_headline: resolvedAuthor.authorHeadline || null,
              hashtags: [keyword],
              post_date: new Date().toISOString(), // Actor doesn't provide date
              engagement_metrics: {
                comments: 0, // Actor doesn't provide engagement stats
                reactions: 0,
                reposts: 0
              },
              status: 'discovered'
            };
          }));

          const { data: insertedPosts, error: insertError } = await supabase
            .from('linkedin_posts_discovered')
            .insert(postsToInsert)
            .select();

          if (insertError) {
            if (insertError.code === '23505') {
              console.warn(`⚠️ Some hashtag posts already exist (duplicate prevented by database constraint)`);
            } else {
              console.error(`❌ Error inserting hashtag posts:`, insertError);
            }
          } else {
            totalDiscovered += newPosts.length;
            // Update daily counter for this workspace
            workspacePostsToday.set(monitor.workspace_id, (workspacePostsToday.get(monitor.workspace_id) || 0) + newPosts.length);
            console.log(`✅ Stored ${newPosts.length} new hashtag posts (workspace daily total: ${workspacePostsToday.get(monitor.workspace_id)}/${MAX_APIFY_REQUESTS_PER_DAY})`);

            // Auto-generate comments for new posts
            if (insertedPosts && insertedPosts.length > 0) {
              console.log(`🤖 Auto-generating comments for ${insertedPosts.length} new hashtag posts...`);

              fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com'}/api/linkedin-commenting/auto-generate-comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  post_ids: insertedPosts.map(p => p.id),
                  workspace_id: monitor.workspace_id,
                  monitor_id: monitor.id
                })
              }).catch(err => console.error('❌ Error triggering auto-comment generation:', err));
            }
          }
        }

        // Update last_scraped_at for round-robin rotation
        await supabase
          .from('linkedin_post_monitors')
          .update({ last_scraped_at: new Date().toISOString() })
          .eq('id', monitor.id);
        console.log(`📅 Updated last_scraped_at for monitor ${monitor.id}`);

      } catch (error) {
        console.error(`❌ Error processing hashtag monitor ${monitor.id}:`, error);
        continue;
      }
    }

    // Process company monitors
    let companiesScrapedThisRun = 0;
    const MAX_COMPANIES_PER_RUN = 3; // Very low limit to avoid timeout

    for (const monitor of companyMonitors) {
      try {
        // Check hard limit per run
        if (companiesScrapedThisRun >= MAX_COMPANIES_PER_RUN) {
          console.log(`⏸️ Reached max companies per run (${MAX_COMPANIES_PER_RUN}), stopping`);
          break;
        }

        // Get all company entries from this monitor
        const companyEntries = monitor.hashtags.filter((h: string) => h.startsWith('COMPANY:'));

        for (const companyEntry of companyEntries) {
          if (companiesScrapedThisRun >= MAX_COMPANIES_PER_RUN) break;

          // UNIFIED DAILY LIMIT: 25 API calls per workspace per day (across all monitor types)
          const canProceedCompany = await canMakeApifyCall(monitor.workspace_id);
          if (!canProceedCompany) {
            const innerDailyCount = workspacePostsToday.get(monitor.workspace_id) || 0;
            console.log(`⏸️ Workspace ${monitor.workspace_id} hit daily Apify limit (${innerDailyCount}/${MAX_APIFY_REQUESTS_PER_DAY}), skipping company`);
            break;
          }
          // Increment local counter for logging
          workspacePostsToday.set(monitor.workspace_id, (workspacePostsToday.get(monitor.workspace_id) || 0) + 1);

          const companySlug = companyEntry.replace('COMPANY:', '').trim();
          const companyDailyCount = workspacePostsToday.get(monitor.workspace_id) || 0;
          console.log(`\n🏢 Scraping company: ${companySlug} (workspace daily: ${companyDailyCount}/${MAX_APIFY_REQUESTS_PER_DAY})`);

          // Start Apify actor run for company posts
          console.log(`📡 Starting Apify company posts actor for ${companySlug}...`);

          const startRunUrl = `https://api.apify.com/v2/acts/${COMPANY_ACTOR}/runs?token=${APIFY_API_TOKEN}&waitForFinish=120`;

          const startResponse = await fetch(startRunUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              // apimaestro profile actor works with company vanity names too
              username: companySlug,
              page_number: 1,
              total_posts: 3
            })
          });

          if (!startResponse.ok) {
            console.error(`❌ Failed to start Apify company actor: ${startResponse.status}`);
            const errorText = await startResponse.text();
            console.error(`   Error: ${errorText}`);
            continue;
          }

          const runData = await startResponse.json();
          const runId = runData.data?.id;
          const defaultDatasetId = runData.data?.defaultDatasetId;
          const runStatus = runData.data?.status;

          console.log(`📊 Apify company run ${runId}: status=${runStatus}, dataset=${defaultDatasetId}`);

          if (runStatus !== 'SUCCEEDED') {
            console.error(`❌ Company posts run did not succeed: ${runStatus}`);
            continue;
          }

          console.log(`✅ Company posts scrape completed successfully`);

          // Get dataset items
          const datasetUrl = `https://api.apify.com/v2/datasets/${defaultDatasetId}/items?token=${APIFY_API_TOKEN}`;
          const dataResponse = await fetch(datasetUrl);

          if (!dataResponse.ok) {
            console.error(`❌ Failed to get company dataset items: ${dataResponse.status}`);
            continue;
          }

          const data = await dataResponse.json();

          // Log the raw response structure for debugging
          console.log(`📦 Raw Apify company response:`, JSON.stringify(data).substring(0, 500));

          const posts = Array.isArray(data) ? data : [];

          console.log(`📦 Apify returned ${posts.length} company posts`);

          if (!posts || posts.length === 0) {
            console.log(`⚠️ No posts found for company ${companySlug}`);
            continue;
          }

          // Filter posts by age (last 7 days for company posts)
          // CRITICAL FIX (Dec 4): Was 30 minutes - too aggressive
          const maxAgeDays = 7;
          const cutoffDate = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);

          const recentPosts = posts.filter((post: any) => {
            const postTimestamp = post.postedAt || post.posted_at?.timestamp || post.timestamp || post.date;
            if (!postTimestamp) return true; // Include posts without timestamp - let other filters handle quality
            const ts = typeof postTimestamp === 'number' ? postTimestamp : new Date(postTimestamp).getTime();
            return ts >= cutoffDate;
          });

          console.log(`⏰ Found ${recentPosts.length} company posts from last ${maxAgeDays} days`);

          // Check which posts already exist
          const existingUrls = recentPosts.map((p: any) => p.post_url || p.url || p.postUrl).filter(Boolean);
          const existingSocialIds = recentPosts
            .map((p: any) => p.full_urn || p.urn || p.postUrn || p.activity_id || p.id)
            .filter(Boolean);

          const { data: existingPosts } = await supabase
            .from('linkedin_posts_discovered')
            .select('share_url, social_id')
            .eq('workspace_id', monitor.workspace_id)
            .or(`share_url.in.(${existingUrls.join(',')}),social_id.in.(${existingSocialIds.join(',')})`);

          const existingUrlSet = new Set(existingPosts?.map(p => p.share_url) || []);
          const existingDbNumericIds = new Set(
            existingPosts?.map(p => {
              const match = String(p.social_id || '').match(/(\d{16,20})/);
              return match ? match[1] : null;
            }).filter(Boolean) || []
          );

          const newPostsRaw = recentPosts.filter((p: any) => {
            const url = p.post_url || p.url || p.postUrl;
            if (existingUrlSet.has(url)) return false;

            const socialId = p.full_urn || p.urn || p.postUrn || p.activity_id || p.id;
            if (!socialId) return true;

            const numericMatch = String(socialId).match(/(\d{16,20})/);
            if (numericMatch && existingDbNumericIds.has(numericMatch[1])) {
              return false;
            }
            return true;
          });

          // Filter out hiring, engagement bait, and authors on 10-day cooldown
          let hiringSkipped = 0;
          let engagementBaitSkipped = 0;
          let authorCooldownSkipped = 0;

          // Get authors we've commented on in the last 10 days (author cooldown)
          const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
          const { data: recentComments } = await supabase
            .from('linkedin_post_comments')
            .select('post:linkedin_posts_discovered!inner(author_profile_id)')
            .eq('workspace_id', monitor.workspace_id)
            .in('status', ['posted', 'scheduled'])
            .gte('created_at', tenDaysAgo);

          const recentlyCommentedAuthors = new Set(
            (recentComments || [])
              .map((c: any) => c.post?.author_profile_id)
              .filter(Boolean)
          );

          const newPosts = newPostsRaw.filter((p: any) => {
            const postContent = p.text || p.content || '';

            // Check author 10-day cooldown (company slug is the author_profile_id)
            if (recentlyCommentedAuthors.has(companySlug)) {
              authorCooldownSkipped++;
              console.log(`⏳ Skipping company post - ${companySlug} commented on within 10 days`);
              return false;
            }

            const hiringCheck = isHiringPost(postContent);
            if (hiringCheck.isHiring) {
              hiringSkipped++;
              console.log(`💼 Skipping hiring company post: "${hiringCheck.matchedPattern}"`);
              return false;
            }

            const baitCheck = isEngagementBait(postContent);
            if (baitCheck.isBait) {
              engagementBaitSkipped++;
              console.log(`🚫 Skipping engagement bait company post: "${baitCheck.matchedPattern}"`);
              return false;
            }
            return true;
          });

          console.log(`🆕 Found ${newPosts.length} new company posts (${authorCooldownSkipped} cooldown, ${hiringSkipped} hiring, ${engagementBaitSkipped} bait)`);

          // Store new posts
          if (newPosts.length > 0) {
            // Get Unipile account for this workspace to resolve correct URNs
            const { data: linkedinAccount } = await supabase
              .from('workspace_accounts')
              .select('unipile_account_id')
              .eq('workspace_id', monitor.workspace_id)
              .eq('account_type', 'linkedin')
              .eq('connection_status', 'connected')
              .limit(1)
              .single();

            const unipileAccountId = linkedinAccount?.unipile_account_id;

            const postsToInsert = await Promise.all(newPosts.map(async (post: any) => {
              let apifySocialId = post.full_urn || post.urn || post.postUrn || post.activity_id || post.id;

              if (apifySocialId && /^\d+$/.test(String(apifySocialId))) {
                apifySocialId = `urn:li:activity:${apifySocialId}`;
              }

              let finalSocialId = apifySocialId;
              let resolvedAuthor: { authorName?: string; authorHeadline?: string } = {};

              if (unipileAccountId && apifySocialId) {
                const resolved = await resolveCorrectUrn(apifySocialId, unipileAccountId);
                if (resolved) {
                  finalSocialId = resolved.socialId;
                  resolvedAuthor = {
                    authorName: resolved.authorName,
                    authorHeadline: resolved.authorHeadline
                  };
                }
              }

              return {
                workspace_id: monitor.workspace_id,
                monitor_id: monitor.id,
                social_id: finalSocialId,
                share_url: post.post_url || post.url || post.postUrl || `https://www.linkedin.com/feed/update/${apifySocialId}`,
                post_content: post.text || post.content || '',
                author_name: resolvedAuthor.authorName || post.companyName || post.company?.name || companySlug,
                author_profile_id: companySlug,
                author_title: resolvedAuthor.authorHeadline || 'Company Page',
                author_headline: resolvedAuthor.authorHeadline || 'Company Page',
                hashtags: [],
                post_date: post.postedAt || post.posted_at?.timestamp
                  ? new Date(post.postedAt || post.posted_at?.timestamp).toISOString()
                  : new Date().toISOString(),
                engagement_metrics: {
                  comments: post.numComments || post.stats?.comments || 0,
                  reactions: post.numLikes || post.stats?.total_reactions || post.stats?.likes || 0,
                  reposts: post.numReposts || post.stats?.shares || 0
                },
                status: 'discovered'
              };
            }));

            const { data: insertedPosts, error: insertError } = await supabase
              .from('linkedin_posts_discovered')
              .insert(postsToInsert)
              .select();

            if (insertError) {
              if (insertError.code === '23505') {
                console.warn(`⚠️ Some company posts already exist (duplicate prevented)`);
              } else {
                console.error(`❌ Error inserting company posts:`, insertError);
              }
            } else {
              totalDiscovered += newPosts.length;
              // Update daily counter for this workspace
              workspacePostsToday.set(monitor.workspace_id, (workspacePostsToday.get(monitor.workspace_id) || 0) + newPosts.length);
              console.log(`✅ Stored ${newPosts.length} new company posts (workspace daily total: ${workspacePostsToday.get(monitor.workspace_id)}/${MAX_APIFY_REQUESTS_PER_DAY})`);

              // Auto-generate comments for new posts
              if (insertedPosts && insertedPosts.length > 0) {
                console.log(`🤖 Auto-generating comments for ${insertedPosts.length} new company posts...`);

                fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com'}/api/linkedin-commenting/auto-generate-comments`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    post_ids: insertedPosts.map(p => p.id),
                    workspace_id: monitor.workspace_id,
                    monitor_id: monitor.id
                  })
                }).catch(err => console.error('❌ Error triggering auto-comment generation:', err));
              }
            }
          }

          companiesScrapedThisRun++;
        }

        // Update monitor tracking
        await supabase
          .from('linkedin_post_monitors')
          .update({
            last_scraped_at: new Date().toISOString()
          })
          .eq('id', monitor.id);

      } catch (error) {
        console.error(`❌ Error processing company monitor ${monitor.id}:`, error);
        continue;
      }
    }

    console.log(`\n✅ Discovery complete: ${totalDiscovered} new posts discovered`);

    return NextResponse.json({
      success: true,
      monitorsProcessed: profileMonitors.length + hashtagMonitorsToProcess.length + companyMonitors.length,
      profileMonitorsProcessed: profileMonitors.length,
      hashtagMonitorsProcessed: hashtagMonitorsToProcess.length, // Only 1 per run (round-robin)
      hashtagMonitorsTotal: hashtagMonitors.length, // Total available
      companyMonitorsProcessed: companyMonitors.length,
      postsDiscovered: totalDiscovered,
      debug: {
        hashtagProcessedThisRun: hashtagMonitorToProcess ? {
          id: hashtagMonitorToProcess.id,
          hashtag: hashtagMonitorToProcess.hashtags?.find((h: string) => h.startsWith('HASHTAG:'))?.replace('HASHTAG:', '')
        } : null,
        hashtagDebug,
        companiesScraped: companiesScrapedThisRun,
        note: 'Processing 1 hashtag per cron run (round-robin by last_scraped_at)'
      }
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
