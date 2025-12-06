/**
 * Comment Feedback Endpoint
 * GET /api/linkedin-commenting/comments/[id]/feedback?rating=good|bad
 *
 * Records user feedback on AI-generated comments for SAM learning.
 * Called from email digest links.
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// HTML response template for email clicks
function htmlResponse(title: string, message: string, success: boolean, emoji: string): Response {
  const bgColor = success ? '#8b5cf6' : '#ef4444';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 40px 20px;
      background: #111827;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #1f2937;
      border-radius: 16px;
      padding: 40px;
      max-width: 400px;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .icon {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: ${bgColor};
      color: white;
      font-size: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }
    h1 {
      color: #f3f4f6;
      font-size: 24px;
      margin: 0 0 12px;
    }
    p {
      color: #9ca3af;
      font-size: 16px;
      margin: 0 0 24px;
      line-height: 1.5;
    }
    .close-link {
      color: #ec4899;
      text-decoration: none;
      font-size: 14px;
    }
    .close-link:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${emoji}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="https://app.meet-sam.com" class="close-link">Go to SAM Dashboard →</a>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: success ? 200 : 400,
    headers: { 'Content-Type': 'text/html' }
  });
}

// GET handler for email link clicks
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: commentId } = await params;
    const rating = request.nextUrl.searchParams.get('rating');

    // Validate rating
    if (!rating || !['good', 'bad'].includes(rating)) {
      return htmlResponse(
        'Invalid Feedback',
        'Please use the feedback links from your email.',
        false,
        '?'
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // First, get the current comment to check if it exists
    const { data: comment, error: fetchError } = await supabase
      .from('linkedin_post_comments')
      .select('id, workspace_id, comment_text, generation_metadata')
      .eq('id', commentId)
      .single();

    if (fetchError || !comment) {
      console.error('Error fetching comment:', fetchError);
      return htmlResponse(
        'Comment Not Found',
        'We couldn\'t find this comment. It may have been deleted.',
        false,
        '?'
      );
    }

    // Try to update the comment with feedback (may fail if columns don't exist yet)
    const { error: updateError } = await supabase
      .from('linkedin_post_comments')
      .update({
        user_feedback: rating,
        feedback_at: new Date().toISOString()
      })
      .eq('id', commentId);

    // If update fails due to missing columns, that's OK - we'll still log it
    if (updateError) {
      console.log('Note: Could not update feedback columns (may not exist yet):', updateError.message);
    }

    // Log feedback for analytics (can be used for training later)
    console.log(`📊 Feedback recorded: ${rating} for comment ${commentId.substring(0, 8)}`);

    // Also insert into a feedback analytics table if we want detailed tracking
    // This can be used for ML training later
    await supabase
      .from('comment_feedback_log')
      .insert({
        comment_id: commentId,
        workspace_id: comment.workspace_id,
        rating: rating,
        comment_text: comment.comment_text,
        generation_metadata: comment.generation_metadata
      })
      .then(({ error }) => {
        // Don't fail if this table doesn't exist yet
        if (error && !error.message.includes('does not exist')) {
          console.error('Error logging feedback:', error);
        }
      });

    if (rating === 'good') {
      return htmlResponse(
        'Thanks for the Feedback!',
        'SAM will learn from this and continue generating similar comments.',
        true,
        '👍'
      );
    } else {
      return htmlResponse(
        'Thanks for the Feedback!',
        'SAM will learn from this and improve future comments.',
        true,
        '👎'
      );
    }

  } catch (error) {
    console.error('Error in feedback endpoint:', error);
    return htmlResponse(
      'Something Went Wrong',
      'Please try again or contact support.',
      false,
      '?'
    );
  }
}
