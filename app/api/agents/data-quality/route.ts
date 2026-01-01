/**
 * Data Quality Agent
 * Finds duplicates, invalid emails, missing fields, data anomalies
 *
 * POST /api/agents/data-quality
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

interface DataQualityIssue {
  issue_type: 'duplicate' | 'invalid_email' | 'missing_field' | 'invalid_url' | 'stale_data' | 'anomaly';
  severity: 'high' | 'medium' | 'low';
  affected_records: number;
  sample_ids: string[];
  description: string;
  suggested_fix: string;
}

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get('x-cron-secret');
  const authHeader = request.headers.get('authorization');

  if (!cronSecret && !authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const supabase = pool;
    const issues: DataQualityIssue[] = [];

    // 1. Check for duplicate prospects (same LinkedIn URL in same workspace)
    const duplicateCheck = await checkDuplicates(supabase, body.workspace_id);
    if (duplicateCheck.affected_records > 0) issues.push(duplicateCheck);

    // 2. Check for invalid emails
    const emailCheck = await checkInvalidEmails(supabase, body.workspace_id);
    if (emailCheck.affected_records > 0) issues.push(emailCheck);

    // 3. Check for missing critical fields
    const missingFieldsCheck = await checkMissingFields(supabase, body.workspace_id);
    if (missingFieldsCheck.affected_records > 0) issues.push(missingFieldsCheck);

    // 4. Check for invalid LinkedIn URLs
    const urlCheck = await checkInvalidURLs(supabase, body.workspace_id);
    if (urlCheck.affected_records > 0) issues.push(urlCheck);

    // 5. Check for stale campaigns
    const staleCheck = await checkStaleCampaigns(supabase, body.workspace_id);
    if (staleCheck.affected_records > 0) issues.push(staleCheck);

    // 6. Check for orphaned records
    const orphanCheck = await checkOrphanedRecords(supabase);
    if (orphanCheck.affected_records > 0) issues.push(orphanCheck);

    // Auto-fix if requested
    let fixes_applied = 0;
    if (body.auto_fix) {
      fixes_applied = await applyAutoFixes(supabase, issues);
    }

    // Summary
    const summary = {
      total_issues: issues.length,
      high_severity: issues.filter(i => i.severity === 'high').length,
      medium_severity: issues.filter(i => i.severity === 'medium').length,
      low_severity: issues.filter(i => i.severity === 'low').length,
      total_affected_records: issues.reduce((sum, i) => sum + i.affected_records, 0),
      fixes_applied
    };

    return NextResponse.json({
      success: true,
      summary,
      issues,
      checked_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Data quality check error:', error);
    return NextResponse.json({
      error: 'Data quality check failed',
      details: error instanceof Error ? error.message : 'Unknown'
    }, { status: 500 });
  }
}

async function checkDuplicates(supabase: any, workspaceId?: string): Promise<DataQualityIssue> {
  // Find prospects with same LinkedIn URL in same campaign
  let query = supabase.rpc('find_duplicate_linkedin_urls');

  // Fallback if RPC doesn't exist
  const { data: duplicates, error } = await supabase
    .from('campaign_prospects')
    .select('id, linkedin_url, campaign_id')
    .not('linkedin_url', 'is', null)
    .limit(1000);

  if (error || !duplicates) {
    return {
      issue_type: 'duplicate',
      severity: 'medium',
      affected_records: 0,
      sample_ids: [],
      description: 'Could not check duplicates',
      suggested_fix: 'Create RPC function for duplicate detection'
    };
  }

  // Find duplicates in JS
  const urlCampaignMap = new Map<string, string[]>();
  for (const p of duplicates) {
    const key = `${p.linkedin_url}|${p.campaign_id}`;
    if (!urlCampaignMap.has(key)) {
      urlCampaignMap.set(key, []);
    }
    urlCampaignMap.get(key)!.push(p.id);
  }

  const duplicateGroups = Array.from(urlCampaignMap.values()).filter(ids => ids.length > 1);
  const duplicateIds = duplicateGroups.flat();

  return {
    issue_type: 'duplicate',
    severity: duplicateIds.length > 50 ? 'high' : duplicateIds.length > 10 ? 'medium' : 'low',
    affected_records: duplicateIds.length,
    sample_ids: duplicateIds.slice(0, 10),
    description: `${duplicateGroups.length} duplicate LinkedIn URLs found across ${duplicateIds.length} records`,
    suggested_fix: 'DELETE FROM campaign_prospects WHERE id IN (SELECT id FROM duplicates OFFSET 1)'
  };
}

async function checkInvalidEmails(supabase: any, workspaceId?: string): Promise<DataQualityIssue> {
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('id, email')
    .not('email', 'is', null)
    .limit(1000);

  if (!prospects) {
    return { issue_type: 'invalid_email', severity: 'low', affected_records: 0, sample_ids: [], description: 'No emails to check', suggested_fix: '' };
  }

  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const invalidEmails = prospects.filter((p: any) => p.email && !emailRegex.test(p.email));

  return {
    issue_type: 'invalid_email',
    severity: invalidEmails.length > 20 ? 'high' : invalidEmails.length > 5 ? 'medium' : 'low',
    affected_records: invalidEmails.length,
    sample_ids: invalidEmails.slice(0, 10).map((p: any) => p.id),
    description: `${invalidEmails.length} prospects have invalid email formats`,
    suggested_fix: 'UPDATE campaign_prospects SET email = NULL WHERE email !~ \'^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$\''
  };
}

async function checkMissingFields(supabase: any, workspaceId?: string): Promise<DataQualityIssue> {
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, linkedin_url, campaign_id')
    .or('first_name.is.null,linkedin_url.is.null')
    .limit(100);

  const count = prospects?.length || 0;

  return {
    issue_type: 'missing_field',
    severity: count > 50 ? 'high' : count > 10 ? 'medium' : 'low',
    affected_records: count,
    sample_ids: (prospects || []).slice(0, 10).map((p: any) => p.id),
    description: `${count} prospects missing critical fields (name or LinkedIn URL)`,
    suggested_fix: 'Review and update prospect data or remove incomplete records'
  };
}

async function checkInvalidURLs(supabase: any, workspaceId?: string): Promise<DataQualityIssue> {
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('id, linkedin_url')
    .not('linkedin_url', 'is', null)
    .limit(1000);

  if (!prospects) {
    return { issue_type: 'invalid_url', severity: 'low', affected_records: 0, sample_ids: [], description: 'No URLs to check', suggested_fix: '' };
  }

  const linkedinPattern = /linkedin\.com\/in\/[a-zA-Z0-9\-_%]+/i;
  const invalidUrls = prospects.filter((p: any) => p.linkedin_url && !linkedinPattern.test(p.linkedin_url));

  return {
    issue_type: 'invalid_url',
    severity: invalidUrls.length > 20 ? 'high' : invalidUrls.length > 5 ? 'medium' : 'low',
    affected_records: invalidUrls.length,
    sample_ids: invalidUrls.slice(0, 10).map((p: any) => p.id),
    description: `${invalidUrls.length} prospects have invalid LinkedIn URL format`,
    suggested_fix: 'Validate and correct LinkedIn URLs or remove invalid prospects'
  };
}

async function checkStaleCampaigns(supabase: any, workspaceId?: string): Promise<DataQualityIssue> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, campaign_name, status, updated_at')
    .eq('status', 'active')
    .lt('updated_at', thirtyDaysAgo)
    .limit(50);

  const count = campaigns?.length || 0;

  return {
    issue_type: 'stale_data',
    severity: count > 10 ? 'high' : count > 3 ? 'medium' : 'low',
    affected_records: count,
    sample_ids: (campaigns || []).slice(0, 10).map((c: any) => c.id),
    description: `${count} campaigns marked 'active' but not updated in 30+ days`,
    suggested_fix: 'UPDATE campaigns SET status = \'paused\' WHERE status = \'active\' AND updated_at < NOW() - INTERVAL \'30 days\''
  };
}

async function checkOrphanedRecords(supabase: any): Promise<DataQualityIssue> {
  // Check for prospects without campaigns
  const { data: orphaned } = await supabase
    .from('campaign_prospects')
    .select('id, campaign_id')
    .is('campaign_id', null)
    .limit(100);

  const count = orphaned?.length || 0;

  return {
    issue_type: 'anomaly',
    severity: count > 20 ? 'high' : count > 5 ? 'medium' : 'low',
    affected_records: count,
    sample_ids: (orphaned || []).slice(0, 10).map((p: any) => p.id),
    description: `${count} prospects have no associated campaign`,
    suggested_fix: 'DELETE FROM campaign_prospects WHERE campaign_id IS NULL'
  };
}

async function applyAutoFixes(supabase: any, issues: DataQualityIssue[]): Promise<number> {
  let fixesApplied = 0;

  for (const issue of issues) {
    if (issue.severity === 'low' && issue.issue_type === 'invalid_email') {
      // Safe to auto-fix: clear invalid emails
      const { count } = await supabase
        .from('campaign_prospects')
        .update({ email: null, updated_at: new Date().toISOString() })
        .in('id', issue.sample_ids);
      fixesApplied += count || 0;
    }
  }

  return fixesApplied;
}
