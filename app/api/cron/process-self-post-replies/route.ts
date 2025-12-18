/**
 * Process Self-Post Replies
 * POST /api/cron/process-self-post-replies
 *
 * Called by Netlify scheduled function every 30 minutes
 * 1. Generates AI replies for pending comments
 * 2. Posts approved replies to LinkedIn as threaded comments
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status';
import {
  fetchCommenterProfile,
  scoreCommenter,
  generateCRMessage,
  DEFAULT_SCORING_RULES,
  type ScoringRules,
  type ScoreBreakdown
} from '@/lib/services/linkedin-lead-scoring';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * Generate AI reply to a comment
 */
async function generateReply(
  commentText: string,
  commenterName: string,
  postContent: string,
  replyPrompt: string,
  replyContext: Record<string, unknown>,
  brandGuidelines?: {
    tone?: string;
    writing_style?: string;
    what_you_do?: string;
  }
): Promise<{ reply: string; confidence: number; reasoning: string }> {
  const systemPrompt = `You are replying to comments on your own LinkedIn post. Your goal is to be helpful, engaging, and drive the conversation forward.

POST CONTENT:
${postContent || '[Post content not available]'}

REPLY INSTRUCTIONS (FOLLOW THESE CLOSELY):
${replyPrompt}

ADDITIONAL CONTEXT:
${JSON.stringify(replyContext, null, 2)}

${brandGuidelines ? `
BRAND VOICE:
- Tone: ${brandGuidelines.tone || 'professional'}
- Writing Style: ${brandGuidelines.writing_style || 'conversational'}
- About: ${brandGuidelines.what_you_do || 'N/A'}
` : ''}

GUIDELINES:
1. Be conversational and authentic - sound human, not robotic
2. Address the commenter's specific question or point
3. Include relevant links/CTAs from the context when appropriate and natural
4. Keep replies concise (1-3 sentences, max 280 characters)
5. Don't be overly salesy or pushy
6. Match the energy of the original comment
7. If they asked a question, answer it directly first

OUTPUT FORMAT:
Return a JSON object with:
- reply: The reply text (string)
- confidence: How confident you are this is a good reply (0.0-1.0)
- reasoning: Brief explanation of your approach (string)`;

  const userPrompt = `Comment from ${commenterName}:
"${commentText}"

Generate a helpful, personalized reply. Return JSON only.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20250514',
      max_tokens: 500,
      messages: [
        { role: 'user', content: userPrompt }
      ],
      system: systemPrompt
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Parse JSON response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const result = JSON.parse(jsonMatch[0]);
    return {
      reply: result.reply || '',
      confidence: result.confidence || 0.7,
      reasoning: result.reasoning || ''
    };
  } catch (error) {
    console.error('Error generating reply:', error);
    throw error;
  }
}

/**
 * Post a threaded reply to LinkedIn via Unipile
 */
async function postThreadedReply(
  postSocialId: string,
  parentCommentId: string,
  replyText: string,
  accountId: string
): Promise<{ success: boolean; replyId?: string; error?: string }> {
  try {
    const response = await fetch(
      `${UNIPILE_BASE_URL}/api/v1/posts/${encodeURIComponent(postSocialId)}/comments`,
      {
        method: 'POST',
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          account_id: accountId,
          text: replyText,
          comment_id: parentCommentId // This makes it a threaded reply!
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `${response.status}: ${errorText}` };
    }

    const data = await response.json();
    return {
      success: true,
      replyId: data.id || data.social_id || data.comment_id
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  // Verify cron secret
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('🤖 Processing self-post replies...');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let generated = 0;
  let posted = 0;
  let failed = 0;
  const errors: string[] = [];

  try {
    // ============================================
    // PHASE 1: Generate replies for pending comments
    // ============================================

    const { data: pendingReplies, error: fetchPendingError } = await supabase
      .from('linkedin_self_post_comment_replies')
      .select(`
        *,
        monitor:linkedin_self_post_monitors!inner (
          id,
          workspace_id,
          post_content,
          reply_prompt,
          reply_context,
          auto_approve_replies
        )
      `)
      .eq('status', 'pending_generation')
      .limit(5); // Generate max 5 per run

    if (fetchPendingError) {
      console.error('Error fetching pending replies:', fetchPendingError);
    }

    if (pendingReplies && pendingReplies.length > 0) {
      console.log(`\n📝 Generating ${pendingReplies.length} replies...`);

      // Fetch brand guidelines for all workspaces
      const workspaceIds = [...new Set(pendingReplies.map(r => r.monitor.workspace_id))];
      const { data: brandGuidelines } = await supabase
        .from('linkedin_brand_guidelines')
        .select('workspace_id, tone, writing_style, what_you_do')
        .in('workspace_id', workspaceIds);

      const guidelinesByWorkspace: Record<string, typeof brandGuidelines[0]> = {};
      for (const bg of brandGuidelines || []) {
        guidelinesByWorkspace[bg.workspace_id] = bg;
      }

      for (const reply of pendingReplies) {
        try {
          console.log(`   🔄 Generating reply for: "${reply.comment_text.substring(0, 40)}..."`);

          const { reply: replyText, confidence, reasoning } = await generateReply(
            reply.comment_text,
            reply.commenter_name || 'Someone',
            reply.monitor.post_content || '',
            reply.monitor.reply_prompt,
            reply.monitor.reply_context || {},
            guidelinesByWorkspace[reply.monitor.workspace_id]
          );

          // Determine status based on auto-approve setting
          const newStatus = reply.monitor.auto_approve_replies
            ? 'scheduled'
            : 'pending_approval';

          // Update reply record
          await supabase
            .from('linkedin_self_post_comment_replies')
            .update({
              reply_text: replyText,
              confidence_score: confidence,
              generation_metadata: { reasoning, generated_at: new Date().toISOString() },
              status: newStatus,
              scheduled_post_time: newStatus === 'scheduled'
                ? new Date(Date.now() + Math.random() * 30 * 60 * 1000).toISOString() // Random 0-30 min
                : null,
              updated_at: new Date().toISOString()
            })
            .eq('id', reply.id);

          generated++;
          console.log(`   ✅ Generated (${newStatus}): "${replyText.substring(0, 50)}..."`);

        } catch (genError) {
          console.error(`   ❌ Error generating reply:`, genError);
          await supabase
            .from('linkedin_self_post_comment_replies')
            .update({
              status: 'failed',
              failure_reason: genError instanceof Error ? genError.message : 'Generation failed',
              updated_at: new Date().toISOString()
            })
            .eq('id', reply.id);
          failed++;
          errors.push(`Reply ${reply.id}: Generation failed`);
        }
      }
    }

    // ============================================
    // PHASE 2: Post scheduled replies to LinkedIn
    // ============================================

    const now = new Date();
    const { data: scheduledReplies, error: fetchScheduledError } = await supabase
      .from('linkedin_self_post_comment_replies')
      .select(`
        *,
        monitor:linkedin_self_post_monitors!inner (
          id,
          workspace_id,
          post_social_id,
          post_ugc_id,
          replies_sent_today,
          max_replies_per_day
        )
      `)
      .eq('status', 'scheduled')
      .lte('scheduled_post_time', now.toISOString())
      .order('scheduled_post_time', { ascending: true })
      .limit(1); // Post max 1 per run (rate limiting)

    if (fetchScheduledError) {
      console.error('Error fetching scheduled replies:', fetchScheduledError);
    }

    if (scheduledReplies && scheduledReplies.length > 0) {
      console.log(`\n📤 Posting ${scheduledReplies.length} scheduled replies...`);

      for (const reply of scheduledReplies) {
        try {
          // Check daily limit
          if ((reply.monitor.replies_sent_today || 0) >= (reply.monitor.max_replies_per_day || 20)) {
            console.log(`   ⚠️ Daily limit reached for monitor ${reply.monitor.id}`);
            continue;
          }

          // Claim the reply (prevent race conditions)
          const { error: claimError } = await supabase
            .from('linkedin_self_post_comment_replies')
            .update({ status: 'posting', updated_at: new Date().toISOString() })
            .eq('id', reply.id)
            .eq('status', 'scheduled');

          if (claimError) {
            console.log(`   ⚠️ Could not claim reply ${reply.id}`);
            continue;
          }

          // Get LinkedIn account
          const { data: linkedinAccount } = await supabase
            .from('workspace_accounts')
            .select('unipile_account_id')
            .eq('workspace_id', reply.monitor.workspace_id)
            .eq('account_type', 'linkedin')
            .in('connection_status', VALID_CONNECTION_STATUSES)
            .limit(1)
            .single();

          if (!linkedinAccount) {
            throw new Error('No connected LinkedIn account');
          }

          // Post the threaded reply
          const postId = reply.monitor.post_social_id || reply.monitor.post_ugc_id;
          console.log(`   📤 Posting reply to comment ${reply.comment_linkedin_id}...`);

          const postResult = await postThreadedReply(
            postId,
            reply.comment_linkedin_id,
            reply.reply_text,
            linkedinAccount.unipile_account_id
          );

          if (postResult.success) {
            // Update reply as posted
            await supabase
              .from('linkedin_self_post_comment_replies')
              .update({
                status: 'posted',
                posted_at: new Date().toISOString(),
                reply_linkedin_id: postResult.replyId,
                updated_at: new Date().toISOString()
              })
              .eq('id', reply.id);

            // Update monitor counters
            await supabase
              .from('linkedin_self_post_monitors')
              .update({
                total_replies_sent: (reply.monitor.total_replies_sent || 0) + 1,
                replies_sent_today: (reply.monitor.replies_sent_today || 0) + 1,
                updated_at: new Date().toISOString()
              })
              .eq('id', reply.monitor.id);

            posted++;
            console.log(`   ✅ Reply posted successfully`);

            // ============================================
            // PHASE 2B: Score commenter and queue lead capture
            // ============================================
            try {
              // Check if lead capture is enabled for this monitor
              const { data: monitorSettings } = await supabase
                .from('linkedin_self_post_monitors')
                .select('auto_connect_enabled, auto_connect_min_score, auto_connect_message, dm_sequence_campaign_id, crm_sync_enabled, crm_provider, crm_list_id, crm_tags, lead_source_label')
                .eq('id', reply.monitor.id)
                .single();

              if (monitorSettings?.auto_connect_enabled || monitorSettings?.crm_sync_enabled) {
                console.log(`   📊 Scoring commenter: ${reply.commenter_name}...`);

                // Fetch commenter profile from LinkedIn
                const commenterProfile = await fetchCommenterProfile(
                  reply.commenter_provider_id || reply.commenter_linkedin_url?.split('/in/')[1]?.replace(/\/$/, '') || '',
                  linkedinAccount.unipile_account_id
                );

                if (commenterProfile) {
                  // Get workspace scoring rules or use defaults
                  const { data: customRules } = await supabase
                    .from('linkedin_lead_scoring_rules')
                    .select('*')
                    .eq('workspace_id', reply.monitor.workspace_id)
                    .single();

                  const scoringRules: ScoringRules = customRules ? {
                    title_keywords: customRules.title_keywords || DEFAULT_SCORING_RULES.title_keywords,
                    company_size_scoring: customRules.company_size_scoring || DEFAULT_SCORING_RULES.company_size_scoring,
                    target_industries: customRules.target_industries || DEFAULT_SCORING_RULES.target_industries,
                    industry_bonus: customRules.industry_bonus ?? DEFAULT_SCORING_RULES.industry_bonus,
                    first_degree_bonus: customRules.first_degree_bonus ?? DEFAULT_SCORING_RULES.first_degree_bonus,
                    second_degree_bonus: customRules.second_degree_bonus ?? DEFAULT_SCORING_RULES.second_degree_bonus,
                    third_degree_bonus: customRules.third_degree_bonus ?? DEFAULT_SCORING_RULES.third_degree_bonus,
                    comment_length_bonus: customRules.comment_length_bonus ?? DEFAULT_SCORING_RULES.comment_length_bonus,
                    question_bonus: customRules.question_bonus ?? DEFAULT_SCORING_RULES.question_bonus,
                    min_score_for_cr: monitorSettings.auto_connect_min_score || customRules.min_score_for_cr || DEFAULT_SCORING_RULES.min_score_for_cr,
                    min_score_for_dm_sequence: customRules.min_score_for_dm_sequence ?? DEFAULT_SCORING_RULES.min_score_for_dm_sequence,
                    min_score_for_crm_sync: customRules.min_score_for_crm_sync ?? DEFAULT_SCORING_RULES.min_score_for_crm_sync
                  } : DEFAULT_SCORING_RULES;

                  // Score the commenter
                  const scoreBreakdown = scoreCommenter(
                    commenterProfile,
                    reply.comment_text,
                    scoringRules
                  );

                  console.log(`   📈 Score: ${scoreBreakdown.total_score} (CR: ${scoreBreakdown.qualifying_actions.connection_request}, DM: ${scoreBreakdown.qualifying_actions.dm_sequence})`);

                  // Update reply record with commenter profile and score
                  await supabase
                    .from('linkedin_self_post_comment_replies')
                    .update({
                      commenter_score: scoreBreakdown.total_score,
                      commenter_title: commenterProfile.title,
                      commenter_company: commenterProfile.company,
                      commenter_location: commenterProfile.location,
                      commenter_connections: commenterProfile.connections,
                      commenter_is_1st_degree: commenterProfile.connection_degree === '1st',
                      score_breakdown: scoreBreakdown,
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', reply.id);

                  // Queue connection request if score meets threshold
                  if (monitorSettings.auto_connect_enabled &&
                      scoreBreakdown.qualifying_actions.connection_request &&
                      commenterProfile.connection_degree !== '1st') { // Don't send CR to 1st degree connections

                    const crMessage = monitorSettings.auto_connect_message
                      ? generateCRMessage(commenterProfile, reply.monitor.post_title || '', monitorSettings.auto_connect_message)
                      : generateCRMessage(commenterProfile, reply.monitor.post_title || '');

                    // Queue the connection request action
                    await supabase
                      .from('linkedin_lead_capture_queue')
                      .upsert({
                        workspace_id: reply.monitor.workspace_id,
                        comment_reply_id: reply.id,
                        commenter_provider_id: commenterProfile.provider_id,
                        commenter_name: commenterProfile.name,
                        commenter_linkedin_url: commenterProfile.profile_url,
                        commenter_score: scoreBreakdown.total_score,
                        action_type: 'connection_request',
                        status: 'pending',
                        scheduled_for: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min delay
                        action_data: {
                          message: crMessage,
                          account_id: linkedinAccount.unipile_account_id,
                          dm_sequence_campaign_id: monitorSettings.dm_sequence_campaign_id,
                          score_breakdown: scoreBreakdown
                        }
                      }, {
                        onConflict: 'comment_reply_id,action_type'
                      });

                    console.log(`   🎯 Queued CR for ${commenterProfile.name} (score: ${scoreBreakdown.total_score})`);
                  }

                  // Queue CRM sync if enabled
                  if (monitorSettings.crm_sync_enabled &&
                      scoreBreakdown.qualifying_actions.crm_sync) {

                    await supabase
                      .from('linkedin_lead_capture_queue')
                      .upsert({
                        workspace_id: reply.monitor.workspace_id,
                        comment_reply_id: reply.id,
                        commenter_provider_id: commenterProfile.provider_id,
                        commenter_name: commenterProfile.name,
                        commenter_linkedin_url: commenterProfile.profile_url,
                        commenter_score: scoreBreakdown.total_score,
                        action_type: 'crm_sync',
                        status: 'pending',
                        scheduled_for: new Date().toISOString(), // Immediate
                        action_data: {
                          crm_provider: monitorSettings.crm_provider,
                          crm_list_id: monitorSettings.crm_list_id,
                          crm_tags: monitorSettings.crm_tags,
                          lead_source: monitorSettings.lead_source_label || 'LinkedIn Post Comment',
                          profile: commenterProfile,
                          score_breakdown: scoreBreakdown
                        }
                      }, {
                        onConflict: 'comment_reply_id,action_type'
                      });

                    console.log(`   📤 Queued CRM sync for ${commenterProfile.name}`);
                  }
                }
              }
            } catch (leadCaptureError) {
              // Don't fail the whole reply - log and continue
              console.error(`   ⚠️ Lead capture error:`, leadCaptureError);
            }

          } else {
            throw new Error(postResult.error || 'Post failed');
          }

        } catch (postError) {
          console.error(`   ❌ Error posting reply:`, postError);
          await supabase
            .from('linkedin_self_post_comment_replies')
            .update({
              status: 'failed',
              failure_reason: postError instanceof Error ? postError.message : 'Post failed',
              updated_at: new Date().toISOString()
            })
            .eq('id', reply.id);
          failed++;
          errors.push(`Reply ${reply.id}: Post failed`);
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`\n✅ Self-post reply processing complete`);
    console.log(`   Generated: ${generated}`);
    console.log(`   Posted: ${posted}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Duration: ${duration}ms`);

    return NextResponse.json({
      success: true,
      generated,
      posted,
      failed,
      errors: errors.length > 0 ? errors : undefined,
      duration_ms: duration
    });

  } catch (error) {
    console.error('❌ Self-post reply processing error:', error);
    return NextResponse.json({
      error: 'Failed to process replies',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET for manual testing
export async function GET(req: NextRequest) {
  const testReq = new NextRequest(req.url, {
    method: 'POST',
    headers: {
      'x-cron-secret': process.env.CRON_SECRET || ''
    }
  });
  return POST(testReq);
}
