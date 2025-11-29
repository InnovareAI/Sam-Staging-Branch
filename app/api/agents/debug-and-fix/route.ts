/**
 * Advanced Debugging Agent
 * Analyzes system issues and proposes code fixes using Claude
 *
 * POST /api/agents/debug-and-fix
 * Body: { issue_type: string, error_details: string, context?: any }
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase';
import { claudeClient } from '@/lib/llm/claude-client';
import * as fs from 'fs/promises';
import * as path from 'path';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface DebugRequest {
  issue_type: 'campaign_failure' | 'api_error' | 'queue_stuck' | 'data_inconsistency' | 'performance' | 'custom';
  error_details: string;
  context?: {
    campaign_id?: string;
    prospect_id?: string;
    error_message?: string;
    stack_trace?: string;
    related_files?: string[];
  };
  auto_apply?: boolean; // If true, apply simple fixes automatically
}

interface FixProposal {
  file_path: string;
  issue_description: string;
  proposed_fix: string;
  confidence_score: number;
  fix_type: 'code_change' | 'config_update' | 'data_fix' | 'manual_action';
  risk_level: 'low' | 'medium' | 'high';
}

// File patterns for different issue types
const ISSUE_FILE_PATTERNS: Record<string, string[]> = {
  campaign_failure: [
    'app/api/campaigns/**/*.ts',
    'app/api/cron/process-send-queue/route.ts',
    'lib/services/campaign-*.ts'
  ],
  api_error: [
    'app/api/**/*.ts',
    'lib/services/**/*.ts'
  ],
  queue_stuck: [
    'app/api/cron/process-send-queue/route.ts',
    'app/api/campaigns/direct/**/*.ts'
  ],
  data_inconsistency: [
    'app/api/**/*.ts',
    'lib/services/**/*.ts',
    'supabase/migrations/**/*.sql'
  ],
  performance: [
    'app/api/**/*.ts',
    'lib/**/*.ts'
  ]
};

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // Auth check
  const cronSecret = request.headers.get('x-cron-secret');
  const authHeader = request.headers.get('authorization');

  if (!cronSecret && !authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: DebugRequest = await request.json();
    console.log('🔧 Debug agent starting:', body.issue_type);

    const supabase = supabaseAdmin();

    // Step 1: Gather context based on issue type
    const contextData = await gatherContext(supabase, body);

    // Step 2: Identify relevant code files
    const relevantFiles = await identifyRelevantFiles(body.issue_type, body.context?.related_files);

    // Step 3: Read relevant code
    const codeContext = await readCodeFiles(relevantFiles);

    // Step 4: Use Claude to analyze and propose fixes
    const analysis = await analyzeWithClaude(body, contextData, codeContext);

    // Step 5: Store proposals
    const { data: healthCheck } = await supabase
      .from('system_health_checks')
      .insert({
        check_date: new Date().toISOString(),
        checks: [{ check_name: body.issue_type, status: 'critical', details: body.error_details }],
        ai_analysis: analysis.analysis,
        recommendations: analysis.recommendations,
        overall_status: 'critical',
        fixes_proposed: analysis.fixes,
        duration_ms: Date.now() - startTime
      })
      .select()
      .single();

    // Store individual fix proposals
    if (analysis.fixes.length > 0 && healthCheck) {
      await supabase
        .from('agent_fix_proposals')
        .insert(
          analysis.fixes.map((fix: FixProposal) => ({
            health_check_id: healthCheck.id,
            issue_type: body.issue_type,
            issue_description: fix.issue_description,
            file_path: fix.file_path,
            proposed_fix: fix.proposed_fix,
            confidence_score: fix.confidence_score,
            status: 'proposed'
          }))
        );
    }

    // Step 6: Auto-apply low-risk fixes if requested
    let appliedFixes: string[] = [];
    if (body.auto_apply && analysis.fixes.some((f: FixProposal) => f.risk_level === 'low' && f.confidence_score > 0.9)) {
      appliedFixes = await applyLowRiskFixes(analysis.fixes.filter(
        (f: FixProposal) => f.risk_level === 'low' && f.confidence_score > 0.9
      ));
    }

    console.log('✅ Debug agent complete:', {
      fixes_proposed: analysis.fixes.length,
      fixes_applied: appliedFixes.length,
      duration_ms: Date.now() - startTime
    });

    return NextResponse.json({
      success: true,
      analysis: analysis.analysis,
      recommendations: analysis.recommendations,
      fixes_proposed: analysis.fixes,
      fixes_applied: appliedFixes,
      duration_ms: Date.now() - startTime
    });

  } catch (error) {
    console.error('❌ Debug agent failed:', error);
    return NextResponse.json({
      error: 'Debug agent failed',
      details: error instanceof Error ? error.message : 'Unknown'
    }, { status: 500 });
  }
}

async function gatherContext(supabase: any, body: DebugRequest): Promise<any> {
  const context: any = { ...body.context };

  // Fetch additional context based on issue type
  if (body.issue_type === 'campaign_failure' && body.context?.campaign_id) {
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('*, campaign_prospects(status, error_message)')
      .eq('id', body.context.campaign_id)
      .single();

    context.campaign = campaign;
  }

  if (body.issue_type === 'queue_stuck') {
    const { data: stuckItems } = await supabase
      .from('send_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('scheduled_for', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .limit(10);

    context.stuck_queue_items = stuckItems;
  }

  // Get recent error logs
  const { data: recentErrors } = await supabase
    .from('campaign_prospects')
    .select('error_message, updated_at')
    .not('error_message', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(20);

  context.recent_errors = recentErrors;

  return context;
}

async function identifyRelevantFiles(issueType: string, relatedFiles?: string[]): Promise<string[]> {
  const patterns = ISSUE_FILE_PATTERNS[issueType] || ISSUE_FILE_PATTERNS.api_error;
  const projectRoot = process.cwd();

  // If specific files mentioned, prioritize those
  if (relatedFiles && relatedFiles.length > 0) {
    return relatedFiles.slice(0, 5); // Limit to 5 files
  }

  // For now, return key files based on issue type
  const keyFiles: Record<string, string[]> = {
    campaign_failure: [
      'app/api/campaigns/direct/send-connection-requests/route.ts',
      'app/api/cron/process-send-queue/route.ts'
    ],
    queue_stuck: [
      'app/api/cron/process-send-queue/route.ts'
    ],
    api_error: [
      'app/api/campaigns/route.ts',
      'lib/services/campaign-execution.ts'
    ],
    data_inconsistency: [
      'app/api/campaigns/route.ts'
    ],
    performance: [
      'app/api/campaigns/route.ts'
    ]
  };

  return keyFiles[issueType] || keyFiles.api_error;
}

async function readCodeFiles(files: string[]): Promise<Record<string, string>> {
  const codeContext: Record<string, string> = {};
  const projectRoot = process.cwd();

  for (const file of files.slice(0, 3)) { // Limit to 3 files to stay within token limits
    try {
      const fullPath = path.join(projectRoot, file);
      const content = await fs.readFile(fullPath, 'utf-8');
      // Truncate to first 500 lines
      codeContext[file] = content.split('\n').slice(0, 500).join('\n');
    } catch (error) {
      console.warn(`Could not read file ${file}:`, error);
    }
  }

  return codeContext;
}

async function analyzeWithClaude(
  body: DebugRequest,
  contextData: any,
  codeContext: Record<string, string>
): Promise<{
  analysis: string;
  recommendations: string[];
  fixes: FixProposal[];
}> {
  const codeSnippets = Object.entries(codeContext)
    .map(([file, code]) => `### ${file}\n\`\`\`typescript\n${code.substring(0, 3000)}\n\`\`\``)
    .join('\n\n');

  const prompt = `You are a senior software engineer debugging a production issue.

## ISSUE TYPE: ${body.issue_type}

## ERROR DETAILS:
${body.error_details}

## ADDITIONAL CONTEXT:
${JSON.stringify(contextData, null, 2)}

## RELEVANT CODE:
${codeSnippets}

## YOUR TASK:
1. Analyze the root cause of this issue
2. Propose specific code fixes
3. Rate each fix by confidence (0-1) and risk level (low/medium/high)

Return a JSON response:
{
  "analysis": "Root cause analysis in 2-3 sentences",
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "fixes": [
    {
      "file_path": "path/to/file.ts",
      "issue_description": "What's wrong",
      "proposed_fix": "The actual code change or SQL fix",
      "confidence_score": 0.85,
      "fix_type": "code_change|config_update|data_fix|manual_action",
      "risk_level": "low|medium|high"
    }
  ]
}

IMPORTANT:
- Only propose fixes you're confident about
- Include line numbers if possible
- For data fixes, include the exact SQL
- For code changes, show the before/after diff format

Return ONLY valid JSON.`;

  try {
    const response = await claudeClient.chat({
      model: 'claude-opus-4-5-20250514', // Use Opus for complex debugging
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
      temperature: 0.3
    });

    const content = response.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return {
      analysis: 'Could not analyze issue. Manual review required.',
      recommendations: ['Review error logs manually', 'Check related code files'],
      fixes: []
    };
  } catch (error) {
    console.error('Claude analysis failed:', error);
    return {
      analysis: 'AI analysis unavailable.',
      recommendations: ['Review error logs manually'],
      fixes: []
    };
  }
}

async function applyLowRiskFixes(fixes: FixProposal[]): Promise<string[]> {
  const applied: string[] = [];

  for (const fix of fixes) {
    if (fix.fix_type === 'data_fix' && fix.proposed_fix.toLowerCase().includes('update')) {
      // Only apply UPDATE statements (no DELETE or DROP)
      try {
        const supabase = supabaseAdmin();
        // Log the fix attempt
        console.log('📝 Auto-applying data fix:', fix.proposed_fix.substring(0, 100));
        // Note: In production, you'd execute the SQL here
        // For safety, we just log it
        applied.push(`Data fix logged: ${fix.issue_description}`);
      } catch (error) {
        console.error('Failed to apply fix:', error);
      }
    }
  }

  return applied;
}
