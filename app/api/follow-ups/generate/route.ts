/**
 * Follow-up Agent - Generate Follow-up Message
 * Called by N8N to generate AI-powered follow-up message
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { generateFollowUpMessage, FollowUpContext } from '@/lib/services/follow-up-agent';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60 seconds for AI generation

export async function POST(request: NextRequest) {
  try {
    // Verify N8N internal trigger
    const triggerHeader = request.headers.get('x-internal-trigger');
    if (triggerHeader !== 'n8n-followup-agent') {
      return NextResponse.json(
        { error: 'Unauthorized - N8N trigger required' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.follow_up_id || !body.prospect || !body.campaign) {
      return NextResponse.json(
        { error: 'Missing required fields: follow_up_id, prospect, campaign' },
        { status: 400 }
      );
    }

    console.log('🔄 Generating follow-up:', {
      follow_up_id: body.follow_up_id,
      prospect: body.prospect.name,
      attempt: body.follow_up_attempt
    });

    // Build context for follow-up generation
    const context: FollowUpContext = {
      follow_up_id: body.follow_up_id,
      prospect: {
        id: body.prospect.id,
        name: body.prospect.name,
        email: body.prospect.email,
        company: body.prospect.company,
        title: body.prospect.title,
        linkedin_url: body.prospect.linkedin_url,
        company_website: body.prospect.company_website
      },
      campaign: {
        id: body.campaign.id,
        name: body.campaign.name,
        channel: body.campaign.channel
      },
      conversation_history: body.conversation_history || {},
      follow_up_attempt: body.follow_up_attempt || 1,
      days_since_last_contact: body.days_since_last_contact || 0
    };

    // Generate follow-up message using AI
    const generatedFollowUp = await generateFollowUpMessage(context);

    console.log('✅ Follow-up generated:', {
      follow_up_id: body.follow_up_id,
      tone: generatedFollowUp.tone,
      confidence: generatedFollowUp.confidence_score,
      subject_length: generatedFollowUp.subject.length,
      message_length: generatedFollowUp.message.length
    });

    // Return generated follow-up data
    return NextResponse.json({
      follow_up_id: body.follow_up_id,
      prospect_id: body.prospect.id,
      prospect_name: body.prospect.name,
      campaign_id: body.campaign.id,
      campaign_channel: body.campaign.channel,
      follow_up_attempt: body.follow_up_attempt,
      workspace_id: body.workspace_id,
      generated_subject: generatedFollowUp.subject,
      generated_message: generatedFollowUp.message,
      generated_tone: generatedFollowUp.tone,
      confidence_score: generatedFollowUp.confidence_score,
      metadata: generatedFollowUp.metadata,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error generating follow-up:', error);
    return NextResponse.json(
      {
        error: 'Follow-up generation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
