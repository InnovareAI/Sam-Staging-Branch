import { pool } from '@/lib/auth';
import { ICPDiscoveryPayload, ICPDiscoverySession, SaveDiscoveryInput, ICPDiscoverySummary, ICPSessionStatus } from './types';

const DEFAULT_SUMMARY: ICPDiscoverySummary = {
  headline: 'Discovery in progress',
  key_points: [],
  recommended_positioning: 'Awaiting completion'
};

export async function getActiveDiscoverySession(userId: string, client?: any) {
  // Client arg ignored as we use pool
  try {
    const { rows } = await pool.query(`
      SELECT * FROM sam_icp_discovery_sessions
      WHERE user_id = $1
      AND session_status IN ('in_progress', 'completed')
      ORDER BY updated_at DESC
      LIMIT 1
    `, [userId]);

    return rows[0] as ICPDiscoverySession | null;
  } catch (error: any) {
    throw new Error(`Failed to fetch discovery session: ${error.message}`);
  }
}

export async function startDiscoverySession(userId: string, client?: any, threadId?: string, campaignId?: string) {
  try {
    const { rows: profileRows } = await pool.query(
      'SELECT current_workspace_id as workspace_id FROM users WHERE id = $1',
      [userId]
    );
    const profile = profileRows[0];

    // Fallback if no current_workspace_id in users
    let workspaceId = profile?.workspace_id;
    if (!workspaceId) {
      // Try to get ANY workspace
      const { rows: memberRows } = await pool.query(
        'SELECT workspace_id FROM workspace_members WHERE user_id = $1 LIMIT 1',
        [userId]
      );
      workspaceId = memberRows[0]?.workspace_id;
    }

    if (!workspaceId) {
      throw new Error('Workspace not found for user');
    }

    const { rows } = await pool.query(`
      INSERT INTO sam_icp_discovery_sessions (
        workspace_id, user_id, thread_id, campaign_id, discovery_payload, discovery_summary, session_status, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *
    `, [workspaceId, userId, threadId, campaignId, '{}', JSON.stringify(DEFAULT_SUMMARY), 'in_progress']);

    return rows[0] as ICPDiscoverySession;
  } catch (error: any) {
    throw new Error(`Failed to create discovery session: ${error.message}`);
  }
}

export async function saveDiscoveryProgress(userId: string, input: SaveDiscoveryInput, client?: any) {
  const { sessionId, payload, phasesCompleted, shallowDelta, questionsSkippedDelta, sessionStatus, completedAt } = input;

  try {

    const { rows } = await pool.query(`
        UPDATE sam_icp_discovery_sessions
        SET 
            discovery_payload = discovery_payload || $1::jsonb,
            phases_completed = COALESCE($2, phases_completed),
            shallow_answers_count = shallow_answers_count + $3,
            questions_skipped_count = questions_skipped_count + $4,
            session_status = COALESCE($5, session_status),
            completed_at = COALESCE($6::timestamptz, completed_at),
            updated_at = NOW()
        WHERE id = $7 AND user_id = $8
        RETURNING *
    `, [
      JSON.stringify(payload || {}),
      phasesCompleted,
      shallowDelta || 0,
      questionsSkippedDelta || 0,
      sessionStatus,
      completedAt,
      sessionId,
      userId
    ]);

    if (rows.length === 0) {
      throw new Error('Session not found or update failed');
    }

    return rows[0] as ICPDiscoverySession;
  } catch (error: any) {
    throw new Error(`Failed to update discovery session: ${error.message}`);
  }
}

export async function completeDiscoverySession(userId: string, sessionId: string, summary: ICPDiscoverySummary, redFlags: string[] = [], client?: any) {
  try {
    const { rows } = await pool.query(`
      UPDATE sam_icp_discovery_sessions
      SET
        discovery_summary = $1,
        red_flags = $2,
        session_status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
      WHERE id = $3 AND user_id = $4
      RETURNING *
    `, [JSON.stringify(summary), redFlags, sessionId, userId]);

    if (rows.length === 0) {
      throw new Error('Session not found');
    }

    return rows[0] as ICPDiscoverySession;
  } catch (error: any) {
    throw new Error(`Failed to complete discovery session: ${error.message}`);
  }
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
  try {
    const { rows } = await pool.query(`
      UPDATE sam_icp_discovery_sessions
      SET
        session_status = 'abandoned',
        updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, [sessionId, userId]);

    if (rows.length === 0) throw new Error('Session not found');

    return rows[0] as ICPDiscoverySession;
  } catch (error: any) {
    throw new Error(`Failed to abandon discovery session: ${error.message}`);
  }
}
