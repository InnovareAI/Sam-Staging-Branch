import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/app/lib/supabase';
import { pool } from '@/lib/db';
import { getClaudeClient } from '@/lib/llm/claude-client';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const postId = params.id;

    const supabase = pool;

    // Get the post details - postId is from linkedin_posts_discovered
    const { data: post, error: fetchError } = await supabase
      .from('linkedin_posts_discovered')
      .select(`
        *,
        linkedin_post_monitors!inner(
          workspace_id,
          name
        )
      `)
      .eq('id', postId)
      .single();

    if (fetchError || !post) {
      console.error('Post not found:', postId, fetchError);
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const workspaceId = (post.linkedin_post_monitors as any).workspace_id;

    // Get brand guidelines for the workspace
    const { data: guidelines } = await supabase
      .from('linkedin_brand_guidelines')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .maybeSingle();

    // Generate new comment using Claude
    const claude = getClaudeClient();

    const systemPrompt = guidelines?.system_prompt || `You are a professional LinkedIn engagement assistant. Generate thoughtful, relevant comments on LinkedIn posts that:
- Add value to the conversation
- Are professional but personable
- Reference specific points from the post
- Are concise (150-300 characters)
- Don't use excessive emojis or exclamation marks
- Feel authentic and human`;

    const userPrompt = `Generate a new comment for this LinkedIn post.

Post Author: ${post.author_name}
${post.author_title ? `Author Headline: ${post.author_title}` : ''}

Post Content:
${post.post_content}

${guidelines?.tone_of_voice ? `Tone of Voice: ${guidelines.tone_of_voice}` : ''}
${guidelines?.comment_length ? `Comment Length: ${guidelines.comment_length}` : ''}

Generate a single comment that engages with the post content.`;

    const response = await claude.complete(userPrompt, {
      system: systemPrompt,
      maxTokens: 500,
      temperature: 0.7
    });

    // Clean up the response
    const newComment = response.trim().replace(/^["']|["']$/g, '');

    // Update the comment in linkedin_post_comments table
    const { data: updated, error: updateError } = await supabase
      .from('linkedin_post_comments')
      .update({
        comment_text: newComment,
        updated_at: new Date().toISOString()
      })
      .eq('post_id', postId)
      .eq('status', 'pending_approval')
      .select()
      .single();

    if (updateError) {
      console.error('Error updating comment:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      comment: newComment,
      post: updated
    });

  } catch (error) {
    console.error('Error in regenerate endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate comment' },
      { status: 500 }
    );
  }
}
