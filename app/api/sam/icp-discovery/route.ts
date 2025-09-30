import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  abandonDiscoverySession,
  buildDiscoverySummary,
  completeDiscoverySession,
  getActiveDiscoverySession,
  saveDiscoveryProgress,
  startDiscoverySession
} from '@/lib/icp-discovery/service';
import { ICPDiscoveryPayload, SaveDiscoveryInput } from '@/lib/icp-discovery/types';

interface DiscoveryRequestBody {
  action: 'start' | 'get_active' | 'save_progress' | 'complete' | 'abandon';
  session_id?: string;
  payload?: Partial<ICPDiscoveryPayload>;
  phases_completed?: string[];
  shallow_delta?: number;
  questions_skipped_delta?: number;
  red_flags?: string[];
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: DiscoveryRequestBody = await req.json();

    switch (body.action) {
      case 'start': {
        const active = await getActiveDiscoverySession(user.id);
        if (active && active.session_status === 'in_progress') {
          return NextResponse.json({ success: true, session: active, message: 'Existing discovery session resumed.' });
        }
        const session = await startDiscoverySession(user.id);
        return NextResponse.json({ success: true, session, message: 'Discovery session started.' });
      }
      case 'get_active': {
        const session = await getActiveDiscoverySession(user.id);
        return NextResponse.json({ success: true, session });
      }
      case 'save_progress': {
        if (!body.session_id) {
          return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
        }
        const saveInput: SaveDiscoveryInput = {
          sessionId: body.session_id,
          payload: body.payload ?? {},
          phasesCompleted: body.phases_completed,
          shallowDelta: body.shallow_delta,
          questionsSkippedDelta: body.questions_skipped_delta
        };
        const session = await saveDiscoveryProgress(user.id, saveInput);
        return NextResponse.json({ success: true, session });
      }
      case 'complete': {
        if (!body.session_id) {
          return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
        }
        const active = await getActiveDiscoverySession(user.id);
        if (!active || active.id !== body.session_id) {
          return NextResponse.json({ error: 'Discovery session not found' }, { status: 404 });
        }
        const summary = buildDiscoverySummary(active.discovery_payload);
        const session = await completeDiscoverySession(user.id, body.session_id, summary, body.red_flags ?? []);
        return NextResponse.json({ success: true, session, message: 'Discovery session completed.' });
      }
      case 'abandon': {
        if (!body.session_id) {
          return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
        }
        const session = await abandonDiscoverySession(user.id, body.session_id);
        return NextResponse.json({ success: true, session, message: 'Discovery session marked as abandoned.' });
      }
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('ICP discovery error:', error);
    return NextResponse.json({ error: 'ICP discovery operation failed', details: error.message }, { status: 500 });
  }
}
