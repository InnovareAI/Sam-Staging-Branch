import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/app/lib/supabase';
import { getClaudeClient } from '@/lib/llm/claude-client';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const commentId = params.id;

    const supabase = await createServerSupabaseClient();

    // Get the post details
    const { data: post, error: fetchError } = await supabase
      .from('linkedin_posts_discovered')
      .select(`
        *,
        linkedin_post_monitors!inner(
          workspace_id,
          name
        )
      `)
      .eq('id', commentId)
      .single();

    if (fetchError || !post) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Get brand guidelines for the workspace
    const { data: guidelines } = await supabase
      .from('linkedin_brand_guidelines')
      .select('*')
      .eq('workspace_id', (post.linkedin_post_monitors as any).workspace_id)
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

Post Author: ${post.post_author}
${post.post_author_headline ? `Author Headline: ${post.post_author_headline}` : ''}

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

    // Update the comment
    const { data: updated, error: updateError } = await supabase
      .from('linkedin_posts_discovered')
      .update({
        generated_comment: newComment,
        regenerated_at: new Date().toISOString()
      })
      .eq('id', commentId)
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
