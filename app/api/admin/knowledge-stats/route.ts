import { requireAdmin } from '@/lib/security/route-auth';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Admin API for Knowledge Classification Statistics and Management

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// GET /api/admin/knowledge-stats - Get knowledge classification statistics
export async function GET(req: NextRequest) {

  // Require admin authentication
  const { error: authError } = await requireAdmin(req);
  if (authError) return authError;
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const organizationId = searchParams.get('organizationId');
    const timeRange = searchParams.get('timeRange') as 'day' | 'week' | 'month' | 'all' || 'all';

    // Get overall conversation statistics
    const { data: conversations, error: convError } = await supabaseAdmin
      .from('sam_conversations')
      .select('id, user_id, organization_id, knowledge_extracted, extraction_confidence, created_at')
      .order('created_at', { ascending: false });

    if (convError) {
      console.error('Error fetching conversations:', convError);
      return NextResponse.json({ error: convError.message }, { status: 400 });
    }

    // Get extracted knowledge statistics
    const { data: extractedKnowledge, error: knowledgeError } = await supabaseAdmin
      .from('sam_extracted_knowledge')
      .select('knowledge_type, category, confidence_score, sharing_scope, data_sensitivity, created_at, is_active')
      .eq('is_active', true);

    if (knowledgeError) {
      console.error('Error fetching extracted knowledge:', knowledgeError);
      return NextResponse.json({ error: knowledgeError.message }, { status: 400 });
    }

    // Get knowledge patterns performance
    const { data: patterns, error: patternsError } = await supabaseAdmin
      .from('sam_knowledge_patterns')
      .select('pattern_name, knowledge_type, category, accuracy_score, true_positive_count, false_positive_count');

    if (patternsError) {
      console.error('Error fetching patterns:', patternsError);
      return NextResponse.json({ error: patternsError.message }, { status: 400 });
    }

    // Calculate statistics
    const stats = {
      conversations: {
        total: conversations?.length || 0,
        processed: conversations?.filter(c => c.knowledge_extracted).length || 0,
        pending: conversations?.filter(c => !c.knowledge_extracted).length || 0,
        avgConfidence: conversations?.length 
          ? conversations.filter(c => c.extraction_confidence > 0)
              .reduce((sum, c) => sum + (c.extraction_confidence || 0), 0) / 
            conversations.filter(c => c.extraction_confidence > 0).length
          : 0
      },
      knowledge: {
        personal: extractedKnowledge?.filter(k => k.knowledge_type === 'personal').length || 0,
        team_shareable: extractedKnowledge?.filter(k => k.knowledge_type === 'team_shareable').length || 0,
        by_category: extractedKnowledge?.reduce((acc, k) => {
          acc[k.category] = (acc[k.category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {},
        by_sensitivity: extractedKnowledge?.reduce((acc, k) => {
          acc[k.data_sensitivity] = (acc[k.data_sensitivity] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {},
        avgConfidence: extractedKnowledge?.length 
          ? extractedKnowledge.reduce((sum, k) => sum + k.confidence_score, 0) / extractedKnowledge.length
          : 0
      },
      patterns: {
        total: patterns?.length || 0,
        personal: patterns?.filter(p => p.knowledge_type === 'personal').length || 0,
        team_shareable: patterns?.filter(p => p.knowledge_type === 'team_shareable').length || 0,
        by_accuracy: patterns?.reduce((acc, p) => {
          const bucket = p.accuracy_score >= 0.8 ? 'high' : 
                        p.accuracy_score >= 0.6 ? 'medium' : 'low';
          acc[bucket] = (acc[bucket] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {},
        topPerforming: patterns?.sort((a, b) => b.accuracy_score - a.accuracy_score).slice(0, 5).map(p => ({
          name: p.pattern_name,
          accuracy: p.accuracy_score,
          category: p.category,
          truePositives: p.true_positive_count
        })) || []
      }
      // TODO: Implement knowledge extraction service
      // extraction: {
      //   queue: knowledgeExtractionService.getQueueStatus(),
      //   stats: await knowledgeExtractionService.getKnowledgeStats(userId || undefined, organizationId || undefined, timeRange)
      // }
    };

    // Get privacy preferences statistics
    const { data: privacyPrefs } = await supabaseAdmin
      .from('sam_user_privacy_preferences')
      .select('communication_style_sharing, professional_context_sharing, customer_intelligence_sharing, auto_knowledge_extraction');

    const privacyStats = {
      totalUsers: privacyPrefs?.length || 0,
      autoExtractionEnabled: privacyPrefs?.filter(p => p.auto_knowledge_extraction).length || 0,
      sharingPreferences: {
        communication_style_org: privacyPrefs?.filter(p => p.communication_style_sharing === 'organization').length || 0,
        professional_context_org: privacyPrefs?.filter(p => p.professional_context_sharing === 'organization').length || 0,
        customer_intelligence_org: privacyPrefs?.filter(p => p.customer_intelligence_sharing === 'organization').length || 0
      }
    };

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats,
      privacy: privacyStats
    });

  } catch (error) {
    console.error('Knowledge stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/knowledge-stats - Trigger knowledge extraction actions
export async function POST(req: NextRequest) {

  // Require admin authentication
  const { error: authError } = await requireAdmin(req);
  if (authError) return authError;
  try {
    const { action, conversationIds, priority } = await req.json();

    let result;

    switch (action) {
      case 'extract_pending':
        // TODO: Implement knowledge extraction service
        result = { message: 'Knowledge extraction service not implemented' };
        break;

      case 'retry_failed':
        // TODO: Implement knowledge extraction service
        result = { message: 'Knowledge extraction service not implemented' };
        break;

      case 'queue_conversations':
        if (!conversationIds || !Array.isArray(conversationIds)) {
          return NextResponse.json(
            { error: 'conversationIds array required' },
            { status: 400 }
          );
        }
        
        // Get conversation details and queue for extraction
        const { data: conversations } = await supabaseAdmin
          .from('sam_conversations')
          .select('id, user_id, organization_id')
          .in('id', conversationIds);

        // TODO: Implement knowledge extraction service
        // if (conversations) {
        //   for (const conv of conversations) {
        //     if (conv.user_id) {
        //       await knowledgeExtractionService.queueExtraction(
        //         conv.id,
        //         conv.user_id,
        //         conv.organization_id,
        //         priority || 'medium'
        //       );
        //     }
        //   }
        // }
        
        result = { 
          message: `Queued ${conversations?.length || 0} conversations for extraction`,
          queued: conversations?.length || 0
        };
        break;

      case 'update_patterns':
        // This would update ML patterns based on performance
        result = { message: 'Pattern update not implemented yet' };
        break;
        
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: extract_pending, retry_failed, queue_conversations, update_patterns' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action,
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Knowledge stats POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/knowledge-stats - Update knowledge classification settings
export async function PUT(req: NextRequest) {

  // Require admin authentication
  const { error: authError } = await requireAdmin(req);
  if (authError) return authError;
  try {
    const { userId, privacyPreferences, patternUpdates } = await req.json();

    const results: any = {};

    // Update user privacy preferences
    // TODO: Implement knowledge classifier
    // if (userId && privacyPreferences) {
    //   const success = await knowledgeClassifier.updatePrivacyPreferences(
    //     userId,
    //     privacyPreferences
    //   );
    //   results.privacyUpdate = { success, userId };
    // }

    // Update pattern performance (would need implementation)
    if (patternUpdates && Array.isArray(patternUpdates)) {
      const { data, error } = await supabaseAdmin
        .from('sam_knowledge_patterns')
        .upsert(patternUpdates);
      
      results.patternsUpdate = { 
        success: !error, 
        error: error?.message,
        updatedCount: patternUpdates.length
      };
    }

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Knowledge stats PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/knowledge-stats - Clean up knowledge data
export async function DELETE(req: NextRequest) {

  // Require admin authentication
  const { error: authError } = await requireAdmin(req);
  if (authError) return authError;
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const userId = searchParams.get('userId');
    const organizationId = searchParams.get('organizationId');
    const olderThan = searchParams.get('olderThan'); // days

    let result;

    switch (action) {
      case 'cleanup_old':
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - parseInt(olderThan || '90'));
        
        const { data, error } = await supabaseAdmin
          .from('sam_extracted_knowledge')
          .update({ is_active: false })
          .lt('created_at', cutoffDate.toISOString());
        
        result = {
          message: `Cleaned up knowledge older than ${olderThan || 90} days`,
          error: error?.message
        };
        break;

      case 'delete_user_data':
        if (!userId) {
          return NextResponse.json(
            { error: 'userId required for user data deletion' },
            { status: 400 }
          );
        }
        
        // Delete user's personal knowledge
        const { error: deleteError } = await supabaseAdmin
          .from('sam_extracted_knowledge')
          .delete()
          .eq('user_id', userId)
          .eq('knowledge_type', 'personal');
        
        result = {
          message: `Deleted personal knowledge for user ${userId}`,
          error: deleteError?.message
        };
        break;

      case 'archive_organization':
        if (!organizationId) {
          return NextResponse.json(
            { error: 'organizationId required for organization archival' },
            { status: 400 }
          );
        }
        
        const { error: archiveError } = await supabaseAdmin
          .from('sam_extracted_knowledge')
          .update({ is_active: false })
          .eq('organization_id', organizationId);
        
        result = {
          message: `Archived knowledge for organization ${organizationId}`,
          error: archiveError?.message
        };
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: cleanup_old, delete_user_data, archive_organization' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action,
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Knowledge stats DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
