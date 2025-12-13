/**
 * Auto-Generate Comments Cron Job
 * POST /api/cron/auto-generate-comments
 *
 * Runs every 30 minutes via Netlify scheduled function
 * Finds discovered posts without comments and generates AI comments
 *
 * Updated Dec 11, 2025: Added anti-detection variance for daily volume and skip days
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateLinkedInComment, generateCommentReply } from '@/lib/services/linkedin-commenting-agent';
import type { CommentGenerationContext, CommentReplyGenerationContext } from '@/lib/services/linkedin-commenting-agent';
import { fetchPostComments, shouldReplyToComment } from '@/lib/services/linkedin-comment-replies';
import {
  getRandomDailyLimit,
  shouldSkipToday,
  getRandomCommentGap,
  getRandomPostingHour,
  getRandomPostingMinute,
  DAILY_VOLUME_CONFIG,
  isHoliday,
  getSessionBehavior
} from '@/lib/anti-detection/comment-variance';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for batch generation

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CRON_SECRET = process.env.CRON_SECRET;

// Limit posts per run to avoid timeout
const MAX_POSTS_PER_RUN = 10;

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // Verify cron secret
  const cronSecret = request.headers.get('x-cron-secret');
  if (cronSecret !== CRON_SECRET) {
    console.error('❌ Invalid cron secret');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('🤖 Auto-Generate Comments Cron Starting...');
  console.log(`   Time: ${new Date().toISOString()}`);

  // ============================================
  // ANTI-DETECTION: Check if we should skip today entirely
  // HARD RULE: No comments on Sundays
  // Humans don't post every single day - we randomly skip ~15% of days
  // ============================================
  const dayOfWeek = new Date().getDay();

  // SUNDAY BLOCK: Never comment on Sundays (day 0)
  if (dayOfWeek === 0) {
    console.log(`   🚫 SUNDAY - No comments today (hard rule)`);
    return NextResponse.json({
      success: true,
      message: 'Sunday - no comments allowed',
      posts_processed: 0,
      comments_generated: 0,
      skipped_reason: 'sunday_no_comments',
      duration_ms: Date.now() - startTime
    });
  }

  // HOLIDAY BLOCK: Skip major holidays
  const holidayCheck = isHoliday();
  if (holidayCheck.isHoliday) {
    console.log(`   🎄 HOLIDAY - ${holidayCheck.holidayName} - No comments today`);
    return NextResponse.json({
      success: true,
      message: `Holiday skip: ${holidayCheck.holidayName}`,
      posts_processed: 0,
      comments_generated: 0,
      skipped_reason: 'holiday_no_comments',
      duration_ms: Date.now() - startTime
    });
  }

  const skipCheck = shouldSkipToday(dayOfWeek);
  if (skipCheck.skip) {
    console.log(`   🎲 SKIPPING TODAY: ${skipCheck.reason}`);
    return NextResponse.json({
      success: true,
      message: `Skip day activated: ${skipCheck.reason}`,
      posts_processed: 0,
      comments_generated: 0,
      skipped_reason: 'anti_detection_skip_day',
      duration_ms: Date.now() - startTime
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // ============================================
  // ANTI-DETECTION: Get random daily limit for this run
  // This varies the number of comments per day (3-12, avg ~7)
  // ============================================
  const dailyLimit = getRandomDailyLimit();
  console.log(`   📊 Daily comment limit for today: ${dailyLimit} (range: ${DAILY_VOLUME_CONFIG.baseMin}-${DAILY_VOLUME_CONFIG.baseMax})`);

  if (dailyLimit === 0) {
    console.log(`   🎲 Daily limit is 0 - taking a break today`);
    return NextResponse.json({
      success: true,
      message: 'Daily limit is 0 - taking a break today',
      posts_processed: 0,
      comments_generated: 0,
      skipped_reason: 'anti_detection_daily_limit_zero',
      duration_ms: Date.now() - startTime
    });
  }

  try {
    // Find discovered posts that don't have comments yet
    // Join with monitors to get generation settings
    // IMPORTANT: Only process posts that have passed their comment_eligible_at time (randomizer)
    // This ensures we never comment immediately - posts must "age" 1-4 hours first
    const now = new Date().toISOString();

    // ============================================
    // ANTI-DETECTION: Check how many comments we've already generated today (per workspace)
    // This respects the daily volume variance
    // ============================================
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: todaysComments } = await supabase
      .from('linkedin_post_comments')
      .select('workspace_id')
      .gte('generated_at', todayStart.toISOString());

    // Count comments per workspace today
    const commentsPerWorkspaceToday: Record<string, number> = {};
    for (const comment of todaysComments || []) {
      commentsPerWorkspaceToday[comment.workspace_id] = (commentsPerWorkspaceToday[comment.workspace_id] || 0) + 1;
    }

    const totalCommentsToday = todaysComments?.length || 0;
    console.log(`   📊 Total comments generated today: ${totalCommentsToday}`);
    console.log(`   📊 Per-workspace breakdown:`, commentsPerWorkspaceToday);

    // ============================================
    // FETCH MONITOR METADATA FOR PER-WORKSPACE LIMITS
    // ============================================
    const { data: monitors } = await supabase
      .from('linkedin_post_monitors')
      .select('id, workspace_id, metadata')
      .eq('status', 'active');

    // Build per-workspace settings map from monitor metadata
    const workspaceLimits: Record<string, number> = {};
    const workspaceSkipProbability: Record<string, number> = {};
    const workspaceDelaySettings: Record<string, { minHours: number; maxHours: number }> = {};
    const workspaceRandomizerEnabled: Record<string, boolean> = {};

    for (const monitor of monitors || []) {
      const metadata = monitor.metadata as Record<string, any> || {};

      // Daily comment limit
      const customLimit = metadata.daily_comment_limit;
      if (customLimit && typeof customLimit === 'number') {
        if (!workspaceLimits[monitor.workspace_id] || customLimit < workspaceLimits[monitor.workspace_id]) {
          workspaceLimits[monitor.workspace_id] = customLimit;
        }
      }

      // Skip day probability
      const skipProb = metadata.skip_day_probability;
      if (typeof skipProb === 'number' && skipProb >= 0 && skipProb <= 1) {
        workspaceSkipProbability[monitor.workspace_id] = skipProb;
      }

      // Randomizer enabled flag
      if (metadata.randomizer_enabled !== undefined) {
        workspaceRandomizerEnabled[monitor.workspace_id] = Boolean(metadata.randomizer_enabled);
      }

      // Comment delay settings (in hours)
      const minHours = metadata.comment_delay_min_hours;
      const maxHours = metadata.comment_delay_max_hours;
      if (typeof minHours === 'number' && typeof maxHours === 'number') {
        workspaceDelaySettings[monitor.workspace_id] = { minHours, maxHours };
      }
    }
    console.log(`   📊 Per-workspace custom limits:`, workspaceLimits);
    console.log(`   📊 Per-workspace skip probabilities:`, workspaceSkipProbability);
    console.log(`   📊 Per-workspace delay settings:`, workspaceDelaySettings);

    if (totalCommentsToday >= dailyLimit) {
      console.log(`   ✅ Daily limit reached (${totalCommentsToday}/${dailyLimit}) - stopping for today`);
      return NextResponse.json({
        success: true,
        message: `Daily limit reached: ${totalCommentsToday}/${dailyLimit} comments`,
        posts_processed: 0,
        comments_generated: 0,
        daily_limit: dailyLimit,
        comments_today: totalCommentsToday,
        skipped_reason: 'anti_detection_daily_limit_reached',
        duration_ms: Date.now() - startTime
      });
    }

    // Calculate how many more we can generate
    const remainingQuota = dailyLimit - totalCommentsToday;
    console.log(`   📊 Remaining quota: ${remainingQuota} comments`);

    // Limit posts to remaining quota (but never more than MAX_POSTS_PER_RUN)
    const effectiveLimit = Math.min(remainingQuota, MAX_POSTS_PER_RUN);
    console.log(`   📊 Effective limit for this run: ${effectiveLimit} (min of quota ${remainingQuota} and max ${MAX_POSTS_PER_RUN})`);

    const { data: posts, error: postsError } = await supabase
      .from('linkedin_posts_discovered')
      .select(`
        id,
        workspace_id,
        monitor_id,
        social_id,
        share_url,
        author_name,
        author_profile_id,
        author_title,
        author_headline,
        post_content,
        post_intent,
        post_date,
        hashtags,
        engagement_metrics,
        status,
        comment_eligible_at,
        linkedin_post_monitors!inner (
          id,
          auto_approve_enabled,
          metadata
        )
      `)
      .eq('status', 'discovered')
      .is('comment_generated_at', null)
      // RANDOMIZER: Only process posts that have passed their eligible time
      // Posts without comment_eligible_at (legacy) are immediately eligible
      .or(`comment_eligible_at.is.null,comment_eligible_at.lte.${now}`)
      .order('created_at', { ascending: false })
      .limit(effectiveLimit);

    if (postsError) {
      console.error('❌ Error fetching posts:', postsError);
      return NextResponse.json({ error: postsError.message }, { status: 500 });
    }

    if (!posts || posts.length === 0) {
      console.log('📭 No posts eligible for comments (may still be in waiting period)');
      return NextResponse.json({
        success: true,
        message: 'No posts eligible for comments (may still be in waiting period)',
        posts_processed: 0,
        comments_generated: 0,
        duration_ms: Date.now() - startTime
      });
    }

    // CRITICAL: Claim these posts immediately to prevent race conditions
    // If multiple cron runs execute concurrently, they could process the same posts
    // Mark as 'processing' so other runs skip them
    // NOTE: Valid statuses are: discovered, processing, commented, skipped
    const postIds = posts.map(p => p.id);
    const { error: claimError } = await supabase
      .from('linkedin_posts_discovered')
      .update({
        status: 'processing',
        comment_generated_at: new Date().toISOString() // Mark timestamp to prevent re-querying
      })
      .in('id', postIds);

    if (claimError) {
      console.error('❌ Error claiming posts:', claimError);
      return NextResponse.json({ error: 'Failed to claim posts' }, { status: 500 });
    }

    console.log(`✅ Claimed ${postIds.length} posts for processing`);

    // Log eligible posts with their wait times
    console.log(`📋 Found ${posts.length} posts eligible for comments`);
    for (const post of posts) {
      const eligibleAt = post.comment_eligible_at ? new Date(post.comment_eligible_at) : null;
      const waitedHours = eligibleAt ? ((Date.now() - eligibleAt.getTime()) / (1000 * 60 * 60)).toFixed(1) : 'N/A';
      console.log(`   - ${post.author_name}: waited ${waitedHours}h past eligible time`);
    }

    // Get unique workspace IDs for brand guidelines
    const workspaceIds = [...new Set(posts.map(p => p.workspace_id))];

    // Fetch brand guidelines for all workspaces
    const { data: brandGuidelines } = await supabase
      .from('linkedin_brand_guidelines')
      .select('*')
      .in('workspace_id', workspaceIds);

    const guidelinesByWorkspace: Record<string, any> = {};
    for (const bg of brandGuidelines || []) {
      guidelinesByWorkspace[bg.workspace_id] = bg;
    }

    // Fetch workspace names
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id, name')
      .in('id', workspaceIds);

    const workspaceNames: Record<string, string> = {};
    for (const ws of workspaces || []) {
      workspaceNames[ws.id] = ws.name;
    }

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    const results: Array<{ post_id: string; status: string; comment_id?: string; error?: string }> = [];

    // Track authors we've already commented on in THIS RUN (one comment per author per run)
    const authorsCommentedThisRun = new Set<string>();

    // Get authors who already have pending/scheduled comments (avoid double-commenting)
    const { data: existingComments } = await supabase
      .from('linkedin_post_comments')
      .select('post:linkedin_posts_discovered!inner(author_profile_id, author_name)')
      .in('status', ['pending_approval', 'scheduled'])
      .in('workspace_id', workspaceIds);

    const authorsWithPendingComments = new Set<string>();
    for (const comment of existingComments || []) {
      const authorId = (comment.post as any)?.author_profile_id;
      if (authorId) authorsWithPendingComments.add(authorId);
    }

    console.log(`📋 ${authorsWithPendingComments.size} authors already have pending comments`);

    // 5-DAY RULE: Get authors we've commented on in the last 5 days
    // (Changed from 10 days - Dec 9, 2025)
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const { data: recentAuthorComments } = await supabase
      .from('linkedin_post_comments')
      .select('post:linkedin_posts_discovered!inner(author_profile_id, author_name)')
      .in('workspace_id', workspaceIds)
      .gte('generated_at', fiveDaysAgo.toISOString());

    const authorsCommentedRecently = new Set<string>();
    for (const comment of recentAuthorComments || []) {
      const authorId = (comment.post as any)?.author_profile_id;
      const authorName = (comment.post as any)?.author_name;
      if (authorId) authorsCommentedRecently.add(authorId);
      if (authorName) authorsCommentedRecently.add(authorName); // Fallback to name
    }

    console.log(`📋 ${authorsCommentedRecently.size} authors commented on in last 5 days`);

    // CRITICAL: Get post IDs that already have ANY comment (prevents duplicates)
    // This catches race conditions where multiple cron runs process same post
    // Reuse postIds from claim step (line 97)
    const { data: existingPostComments } = await supabase
      .from('linkedin_post_comments')
      .select('post_id')
      .in('post_id', postIds);

    const postsWithComments = new Set<string>();
    for (const comment of existingPostComments || []) {
      postsWithComments.add(comment.post_id);
    }
    console.log(`📋 ${postsWithComments.size} posts already have comments (will skip)`);

    // CRITICAL FIX: Also check by social_id (LinkedIn post ID) - same post may have different UUIDs
    // This prevents commenting twice on the same LinkedIn post discovered via different monitors
    const socialIds = posts.map(p => p.social_id).filter(Boolean);
    const { data: existingSocialIdComments } = await supabase
      .from('linkedin_post_comments')
      .select('post:linkedin_posts_discovered!inner(social_id)')
      .in('workspace_id', workspaceIds);

    const socialIdsWithComments = new Set<string>();
    for (const comment of existingSocialIdComments || []) {
      const socialId = (comment.post as any)?.social_id;
      if (socialId) socialIdsWithComments.add(socialId);
    }
    console.log(`📋 ${socialIdsWithComments.size} social_ids already have comments (will skip)`);

    // Generate comments for each post
    for (const post of posts) {
      try {
        const monitor = post.linkedin_post_monitors;
        const brandGuideline = guidelinesByWorkspace[post.workspace_id];
        const authorId = post.author_profile_id || post.author_name || 'unknown';

        // ============================================
        // PER-WORKSPACE LIMIT CHECK
        // Respect custom daily limits set in monitor metadata
        // ============================================
        const workspaceLimit = workspaceLimits[post.workspace_id] || dailyLimit;
        const workspaceCommentsToday = commentsPerWorkspaceToday[post.workspace_id] || 0;

        if (workspaceCommentsToday >= workspaceLimit) {
          console.log(`\n⏭️ Skipping post ${post.id.substring(0, 8)} - WORKSPACE LIMIT REACHED (${workspaceCommentsToday}/${workspaceLimit})`);
          skipCount++;
          results.push({ post_id: post.id, status: 'skipped_workspace_daily_limit' });
          // Mark post back to discovered so it can be processed tomorrow
          await supabase
            .from('linkedin_posts_discovered')
            .update({
              status: 'discovered',
              comment_generated_at: null  // Reset so it can be picked up later
            })
            .eq('id', post.id);
          continue;
        }

        // ============================================
        // PER-WORKSPACE SKIP DAY CHECK
        // Respect custom skip_day_probability from monitor metadata
        // Only check once per workspace per run (deterministic for the day)
        // ============================================
        const customSkipProb = workspaceSkipProbability[post.workspace_id];
        if (customSkipProb !== undefined && workspaceRandomizerEnabled[post.workspace_id]) {
          // Use workspace ID + date as seed for consistent daily skip decision
          const dateStr = new Date().toISOString().split('T')[0];
          const seedString = `${post.workspace_id}-${dateStr}`;
          const hash = seedString.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0);
          const seededRandom = Math.abs(hash % 100) / 100;

          if (seededRandom < customSkipProb) {
            console.log(`\n⏭️ Skipping post ${post.id.substring(0, 8)} - WORKSPACE SKIP DAY (${(customSkipProb * 100).toFixed(0)}% probability)`);
            skipCount++;
            results.push({ post_id: post.id, status: 'skipped_workspace_skip_day' });
            // Reset post so it can be processed another day
            await supabase
              .from('linkedin_posts_discovered')
              .update({
                status: 'discovered',
                comment_generated_at: null
              })
              .eq('id', post.id);
            continue;
          }
        }

        // CRITICAL DEDUPLICATION: Skip if post already has a comment (any status)
        // This prevents duplicate comments from race conditions between cron runs
        if (postsWithComments.has(post.id)) {
          console.log(`\n⏭️ Skipping post ${post.id.substring(0, 8)} - ALREADY HAS COMMENT`);
          skipCount++;
          results.push({ post_id: post.id, status: 'skipped_already_has_comment' });
          // Mark post so query doesn't pick it up again (comment_generated_at already set during claim)
          // Using 'processing' status since 'comment_pending' not in valid_status constraint
          await supabase
            .from('linkedin_posts_discovered')
            .update({ status: 'processing' })
            .eq('id', post.id);
          continue;
        }

        // CRITICAL DEDUPLICATION: Skip if this LinkedIn post (social_id) already has a comment
        // Same LinkedIn post may be discovered multiple times with different UUIDs
        if (post.social_id && socialIdsWithComments.has(post.social_id)) {
          console.log(`\n⏭️ Skipping post ${post.id.substring(0, 8)} - SAME LINKEDIN POST already has comment (social_id: ${post.social_id})`);
          skipCount++;
          results.push({ post_id: post.id, status: 'skipped_duplicate_social_id' });
          // Mark post so query doesn't pick it up again (comment_generated_at already set during claim)
          await supabase
            .from('linkedin_posts_discovered')
            .update({ status: 'skipped' })
            .eq('id', post.id);
          continue;
        }

        // DEDUPLICATION: Skip if we already commented on this author in this run
        if (authorsCommentedThisRun.has(authorId)) {
          console.log(`\n⏭️ Skipping post ${post.id.substring(0, 8)} - already commented on ${post.author_name} this run`);
          skipCount++;
          results.push({ post_id: post.id, status: 'skipped_duplicate_author_this_run' });
          continue;
        }

        // DEDUPLICATION: Skip if author already has a pending/scheduled comment
        if (authorsWithPendingComments.has(authorId)) {
          console.log(`\n⏭️ Skipping post ${post.id.substring(0, 8)} - ${post.author_name} already has pending comment`);
          skipCount++;
          results.push({ post_id: post.id, status: 'skipped_author_has_pending' });
          continue;
        }

        // 5-DAY RULE: Skip if we've commented on this author in the last 5 days
        const authorNameKey = post.author_name || authorId;
        if (authorsCommentedRecently.has(authorId) || authorsCommentedRecently.has(authorNameKey)) {
          console.log(`\n⏭️ Skipping post ${post.id.substring(0, 8)} - ${post.author_name} was commented on within 5 days`);
          skipCount++;
          results.push({ post_id: post.id, status: 'skipped_5_day_rule' });
          // Mark as skipped so we don't keep trying (comment_generated_at already set during claim)
          await supabase
            .from('linkedin_posts_discovered')
            .update({ status: 'skipped' })
            .eq('id', post.id);
          continue;
        }

        // SAFETY: Skip posts without content - we can't generate good comments
        if (!post.post_content || post.post_content.trim().length === 0) {
          console.log(`\n⏭️ Skipping post ${post.id.substring(0, 8)} - NO CONTENT (would generate garbage comment)`);
          skipCount++;
          results.push({ post_id: post.id, status: 'skipped_no_content' });
          // Mark as skipped so we don't try again (comment_generated_at already set during claim)
          await supabase
            .from('linkedin_posts_discovered')
            .update({ status: 'skipped' })
            .eq('id', post.id);
          continue;
        }

        // ============================================
        // BLACKLIST FILTER: Skip posts from blacklisted profiles
        // Prevents commenting on your own posts or competitor posts
        // ============================================
        const blacklistedProfiles: string[] = brandGuideline?.blacklisted_profiles || [];
        if (blacklistedProfiles.length > 0 && post.author_name) {
          const authorLower = post.author_name.toLowerCase();
          const isBlacklisted = blacklistedProfiles.some(
            (name: string) => authorLower.includes(name.toLowerCase())
          );
          if (isBlacklisted) {
            console.log(`\n⏭️ Skipping post ${post.id.substring(0, 8)} - BLACKLISTED AUTHOR: ${post.author_name}`);
            skipCount++;
            results.push({ post_id: post.id, status: 'skipped_blacklisted_author' });
            await supabase
              .from('linkedin_posts_discovered')
              .update({ status: 'skipped' })
              .eq('id', post.id);
            continue;
          }
        }

        // ============================================
        // LEADERSHIP FILTER: Skip non-thought-leadership posts
        // Focus on high-value content, skip noise
        // ============================================
        const contentLower = post.post_content.toLowerCase();

        // Job posts - recruiting content, not leadership
        const jobPatterns = [
          "we're hiring", "we are hiring", "open role", "open position",
          "join our team", "apply now", "looking for a", "job opening",
          "career opportunity", "now hiring", "hiring for", "apply today",
          "join us as", "seeking a", "looking to hire"
        ];

        // Event promos - marketing, not insights
        const eventPatterns = [
          "register now", "webinar", "join us live", "live event",
          "conference", "summit", "sign up now", "rsvp", "register today",
          "save your spot", "grab your seat", "limited seats",
          // Speaker/panel announcements (added Dec 6, 2025)
          "panel", "panelist", "keynote", "speaker at", "speaking at",
          "will be joining the", "moderating", "presenting at", "fireside chat"
        ];

        // Anniversary/milestone posts - personal updates
        const milestonePatterns = [
          "work anniversary", "celebrating my", "years at",
          "thrilled to join", "excited to announce i've joined",
          "excited to share that i've joined", "new role", "new chapter",
          "thrilled to announce", "excited to start", "first day at",
          "officially joined", "joining the team"
        ];

        // Giveaways/contests - spam
        const giveawayPatterns = [
          "giveaway", "win a", "enter to win", "contest", "raffle",
          "free tickets", "giving away"
        ];

        // Engagement farming - low value
        const engagementFarmPatterns = [
          "like if you agree", "comment below if", "drop a", "tag someone",
          "share this with", "repost if", "agree or disagree", "thoughts?",
          "who else", "am i right"
        ];

        // Certification flex - personal achievement, not leadership
        const certPatterns = [
          "just passed", "newly certified", "badge earned", "completed course",
          "certification", "certified in", "earned my", "passed my exam",
          // Course completion certificates (added Dec 9, 2025)
          "course completion", "completion certificate", "my certificate for",
          "earned a certificate", "received my certificate", "finished the course",
          "completed the course", "course certificate"
        ];

        // Holiday/birthday - social pleasantries
        const holidayPatterns = [
          "happy birthday", "happy holidays", "happy new year", "merry christmas",
          "happy thanksgiving", "season's greetings", "happy monday", "tgif"
        ];

        // Connection begging
        const connectionPatterns = [
          "let's connect", "grow my network", "looking to connect",
          "send me a connection", "connect with me", "add me"
        ];

        // Video posts - AI can't watch videos, comments would be nonsensical
        const videoPatterns = [
          "watch the video", "in this video", "check out my video",
          "video below", "watch this", "in my latest video", "video link",
          "watch my video", "see the video", "full video", "video here",
          "linked video", "watch the full", "video in comments",
          "🎥", "📹", "▶️"  // Common video emojis
        ];

        // Check all patterns
        const isJobPost = jobPatterns.some(p => contentLower.includes(p));
        const isEventPromo = eventPatterns.some(p => contentLower.includes(p));
        const isMilestonePost = milestonePatterns.some(p => contentLower.includes(p));
        const isGiveaway = giveawayPatterns.some(p => contentLower.includes(p));
        const isEngagementFarm = engagementFarmPatterns.some(p => contentLower.includes(p));
        const isCertPost = certPatterns.some(p => contentLower.includes(p));
        const isHolidayPost = holidayPatterns.some(p => contentLower.includes(p));
        const isConnectionBegging = connectionPatterns.some(p => contentLower.includes(p));
        const isVideoPost = videoPatterns.some(p => contentLower.includes(p));

        // Determine skip reason
        let skipReason = '';
        if (isJobPost) skipReason = 'job_post';
        else if (isEventPromo) skipReason = 'event_promo';
        else if (isMilestonePost) skipReason = 'milestone_post';
        else if (isGiveaway) skipReason = 'giveaway';
        else if (isEngagementFarm) skipReason = 'engagement_farm';
        else if (isCertPost) skipReason = 'certification_post';
        else if (isHolidayPost) skipReason = 'holiday_post';
        else if (isConnectionBegging) skipReason = 'connection_begging';
        else if (isVideoPost) skipReason = 'video_post';

        if (skipReason) {
          console.log(`\n⏭️ Skipping post ${post.id.substring(0, 8)} - NOT LEADERSHIP (${skipReason}): ${post.author_name}`);
          skipCount++;
          results.push({ post_id: post.id, status: `skipped_${skipReason}` });
          await supabase
            .from('linkedin_posts_discovered')
            .update({ status: 'skipped' })
            .eq('id', post.id);
          continue;
        }

        console.log(`\n💬 Processing post ${post.id.substring(0, 8)}...`);
        console.log(`   Author: ${post.author_name}`);

        // === 70/30 RULE: Check if we should reply to a comment ===
        // Fetch existing comments on the post
        const existingComments = await fetchPostComments(post.social_id);
        const replyDecision = shouldReplyToComment(existingComments);

        let isReplyToComment = false;
        let replyToCommentId: string | null = null;
        let replyToAuthorName: string | null = null;

        if (replyDecision.shouldReply && replyDecision.targetComment) {
          console.log(`   🎯 Will REPLY to comment (30% path): ${replyDecision.reason}`);
          isReplyToComment = true;
          replyToCommentId = replyDecision.targetComment.id;
          replyToAuthorName = replyDecision.targetComment.author_name;
        } else {
          console.log(`   📝 Will comment on POST (70% path): ${replyDecision.reason}`);
        }

        // Build workspace context (shared between both paths)
        // Note: expertise_areas, products, value_props are stored in brand_guidelines or monitor.metadata
        const monitorMetadata = monitor?.metadata as Record<string, any> || {};

        // Ensure expertise_areas is always an array (industry_talking_points is a string)
        let expertiseAreas: string[] = ['B2B Sales', 'Lead Generation'];
        if (Array.isArray(monitorMetadata.expertise_areas)) {
          expertiseAreas = monitorMetadata.expertise_areas;
        } else if (brandGuideline?.industry_talking_points) {
          // Split string by periods or commas to create array
          expertiseAreas = brandGuideline.industry_talking_points
            .split(/[.,]/)
            .map((s: string) => s.trim())
            .filter((s: string) => s.length > 0)
            .slice(0, 5); // Limit to 5 items
        }

        const workspaceContext = {
          workspace_id: post.workspace_id,
          company_name: workspaceNames[post.workspace_id] || 'Your Company',
          expertise_areas: expertiseAreas,
          products: Array.isArray(monitorMetadata.products) ? monitorMetadata.products : [],
          value_props: Array.isArray(monitorMetadata.value_props) ? monitorMetadata.value_props : [],
          tone_of_voice: brandGuideline?.tone_of_voice || monitorMetadata.tone_of_voice || 'Professional and helpful',
          knowledge_base_snippets: [],
          brand_guidelines: brandGuideline || undefined
        };

        // Generate comment with retry logic
        let generatedComment;
        let retries = 0;
        const maxRetries = 3;

        while (retries < maxRetries) {
          try {
            if (isReplyToComment && replyDecision.targetComment) {
              // Generate reply to comment (30% path)
              const replyContext: CommentReplyGenerationContext = {
                originalPost: {
                  text: post.post_content || '',
                  author_name: post.author_name || 'Unknown'
                },
                targetComment: {
                  id: replyDecision.targetComment.id,
                  text: replyDecision.targetComment.text,
                  author_name: replyDecision.targetComment.author_name,
                  reactions_count: replyDecision.targetComment.reactions_count
                },
                workspace: workspaceContext
              };
              generatedComment = await generateCommentReply(replyContext);
            } else {
              // Generate direct post comment (70% path)
              const context: CommentGenerationContext = {
                post: {
                  id: post.id,
                  post_linkedin_id: post.social_id || '',
                  post_social_id: post.social_id || '',
                  post_text: post.post_content || '',
                  post_type: 'article',
                  post_intent: post.post_intent || 'thought_leadership',
                  author: {
                    linkedin_id: post.author_profile_id || '',
                    name: post.author_name || 'Unknown Author',
                    title: post.author_title || post.author_headline || undefined,
                    company: undefined, // Not stored separately - headline contains this
                    profile_url: post.share_url ? post.share_url.split('/posts/')[0] : undefined
                  },
                  engagement: {
                    likes_count: post.engagement_metrics?.reactions || 0,
                    comments_count: post.engagement_metrics?.comments || 0,
                    shares_count: post.engagement_metrics?.reposts || 0
                  },
                  posted_at: post.post_date ? new Date(post.post_date) : new Date(),
                  discovered_via_monitor_type: 'profile',
                  matched_keywords: post.hashtags || []
                },
                workspace: workspaceContext
              };
              generatedComment = await generateLinkedInComment(context);
            }
            break;
          } catch (error: any) {
            retries++;
            if (error.message?.includes('Too Many Requests') && retries < maxRetries) {
              const waitTime = Math.pow(2, retries) * 1000;
              console.log(`   ⏳ Rate limited, waiting ${waitTime/1000}s before retry ${retries}/${maxRetries}...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
            throw error;
          }
        }

        // Check if AI decided to skip
        if (!generatedComment || generatedComment.confidence_score === 0.0) {
          console.log(`   ⏭️ AI decided not to comment: ${generatedComment?.reasoning || 'No reason'}`);
          skipCount++;

          // Mark post so we don't try again (comment_generated_at already set during claim)
          await supabase
            .from('linkedin_posts_discovered')
            .update({ status: 'skipped' })
            .eq('id', post.id);

          results.push({ post_id: post.id, status: 'skipped' });
          continue;
        }

        // SAFETY: Reject garbage/placeholder comments
        // These indicate the AI didn't have proper context or post content
        const garbagePhrases = [
          'came through empty',
          'content didn\'t load',
          'mind reposting',
          'dropping it in the comments',
          'post might have come through',
          'couldn\'t see the content',
          'unable to see',
          'can\'t see your post',
          'not showing up',
          'not loading',
          'post is blank',
          'empty post'
        ];
        const commentLower = generatedComment.comment_text.toLowerCase();
        const isGarbageComment = garbagePhrases.some(phrase => commentLower.includes(phrase));

        if (isGarbageComment) {
          console.log(`   🚫 REJECTED GARBAGE COMMENT: "${generatedComment.comment_text.substring(0, 100)}..."`);
          errorCount++;

          // Mark post as skipped (comment_generated_at already set during claim)
          await supabase
            .from('linkedin_posts_discovered')
            .update({ status: 'skipped' })
            .eq('id', post.id);

          results.push({ post_id: post.id, status: 'rejected_garbage_comment' });
          continue;
        }

        // ============================================
        // CRITICAL: Final real-time duplicate check right before insert
        // Catches race conditions where another run inserted while we were generating
        // ============================================
        const { count: finalPostCheck } = await supabase
          .from('linkedin_post_comments')
          .select('id', { count: 'exact', head: true })
          .eq('post_id', post.id);

        if (finalPostCheck && finalPostCheck > 0) {
          console.log(`   🛑 RACE CONDITION CAUGHT: Comment already exists for post ${post.id.substring(0, 8)}`);
          skipCount++;
          results.push({ post_id: post.id, status: 'skipped_race_condition' });
          continue;
        }

        // Also check by social_id (same LinkedIn post may have different UUIDs)
        if (post.social_id) {
          const { data: sameSocialIdPosts } = await supabase
            .from('linkedin_posts_discovered')
            .select('id')
            .eq('social_id', post.social_id);

          if (sameSocialIdPosts && sameSocialIdPosts.length > 1) {
            const allPostIds = sameSocialIdPosts.map(p => p.id);
            const { count: socialIdCommentCount } = await supabase
              .from('linkedin_post_comments')
              .select('id', { count: 'exact', head: true })
              .in('post_id', allPostIds);

            if (socialIdCommentCount && socialIdCommentCount > 0) {
              console.log(`   🛑 RACE CONDITION CAUGHT: Comment exists for same social_id ${post.social_id}`);
              skipCount++;
              await supabase
                .from('linkedin_posts_discovered')
                .update({ status: 'skipped' })
                .eq('id', post.id);
              results.push({ post_id: post.id, status: 'skipped_race_condition_social_id' });
              continue;
            }
          }
        }

        // Determine status based on auto_approve setting
        let commentStatus = 'pending_approval';
        let scheduledPostTime: string | null = null;

        if (monitor?.auto_approve_enabled) {
          commentStatus = 'scheduled';

          // ============================================
          // ANTI-DETECTION: Use random posting times
          // Per-workspace delay settings from monitor metadata
          // Falls back to global variance if not configured
          // ============================================
          const now = new Date();

          // Get per-workspace delay settings or use defaults
          const delaySettings = workspaceDelaySettings[post.workspace_id];
          let gapMinutes: number;

          if (delaySettings && workspaceRandomizerEnabled[post.workspace_id]) {
            // Use per-workspace delay settings (in hours, convert to minutes)
            const minMinutes = delaySettings.minHours * 60;
            const maxMinutes = delaySettings.maxHours * 60;
            gapMinutes = minMinutes + Math.floor(Math.random() * (maxMinutes - minMinutes));
            console.log(`   🎯 Using workspace delay: ${delaySettings.minHours}-${delaySettings.maxHours}h`);
          } else {
            // Fall back to global variance
            gapMinutes = getRandomCommentGap();
          }

          // Get the last scheduled comment for this workspace
          const { data: lastScheduled } = await supabase
            .from('linkedin_post_comments')
            .select('scheduled_post_time')
            .eq('workspace_id', post.workspace_id)
            .eq('status', 'scheduled')
            .order('scheduled_post_time', { ascending: false })
            .limit(1)
            .single();

          if (lastScheduled?.scheduled_post_time) {
            // Schedule after the last scheduled comment with random gap
            const lastTime = new Date(lastScheduled.scheduled_post_time);
            const scheduled = new Date(lastTime.getTime() + gapMinutes * 60 * 1000);
            scheduledPostTime = scheduled.toISOString();
            console.log(`   🎲 Scheduled ${gapMinutes}min (${(gapMinutes/60).toFixed(1)}h) after last`);
          } else {
            // No pending scheduled comments - schedule for a random future time
            const scheduled = new Date(now.getTime() + gapMinutes * 60 * 1000);
            scheduledPostTime = scheduled.toISOString();
            console.log(`   🎲 Scheduled ${gapMinutes}min from now (variance start)`);
          }

          console.log(`   🤖 Auto-approved, scheduled for ${scheduledPostTime}`);
        }

        // Save comment to database
        const { data: savedComment, error: saveError } = await supabase
          .from('linkedin_post_comments')
          .insert({
            workspace_id: post.workspace_id,
            monitor_id: post.monitor_id,
            post_id: post.id,
            comment_text: generatedComment.comment_text,
            status: commentStatus,
            scheduled_post_time: scheduledPostTime,
            approved_at: monitor?.auto_approve_enabled ? new Date().toISOString() : null,
            generated_at: new Date().toISOString(),
            // Reply tracking (70/30 rule)
            is_reply_to_comment: isReplyToComment,
            reply_to_comment_id: replyToCommentId,
            reply_to_author_name: replyToAuthorName,
            generation_metadata: {
              model: generatedComment.generation_metadata?.model || 'claude-3-5-sonnet',
              tokens_used: generatedComment.generation_metadata?.tokens_used || 0,
              generation_time_ms: generatedComment.generation_metadata?.generation_time_ms || 0,
              confidence_score: generatedComment.confidence_score,
              quality_indicators: generatedComment.quality_indicators,
              reasoning: generatedComment.reasoning
            }
          })
          .select()
          .single();

        if (saveError) {
          // Handle unique constraint violation gracefully (race condition caught by DB)
          if (saveError.code === '23505' || saveError.message?.includes('unique_comment_per_post')) {
            console.log(`   🛑 DB CONSTRAINT CAUGHT DUPLICATE: ${post.id.substring(0, 8)}`);
            skipCount++;
            results.push({ post_id: post.id, status: 'skipped_db_constraint_duplicate' });
            continue;
          }
          console.error(`   ❌ Error saving comment:`, saveError);
          errorCount++;
          results.push({ post_id: post.id, status: 'error', error: saveError.message });
          continue;
        }

        // Update post status (comment_generated_at already set during claim)
        // Using 'processing' status - will be updated to 'commented' when comment is posted
        await supabase
          .from('linkedin_posts_discovered')
          .update({ status: 'processing' })
          .eq('id', post.id);

        console.log(`   ✅ Comment saved: ${savedComment.id.substring(0, 8)}`);
        successCount++;
        results.push({
          post_id: post.id,
          status: 'success',
          comment_id: savedComment.id
        });

        // Track this author so we don't comment on their other posts in this run
        authorsCommentedThisRun.add(authorId);
        authorsWithPendingComments.add(authorId); // Also prevent future runs from double-commenting

        // Increment per-workspace counter (enforces limit within this run)
        commentsPerWorkspaceToday[post.workspace_id] = (commentsPerWorkspaceToday[post.workspace_id] || 0) + 1;

        // Track social_id to prevent duplicates from same LinkedIn post
        if (post.social_id) {
          socialIdsWithComments.add(post.social_id);
        }

        // Rate limiting: 5 seconds between AI calls
        await new Promise(resolve => setTimeout(resolve, 5000));

      } catch (error) {
        console.error(`   ❌ Error generating comment for ${post.id}:`, error);
        errorCount++;
        results.push({
          post_id: post.id,
          status: 'error',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const duration = Date.now() - startTime;
    console.log(`\n✅ Auto-generate complete:`);
    console.log(`   Success: ${successCount}, Skipped: ${skipCount}, Errors: ${errorCount}`);
    console.log(`   Duration: ${duration}ms`);

    return NextResponse.json({
      success: true,
      posts_processed: posts.length,
      comments_generated: successCount,
      skipped: skipCount,
      errors: errorCount,
      results,
      duration_ms: duration
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// GET for manual testing
export async function GET(req: NextRequest) {
  return NextResponse.json({
    service: 'Auto-Generate Comments Cron',
    status: 'ready',
    description: 'Generates AI comments for discovered LinkedIn posts',
    schedule: 'Every 30 minutes',
    max_posts_per_run: MAX_POSTS_PER_RUN
  });
}
