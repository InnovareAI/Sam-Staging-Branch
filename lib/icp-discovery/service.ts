import { createClient } from '@/utils/supabase/server';
import { ICPDiscoveryPayload, ICPDiscoverySession, SaveDiscoveryInput, ICPDiscoverySummary, ICPSessionStatus } from './types';

const DEFAULT_SUMMARY: ICPDiscoverySummary = {
  headline: 'Discovery in progress',
  key_points: [],
  recommended_positioning: 'Awaiting completion'
};

async function getSupabaseClient(providedClient?: any) {
  if (providedClient) return providedClient;
  return createClient();
}

export async function getActiveDiscoverySession(userId: string, client?: any) {
  const supabase = await getSupabaseClient(client);

  const { data, error } = await supabase
    .from('sam_icp_discovery_sessions')
    .select('*')
    .eq('user_id', userId)
    .in('session_status', ['in_progress', 'completed'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch discovery session: ${error.message}`);
  }

  return data as ICPDiscoverySession | null;
}

export async function startDiscoverySession(userId: string, client?: any, threadId?: string, campaignId?: string) {
  const supabase = await getSupabaseClient(client);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('workspace_id')
    .eq('id', userId)
    .single();

  if (profileError || !profile?.workspace_id) {
    throw new Error('Workspace not found for user');
  }

  const { data, error } = await supabase
    .from('sam_icp_discovery_sessions')
    .insert({
      workspace_id: profile.workspace_id,
      user_id: userId,
      thread_id: threadId,
      campaign_id: campaignId,
      discovery_payload: {},
      discovery_summary: DEFAULT_SUMMARY,
      session_status: 'in_progress'
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create discovery session: ${error.message}`);
  }

  return data as ICPDiscoverySession;
}

export async function saveDiscoveryProgress(userId: string, input: SaveDiscoveryInput, client?: any) {
  const supabase = await getSupabaseClient(client);
  const { sessionId, payload, phasesCompleted, shallowDelta, questionsSkippedDelta, sessionStatus, completedAt } = input;

  const rpcPayload = {
    p_session_id: sessionId,
    p_payload: payload ?? {},
    p_phases_completed: phasesCompleted ?? null,
    p_shallow_delta: shallowDelta ?? 0,
    p_questions_skipped_delta: questionsSkippedDelta ?? 0,
    p_session_status: sessionStatus ?? null,
    p_completed_at: completedAt ?? null
  };

  const { error: rpcError } = await supabase.rpc('upsert_icp_discovery_payload', rpcPayload);

  if (rpcError) {
    throw new Error(`Failed to update discovery session: ${rpcError.message}`);
  }

  const { data, error } = await supabase
    .from('sam_icp_discovery_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  if (error) {
    throw new Error(`Failed to load updated session: ${error.message}`);
  }

  return data as ICPDiscoverySession;
}

export async function completeDiscoverySession(userId: string, sessionId: string, summary: ICPDiscoverySummary, redFlags: string[] = [], client?: any) {
  const supabase = await getSupabaseClient(client);

  const { data, error } = await supabase
    .from('sam_icp_discovery_sessions')
    .update({
      discovery_summary: summary,
      red_flags: redFlags,
      session_status: 'completed' as ICPSessionStatus,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', sessionId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to complete discovery session: ${error.message}`);
  }

  return data as ICPDiscoverySession;
}

export function buildDiscoverySummary(payload: ICPDiscoveryPayload): ICPDiscoverySummary {
  const headline = payload.quick_summary || `ICP: ${payload.target_role ?? 'Unknown role'} in ${payload.target_industry ?? 'Unknown industry'}`;

  const keyPoints: string[] = [];
  if (payload.objectives?.length) {
    const primary = payload.objectives.find(obj => obj.priority === 1) ?? payload.objectives[0];
    if (primary) keyPoints.push(`Primary objective: ${primary.description}`);
  }
  if (payload.pain_points?.length) {
    const primaryPain = payload.pain_points.find(pain => pain.intensity === 'high') ?? payload.pain_points[0];
    if (primaryPain) keyPoints.push(`Pain: ${primaryPain.description}`);
  }
  if (payload.solution_expectations?.primary) {
    keyPoints.push(`Expectation: ${payload.solution_expectations.primary}`);
  }
  if (payload.objections?.length) {
    keyPoints.push(`Objection: ${payload.objections[0].objection}`);
  }

  const recommended_positioning = payload.positioning?.differentiation_hook
    || payload.positioning?.primary_pain_point
    || 'Position around the most urgent pain point.';

  return {
    headline,
    key_points: keyPoints,
    recommended_positioning,
    risk_notes: payload.conversational_notes?.shallow_answers?.length ? [
      `Shallow answers flagged for: ${payload.conversational_notes.shallow_answers.join(', ')}`
    ] : undefined
  };
}

export async function abandonDiscoverySession(userId: string, sessionId: string, client?: any) {
  const supabase = await getSupabaseClient(client);

  const { data, error } = await supabase
    .from('sam_icp_discovery_sessions')
    .update({
      session_status: 'abandoned',
      updated_at: new Date().toISOString()
    })
    .eq('id', sessionId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to abandon discovery session: ${error.message}`);
  }

  return data as ICPDiscoverySession;
}
