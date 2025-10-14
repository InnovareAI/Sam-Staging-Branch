import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

async function getWorkspaceId(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from('users')
    .select('current_workspace_id')
    .eq('id', userId)
    .single();

  if (profile?.current_workspace_id) {
    return profile.current_workspace_id;
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  return membership?.workspace_id ?? null;
}

// Analyze individual document quality
function analyzeDocument(doc: any) {
  const feedback: Array<{
    type: 'critical' | 'warning' | 'suggestion' | 'success';
    message: string;
  }> = [];

  // Check for empty or minimal content
  const contentLength = doc.extracted_content?.length || 0;
  if (contentLength === 0) {
    feedback.push({
      type: 'critical',
      message: 'No content extracted - document may be corrupted or unsupported format'
    });
  } else if (contentLength < 500) {
    feedback.push({
      type: 'warning',
      message: 'Very short content - consider adding more detailed information'
    });
  }

  // Check for vectorization
  if (!doc.vectorized_at && !doc.vector_chunks) {
    feedback.push({
      type: 'warning',
      message: 'Not yet processed for AI search - may take a few minutes'
    });
  } else if (doc.vector_chunks > 0) {
    feedback.push({
      type: 'success',
      message: `Ready for AI search (${doc.vector_chunks} chunks)`
    });
  }

  // Check freshness
  const updated = new Date(doc.updated_at || doc.created_at);
  const monthsOld = (Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24 * 30);

  if (monthsOld > 3) {
    feedback.push({
      type: 'suggestion',
      message: `Not updated in ${Math.floor(monthsOld)} months - consider refreshing`
    });
  }

  return feedback;
}

// Analyze section health
function analyzeSectionHealth(sectionId: string, docs: any[], icpCount?: number) {
  const criticalSections = ['products', 'icp', 'messaging', 'pricing'];
  const isCritical = criticalSections.includes(sectionId);
  const docCount = docs.length;

  let status: 'excellent' | 'good' | 'needs-attention' | 'critical';
  let message: string;
  let suggestion: string;

  if (sectionId === 'icp') {
    const count = icpCount || 0;
    if (count === 0) {
      status = 'critical';
      message = 'No ICP profiles configured';
      suggestion = 'Add at least one ideal customer profile to help me target effectively';
    } else if (count === 1) {
      status = 'needs-attention';
      message = 'Only 1 ICP profile';
      suggestion = 'Add 1-2 more ICP profiles for different market segments';
    } else if (count >= 2) {
      status = 'good';
      message = `${count} ICP profiles configured`;
      suggestion = 'Consider adding personas for each ICP';
    } else {
      status = 'excellent';
      message = `${count} ICP profiles configured`;
      suggestion = 'Excellent ICP coverage';
    }
  } else {
    if (docCount === 0) {
      status = isCritical ? 'critical' : 'needs-attention';
      message = 'No documents uploaded';
      suggestion = isCritical
        ? 'CRITICAL: Upload documents immediately - I need this to function effectively'
        : 'Upload 2-3 documents to improve my knowledge';
    } else if (docCount === 1) {
      status = isCritical ? 'needs-attention' : 'good';
      message = '1 document (minimal coverage)';
      suggestion = 'Add 2-3 more documents for comprehensive coverage';
    } else if (docCount <= 3) {
      status = 'good';
      message = `${docCount} documents (good coverage)`;
      suggestion = 'Add 1-2 more for excellent coverage';
    } else {
      status = 'excellent';
      message = `${docCount} documents (comprehensive)`;
      suggestion = 'Excellent coverage - keep content fresh';
    }
  }

  return { status, message, suggestion, docCount };
}

// Analyze KB documents and provide actionable feedback
async function analyzeKBDocuments(documents: any[], icpCount: number) {
  // Section grouping
  const sectionMap: Record<string, any[]> = {};
  documents.forEach(doc => {
    const section = doc.section_id || doc.section || 'general';
    if (!sectionMap[section]) sectionMap[section] = [];
    sectionMap[section].push(doc);
  });

  const sectionCount = Object.keys(sectionMap).length;

  // Critical sections analysis
  const criticalSections = ['products', 'icp', 'messaging', 'pricing'];
  const missingCritical = criticalSections.filter(s => !sectionMap[s] || sectionMap[s].length === 0);

  if (missingCritical.length > 0) {
    feedback.push({
      type: 'critical',
      category: 'Critical Content',
      title: 'Missing Essential Sales Content',
      message: `I need ${missingCritical.join(', ')} content to effectively handle sales conversations. Without these, I may give incomplete or incorrect information to prospects.`,
      action: 'Upload documents for missing sections'
    });
  }

  // ICP analysis
  if (icpCount === 0) {
    feedback.push({
      type: 'critical',
      category: 'ICP Configuration',
      title: 'No Target Profile Defined',
      message: "I don't know who we're targeting! Without ICP configuration, I can't qualify prospects or tailor messaging effectively.",
      action: 'Configure at least one ICP profile'
    });
  }

  // Thin coverage warnings
  const thinSections = Object.entries(sectionMap)
    .filter(([section, docs]) => criticalSections.includes(section) && docs.length === 1)
    .map(([section]) => section);

  if (thinSections.length > 0) {
    feedback.push({
      type: 'warning',
      category: 'Content Depth',
      title: 'Limited Coverage in Key Sections',
      message: `The ${thinSections.join(', ')} section${thinSections.length > 1 ? 's' : ''} only ha${thinSections.length > 1 ? 've' : 's'} one document. More content will help me provide more detailed and accurate responses.`,
      action: 'Add 2-3 more documents per section'
    });
  }

  // Objection handling check
  if (!sectionMap['objections'] || sectionMap['objections'].length === 0) {
    feedback.push({
      type: 'warning',
      category: 'Sales Enablement',
      title: 'No Objection Handling Content',
      message: "I don't have any objection handlers loaded. When prospects push back on pricing, timing, or features, I may struggle to respond effectively.",
      action: 'Upload common objections and rebuttals'
    });
  }

  // Success stories check
  if (!sectionMap['success'] && !sectionMap['success-stories'] && !sectionMap['case-studies']) {
    feedback.push({
      type: 'suggestion',
      category: 'Social Proof',
      title: 'Add Customer Success Stories',
      message: 'Case studies and testimonials help me build credibility with prospects. Adding these will strengthen my ability to overcome skepticism.',
      action: 'Upload 2-3 customer success stories'
    });
  }

  // Competition analysis
  if (!sectionMap['competition'] && !sectionMap['competitors']) {
    feedback.push({
      type: 'suggestion',
      category: 'Competitive Intel',
      title: 'No Competitive Information',
      message: "I don't have any competitive intelligence. When prospects compare us to alternatives, I won't be able to position our differentiation effectively.",
      action: 'Upload competitive battlecards'
    });
  }

  // Positive feedback if well-configured
  if (missingCritical.length === 0 && icpCount > 0 && sectionCount >= 5) {
    const totalDocs = documents.length;
    feedback.push({
      type: 'success',
      category: 'Knowledge Base Health',
      title: 'Strong Knowledge Foundation',
      message: `Great work! I have ${totalDocs} documents across ${sectionCount} sections, covering all critical areas. This gives me confidence to handle most sales conversations effectively.`
    });
  }

  // Document freshness (check for old documents)
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const staleDocCount = documents.filter(doc => {
    const updated = doc.updated_at || doc.created_at;
    return updated && new Date(updated) < oneMonthAgo;
  }).length;

  if (staleDocCount > documents.length * 0.5) {
    feedback.push({
      type: 'suggestion',
      category: 'Content Freshness',
      title: 'Review Outdated Content',
      message: `Over half of my knowledge base hasn't been updated in the last month. Consider reviewing and refreshing older content to ensure I'm using current information.`,
      action: 'Review and update older documents'
    });
  }

  return feedback;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = await getWorkspaceId(supabase, user.id);
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
    }

    // Fetch KB documents with full details
    const { data: documents } = await supabase
      .from('knowledge_base_documents')
      .select('id, section_id, filename, updated_at, created_at, metadata, extracted_content, vectorized_at, vector_chunks')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true);

    // Fetch ICP count
    const { count: icpCount } = await supabase
      .from('knowledge_base_icps')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('is_active', true);

    // Generate document-level feedback
    const documentFeedback: Record<string, any> = {};
    (documents || []).forEach(doc => {
      documentFeedback[doc.id] = analyzeDocument(doc);
    });

    // Generate section-level feedback
    const sectionMap: Record<string, any[]> = {};
    (documents || []).forEach(doc => {
      const section = doc.section_id || 'general';
      if (!sectionMap[section]) sectionMap[section] = [];
      sectionMap[section].push(doc);
    });

    const sectionFeedback: Record<string, any> = {};
    const allSections = ['products', 'icp', 'messaging', 'pricing', 'objections', 'success', 'competition',
                         'company', 'buying', 'personas', 'compliance', 'tone'];

    allSections.forEach(sectionId => {
      const docs = sectionMap[sectionId] || [];
      sectionFeedback[sectionId] = analyzeSectionHealth(
        sectionId,
        docs,
        sectionId === 'icp' ? icpCount : undefined
      );
    });

    // Overall feedback
    const overallFeedback = await analyzeKBDocuments(documents || [], icpCount || 0);

    return NextResponse.json({
      documentFeedback,
      sectionFeedback,
      overallFeedback,
      stats: {
        totalDocuments: documents?.length || 0,
        icpCount: icpCount || 0,
        sections: [...new Set((documents || []).map(d => d.section_id))].length
      }
    });
  } catch (error) {
    console.error('KB feedback API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
