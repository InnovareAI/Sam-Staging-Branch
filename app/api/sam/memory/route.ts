/**
 * SAM Memory Management API
 * Handles memory snapshots, archival, and restoration
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Check authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    switch (action) {
      case 'snapshots':
        return getMemorySnapshots(supabase, session.user.id);
      
      case 'preferences':
        return getMemoryPreferences(supabase, session.user.id);
      
      case 'stats':
        return getMemoryStats(supabase, session.user.id);
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Memory API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    const { action, ...data } = await request.json();

    // Check authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    switch (action) {
      case 'create_snapshot':
        return createMemorySnapshot(supabase, session.user.id, data);
      
      case 'restore_snapshot':
        return restoreMemorySnapshot(supabase, session.user.id, data);
      
      case 'update_preferences':
        return updateMemoryPreferences(supabase, session.user.id, data);
      
      case 'bookmark_conversation':
        return bookmarkConversation(supabase, session.user.id, data);
      
      case 'manual_archive':
        return manualArchiveConversations(supabase, session.user.id, data);
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Memory API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Get user's memory snapshots
async function getMemorySnapshots(supabase: any, userId: string) {
  const { data: snapshots, error } = await supabase
    .from('memory_snapshots')
    .select(`
      id,
      snapshot_date,
      conversation_count,
      total_messages,
      memory_summary,
      importance_score,
      user_notes,
      restore_count,
      last_restored_at,
      created_at
    `)
    .eq('user_id', userId)
    .order('snapshot_date', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ snapshots });
}

// Get user's memory preferences
async function getMemoryPreferences(supabase: any, userId: string) {
  const { data: preferences, error } = await supabase
    .from('user_memory_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') { // Not found is ok
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return default preferences if none exist
  const defaultPreferences = {
    auto_archive_enabled: true,
    archive_frequency_days: 7,
    max_active_conversations: 20,
    memory_retention_days: 90,
    importance_threshold: 3,
    auto_restore_on_login: false,
    memory_notifications: true
  };

  return NextResponse.json({ 
    preferences: preferences || defaultPreferences 
  });
}

// Get memory statistics
async function getMemoryStats(supabase: any, userId: string) {
  try {
    // Get conversation stats
    const { data: conversationStats } = await supabase
      .from('sam_conversations')
      .select('memory_archived, memory_importance_score, created_at')
      .eq('user_id', userId);

    // Get snapshot stats
    const { data: snapshotStats } = await supabase
      .from('memory_snapshots')
      .select('conversation_count, total_messages, importance_score, created_at')
      .eq('user_id', userId);

    const activeConversations = conversationStats?.filter(c => !c.memory_archived).length || 0;
    const archivedConversations = conversationStats?.filter(c => c.memory_archived).length || 0;
    const totalSnapshots = snapshotStats?.length || 0;
    const avgImportance = conversationStats?.reduce((sum, c) => sum + (c.memory_importance_score || 1), 0) / (conversationStats?.length || 1);

    // Recent activity (last 7 days)
    const recentDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentConversations = conversationStats?.filter(c => 
      new Date(c.created_at) > recentDate
    ).length || 0;

    return NextResponse.json({
      stats: {
        active_conversations: activeConversations,
        archived_conversations: archivedConversations,
        total_snapshots: totalSnapshots,
        average_importance: Math.round(avgImportance * 10) / 10,
        recent_conversations: recentConversations,
        total_conversations: conversationStats?.length || 0
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get stats' }, { status: 500 });
  }
}

// Create a new memory snapshot
async function createMemorySnapshot(supabase: any, userId: string, data: any) {
  const { days_back = 7, user_notes = '' } = data;

  // Get user's organization
  const { data: user } = await supabase.auth.getUser();
  const organizationId = user?.user?.user_metadata?.organization_id || 'default';

  try {
    const { data: result, error } = await supabase.rpc('create_memory_snapshot', {
      p_user_id: userId,
      p_organization_id: organizationId,
      p_days_back: days_back
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Add user notes if provided
    if (user_notes && result) {
      await supabase
        .from('memory_snapshots')
        .update({ user_notes })
        .eq('id', result);
    }

    return NextResponse.json({ 
      success: true, 
      snapshot_id: result,
      message: `Memory snapshot created for the last ${days_back} days`
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create memory snapshot' },
      { status: 500 }
    );
  }
}

// Restore a memory snapshot
async function restoreMemorySnapshot(supabase: any, userId: string, data: any) {
  const { snapshot_id } = data;

  if (!snapshot_id) {
    return NextResponse.json({ error: 'Snapshot ID required' }, { status: 400 });
  }

  try {
    const { data: result, error } = await supabase.rpc('restore_memory_snapshot', {
      p_snapshot_id: snapshot_id,
      p_user_id: userId
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Extract conversation data
    const conversationData = result?.[0]?.conversation_data;

    return NextResponse.json({
      success: true,
      conversations: conversationData,
      message: 'Memory snapshot restored successfully'
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to restore memory snapshot' },
      { status: 500 }
    );
  }
}

// Update memory preferences
async function updateMemoryPreferences(supabase: any, userId: string, data: any) {
  const {
    auto_archive_enabled,
    archive_frequency_days,
    max_active_conversations,
    memory_retention_days,
    importance_threshold,
    auto_restore_on_login,
    memory_notifications
  } = data;

  // Get user's organization
  const { data: user } = await supabase.auth.getUser();
  const organizationId = user?.user?.user_metadata?.organization_id || 'default';

  try {
    const { data: result, error } = await supabase
      .from('user_memory_preferences')
      .upsert({
        user_id: userId,
        organization_id: organizationId,
        auto_archive_enabled,
        archive_frequency_days,
        max_active_conversations,
        memory_retention_days,
        importance_threshold,
        auto_restore_on_login,
        memory_notifications,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      preferences: result,
      message: 'Memory preferences updated successfully'
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}

// Bookmark a conversation for memory retention
async function bookmarkConversation(supabase: any, userId: string, data: any) {
  const { conversation_id, bookmarked = true } = data;

  if (!conversation_id) {
    return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from('sam_conversations')
      .update({ 
        user_bookmarked: bookmarked,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversation_id)
      .eq('user_id', userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: bookmarked ? 'Conversation bookmarked' : 'Bookmark removed'
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to bookmark conversation' },
      { status: 500 }
    );
  }
}

// Manually archive specific conversations
async function manualArchiveConversations(supabase: any, userId: string, data: any) {
  const { conversation_ids } = data;

  if (!conversation_ids || !Array.isArray(conversation_ids)) {
    return NextResponse.json({ error: 'Conversation IDs array required' }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from('sam_conversations')
      .update({
        memory_archived: true,
        memory_archive_date: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .in('id', conversation_ids)
      .eq('user_id', userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      archived_count: conversation_ids.length,
      message: `${conversation_ids.length} conversations archived`
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to archive conversations' },
      { status: 500 }
    );
  }
}