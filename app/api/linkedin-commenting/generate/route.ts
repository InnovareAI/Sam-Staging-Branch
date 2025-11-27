/**
 * LinkedIn Commenting Agent - Generate Comment
 * Called by N8N to generate AI comment for a discovered post
 */

import { createClient } from '@/app/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  generateLinkedInComment,
  CommentGenerationContext,
  shouldSkipPost,
  validateCommentQuality,
  BrandGuidelines
} from '@/lib/services/linkedin-commenting-agent';
import { buildKBContextForSAM } from '@/lib/sam-kb-integration';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60 seconds for AI generation

export async function POST(request: NextRequest) {
  try {
    // Verify N8N internal trigger
    const triggerHeader = request.headers.get('x-internal-trigger');
    if (triggerHeader !== 'n8n-commenting-agent') {
      return NextResponse.json(
        { error: 'Unauthorized - N8N trigger required' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.post_id || !body.workspace_id) {
      return NextResponse.json(
        { error: 'Missing required fields: post_id, workspace_id' },
        { status: 400 }
      );
    }

    console.log('💬 Generating comment for post:', {
      post_id: body.post_id,
      workspace_id: body.workspace_id
    });

    const supabase = await createClient();

    // Get post details
    const { data: post, error: postError } = await supabase
      .from('linkedin_posts_discovered')
      .select('*')
      .eq('id', body.post_id)
      .single();

    if (postError || !post) {
      return NextResponse.json(
        { error: 'Post not found', details: postError?.message },
        { status: 404 }
      );
    }

    // Get workspace context
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('name, metadata')
      .eq('id', body.workspace_id)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Load brand guidelines from linkedin_brand_guidelines table (new comprehensive settings)
    const { data: brandGuidelinesData } = await supabase
      .from('linkedin_brand_guidelines')
      .select('*')
      .eq('workspace_id', body.workspace_id)
      .eq('is_active', true)
      .maybeSingle();

    // Convert DB data to BrandGuidelines interface
    const brandGuidelines: BrandGuidelines | undefined = brandGuidelinesData ? {
      id: brandGuidelinesData.id,
      // Quick Settings
      tone: brandGuidelinesData.tone || 'professional',
      formality: brandGuidelinesData.formality || 'semi_formal',
      comment_length: brandGuidelinesData.comment_length || 'medium',
      question_frequency: brandGuidelinesData.question_frequency || 'sometimes',
      perspective_style: brandGuidelinesData.perspective_style || 'additive',
      confidence_level: brandGuidelinesData.confidence_level || 'balanced',
      use_workspace_knowledge: brandGuidelinesData.use_workspace_knowledge ?? false,
      // Expertise
      what_you_do: brandGuidelinesData.what_you_do,
      what_youve_learned: brandGuidelinesData.what_youve_learned,
      pov_on_future: brandGuidelinesData.pov_on_future,
      industry_talking_points: brandGuidelinesData.industry_talking_points,
      // Brand Voice
      voice_reference: brandGuidelinesData.voice_reference,
      tone_of_voice: brandGuidelinesData.tone_of_voice || '',
      writing_style: brandGuidelinesData.writing_style,
      dos_and_donts: brandGuidelinesData.dos_and_donts,
      // Vibe Check
      okay_funny: brandGuidelinesData.okay_funny ?? true,
      okay_blunt: brandGuidelinesData.okay_blunt ?? true,
      casual_openers: brandGuidelinesData.casual_openers ?? true,
      personal_experience: brandGuidelinesData.personal_experience ?? true,
      strictly_professional: brandGuidelinesData.strictly_professional ?? false,
      // Comment Framework
      framework_preset: brandGuidelinesData.framework_preset || 'aca_i',
      custom_framework: brandGuidelinesData.custom_framework,
      max_characters: brandGuidelinesData.max_characters || 300,
      // Example Comments
      example_comments: brandGuidelinesData.example_comments,
      admired_comments: brandGuidelinesData.admired_comments,
      // Relationship & Context
      default_relationship_tag: brandGuidelinesData.default_relationship_tag || 'unknown',
      comment_scope: brandGuidelinesData.comment_scope || 'my_expertise',
      auto_skip_generic: brandGuidelinesData.auto_skip_generic ?? false,
      post_age_awareness: brandGuidelinesData.post_age_awareness ?? true,
      recent_comment_memory: brandGuidelinesData.recent_comment_memory ?? true,
      // Guardrails
      competitors_never_mention: brandGuidelinesData.competitors_never_mention,
      end_with_cta: brandGuidelinesData.end_with_cta || 'never',
      cta_style: brandGuidelinesData.cta_style || 'question_only',
      // Scheduling
      timezone: brandGuidelinesData.timezone,
      posting_start_time: brandGuidelinesData.posting_start_time,
      posting_end_time: brandGuidelinesData.posting_end_time,
      post_on_weekends: brandGuidelinesData.post_on_weekends,
      post_on_holidays: brandGuidelinesData.post_on_holidays,
      // Advanced
      system_prompt: brandGuidelinesData.system_prompt
    } : undefined;

    // Build Knowledge Base context if use_workspace_knowledge is enabled
    let knowledgeBaseContext: string | undefined;
    if (brandGuidelines?.use_workspace_knowledge) {
      try {
        knowledgeBaseContext = await buildKBContextForSAM(body.workspace_id);
        console.log('📚 KB context loaded for commenting agent:', {
          workspace_id: body.workspace_id,
          context_length: knowledgeBaseContext?.length || 0
        });
      } catch (kbError) {
        console.warn('⚠️ Failed to load KB context, continuing without it:', kbError);
      }
    }

    // Fallback: Get basic knowledge base snippets if KB context not available
    let knowledgeSnippets: string[] = [];
    if (!knowledgeBaseContext) {
      const { data: snippets } = await supabase
        .from('knowledge_base')
        .select('content')
        .eq('workspace_id', body.workspace_id)
        .limit(3);
      knowledgeSnippets = snippets?.map(k => k.content) || [];
    }

    // Check if post author is a prospect
    const { data: prospect } = await supabase
      .from('workspace_prospects')
      .select('id, campaign_id, status, notes')
      .eq('workspace_id', body.workspace_id)
      .eq('linkedin_url', post.author_profile_url)
      .single();

    // Build context for AI with both legacy and new settings
    const workspaceContext = {
      workspace_id: body.workspace_id,
      company_name: workspace.name || 'Our Company',
      expertise_areas: workspace.metadata?.expertise_areas || [],
      products: workspace.metadata?.products || [],
      value_props: workspace.metadata?.value_propositions || [],
      tone_of_voice: workspace.metadata?.tone_of_voice || 'professional_friendly',
      // Legacy: Basic KB snippets
      knowledge_base_snippets: knowledgeSnippets,
      // Legacy: AI settings from workspace metadata
      commenting_agent_settings: workspace.metadata?.commenting_agent_settings || undefined,
      // NEW: Comprehensive brand guidelines from linkedin_brand_guidelines table
      brand_guidelines: brandGuidelines,
      // NEW: Full KB context when use_workspace_knowledge is enabled
      knowledge_base_context: knowledgeBaseContext
    };

    // Check if we should skip this post
    const skipCheck = shouldSkipPost({
      id: post.id,
      post_linkedin_id: post.post_linkedin_id,
      post_social_id: post.post_social_id,
      post_text: post.post_text,
      post_type: post.post_type,
      author: {
        linkedin_id: post.author_linkedin_id,
        name: post.author_name,
        title: post.author_title,
        company: post.author_company,
        profile_url: post.author_profile_url
      },
      engagement: {
        likes_count: post.likes_count,
        comments_count: post.comments_count,
        shares_count: post.shares_count
      },
      posted_at: new Date(post.posted_at),
      discovered_via_monitor_type: post.monitor_type,
      matched_keywords: post.matched_keywords
    }, workspaceContext);

    if (skipCheck.should_skip) {
      // Update post status to skipped
      await supabase
        .from('linkedin_posts_discovered')
        .update({
          status: 'skipped',
          skip_reason: skipCheck.reason
        })
        .eq('id', post.id);

      return NextResponse.json({
        skipped: true,
        reason: skipCheck.reason,
        post_id: post.id
      });
    }

    // Build generation context
    const generationContext: CommentGenerationContext = {
      post: {
        id: post.id,
        post_linkedin_id: post.post_linkedin_id,
        post_social_id: post.post_social_id || post.post_linkedin_id,
        post_text: post.post_text,
        post_type: post.post_type,
        author: {
          linkedin_id: post.author_linkedin_id,
          name: post.author_name,
          title: post.author_title,
          company: post.author_company,
          profile_url: post.author_profile_url
        },
        engagement: {
          likes_count: post.likes_count,
          comments_count: post.comments_count,
          shares_count: post.shares_count
        },
        posted_at: new Date(post.posted_at),
        discovered_via_monitor_type: post.monitor_type,
        matched_keywords: post.matched_keywords
      },
      workspace: workspaceContext,
      prospect: prospect ? {
        is_prospect: true,
        prospect_id: prospect.id,
        campaign_id: prospect.campaign_id,
        relationship_stage: prospect.status,
        notes: prospect.notes
      } : undefined
    };

    // Generate comment
    const generatedComment = await generateLinkedInComment(generationContext);

    // Validate quality
    const qualityCheck = validateCommentQuality(generatedComment);
    if (!qualityCheck.valid) {
      console.warn('⚠️ Generated comment failed quality check:', qualityCheck.issues);

      // Update post status
      await supabase
        .from('linkedin_posts_discovered')
        .update({
          status: 'failed',
          skip_reason: `Quality check failed: ${qualityCheck.issues.join(', ')}`
        })
        .eq('id', post.id);

      return NextResponse.json({
        error: 'Comment quality check failed',
        issues: qualityCheck.issues
      }, { status: 400 });
    }

    // Determine if approval required
    const requiresApproval = generatedComment.confidence_score < 0.80 || prospect?.is_prospect;

    // Save to comment queue
    const { data: commentQueue, error: queueError } = await supabase
      .from('linkedin_comment_queue')
      .insert({
        workspace_id: body.workspace_id,
        post_id: post.id,
        post_linkedin_id: post.post_linkedin_id,
        post_social_id: post.post_social_id || post.post_linkedin_id,
        comment_text: generatedComment.comment_text,
        confidence_score: generatedComment.confidence_score,
        generation_metadata: generatedComment.generation_metadata,
        approval_status: requiresApproval ? 'pending' : 'auto_approved',
        requires_approval: requiresApproval,
        auto_post_threshold: 0.80,
        status: 'queued',
        metadata: {
          reasoning: generatedComment.reasoning,
          quality_indicators: generatedComment.quality_indicators,
          is_prospect: prospect?.is_prospect || false
        }
      })
      .select()
      .single();

    if (queueError) {
      console.error('❌ Error saving to comment queue:', queueError);
      return NextResponse.json(
        { error: 'Failed to queue comment', details: queueError.message },
        { status: 500 }
      );
    }

    // Update post status
    await supabase
      .from('linkedin_posts_discovered')
      .update({ status: 'comment_generated' })
      .eq('id', post.id);

    console.log('✅ Comment generated and queued:', {
      comment_queue_id: commentQueue.id,
      confidence: generatedComment.confidence_score,
      requires_approval: requiresApproval,
      is_prospect: prospect?.is_prospect || false
    });

    return NextResponse.json({
      success: true,
      comment_queue_id: commentQueue.id,
      comment_text: generatedComment.comment_text,
      confidence_score: generatedComment.confidence_score,
      requires_approval: requiresApproval,
      should_auto_post: !requiresApproval,
      reasoning: generatedComment.reasoning,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error generating comment:', error);
    return NextResponse.json(
      {
        error: 'Comment generation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
