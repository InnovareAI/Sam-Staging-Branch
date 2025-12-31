/**
 * SAM Memory Management API
 * Handles memory snapshots, archival, and restoration
 * Updated Dec 31, 2025: Migrated to verifyAuth and pool.query
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.isAuthenticated || !auth.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = auth.user;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'snapshots':
        return getMemorySnapshots(user.uid);

      case 'preferences':
        return getMemoryPreferences(user.uid);

      case 'stats':
        return getMemoryStats(user.uid);

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
    const auth = await verifyAuth(request);
    if (!auth.isAuthenticated || !auth.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = auth.user;
    const { action, ...data } = await request.json();

    switch (action) {
      case 'create_snapshot':
        return createMemorySnapshot(user, data);

      case 'restore_snapshot':
        return restoreMemorySnapshot(user.uid, data);

      case 'update_preferences':
        return updateMemoryPreferences(user, data);

      case 'bookmark_conversation':
        return bookmarkConversation(user.uid, data);

      case 'manual_archive':
        return manualArchiveConversations(user.uid, data);

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
async function getMemorySnapshots(userId: string) {
  const res = await pool.query(
    `SELECT 
      id, snapshot_date, conversation_count, total_messages, 
      memory_summary, importance_score, user_notes, restore_count, 
      last_restored_at, created_at
     FROM memory_snapshots
     WHERE user_id = $1
     ORDER BY snapshot_date DESC
     LIMIT 50`,
    [userId]
  );

  return NextResponse.json({ snapshots: res.rows });
}

// Get user's memory preferences
async function getMemoryPreferences(userId: string) {
  const res = await pool.query(
    'SELECT * FROM user_memory_preferences WHERE user_id = $1',
    [userId]
  );
  const preferences = res.rows[0];

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
async function getMemoryStats(userId: string) {
  try {
    // Get conversation stats
    const convRes = await pool.query(
      'SELECT memory_archived, memory_importance_score, created_at FROM sam_conversations WHERE user_id = $1',
      [userId]
    );
    const conversationStats = convRes.rows;

    // Get snapshot stats
    const snapRes = await pool.query(
      'SELECT conversation_count, total_messages, importance_score, created_at FROM memory_snapshots WHERE user_id = $1',
      [userId]
    );
    const snapshotStats = snapRes.rows;

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
async function createMemorySnapshot(user: any, data: any) {
  const { days_back = 7, user_notes = '' } = data;
  const userId = user.uid;

  // Get user's current workspace as organization ID equivalent
  const userRes = await pool.query(
    'SELECT current_workspace_id FROM users WHERE id = $1',
    [userId]
  );
  const organizationId = userRes.rows[0]?.current_workspace_id || 'default';

  try {
    // Call the PostgreSQL function directly
    const res = await pool.query(
      'SELECT create_memory_snapshot($1, $2, $3) as snapshot_id',
      [userId, organizationId, days_back]
    );
    const result = res.rows[0]?.snapshot_id;

    // Add user notes if provided
    if (user_notes && result) {
      await pool.query(
        'UPDATE memory_snapshots SET user_notes = $1 WHERE id = $2',
        [user_notes, result]
      );
    }

    return NextResponse.json({
      success: true,
      snapshot_id: result,
      message: `Memory snapshot created for the last ${days_back} days`
    });
  } catch (error: any) {
    console.error('Create snapshot error:', error);
    return NextResponse.json(
      { error: 'Failed to create memory snapshot', details: error.message },
      { status: 500 }
    );
  }
}

// Restore a memory snapshot
async function restoreMemorySnapshot(userId: string, data: any) {
  const { snapshot_id } = data;

  if (!snapshot_id) {
    return NextResponse.json({ error: 'Snapshot ID required' }, { status: 400 });
  }

  try {
    const res = await pool.query(
      'SELECT restore_memory_snapshot($1, $2) as result',
      [snapshot_id, userId]
    );
    const result = res.rows[0]?.result;

    // Extract conversation data
    const conversationData = result?.[0]?.conversation_data;

    return NextResponse.json({
      success: true,
      conversations: conversationData,
      message: 'Memory snapshot restored successfully'
    });
  } catch (error: any) {
    console.error('Restore snapshot error:', error);
    return NextResponse.json(
      { error: 'Failed to restore memory snapshot', details: error.message },
      { status: 500 }
    );
  }
}

// Update memory preferences
async function updateMemoryPreferences(user: any, data: any) {
  const {
    auto_archive_enabled,
    archive_frequency_days,
    max_active_conversations,
    memory_retention_days,
    importance_threshold,
    auto_restore_on_login,
    memory_notifications
  } = data;
  const userId = user.uid;

  const userRes = await pool.query(
    'SELECT current_workspace_id FROM users WHERE id = $1',
    [userId]
  );
  const organizationId = userRes.rows[0]?.current_workspace_id || 'default';

  try {
    const res = await pool.query(
      `INSERT INTO user_memory_preferences (
        user_id, organization_id, auto_archive_enabled, archive_frequency_days,
        max_active_conversations, memory_retention_days, importance_threshold,
        auto_restore_on_login, memory_notifications, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        organization_id = EXCLUDED.organization_id,
        auto_archive_enabled = EXCLUDED.auto_archive_enabled,
        archive_frequency_days = EXCLUDED.archive_frequency_days,
        max_active_conversations = EXCLUDED.max_active_conversations,
        memory_retention_days = EXCLUDED.memory_retention_days,
        importance_threshold = EXCLUDED.importance_threshold,
        auto_restore_on_login = EXCLUDED.auto_restore_on_login,
        memory_notifications = EXCLUDED.memory_notifications,
        updated_at = NOW()
      RETURNING *`,
      [
        userId, organizationId, auto_archive_enabled, archive_frequency_days,
        max_active_conversations, memory_retention_days, importance_threshold,
        auto_restore_on_login, memory_notifications
      ]
    );

    return NextResponse.json({
      success: true,
      preferences: res.rows[0],
      message: 'Memory preferences updated successfully'
    });
  } catch (error: any) {
    console.error('Update preferences error:', error);
    return NextResponse.json(
      { error: 'Failed to update preferences', details: error.message },
      { status: 500 }
    );
  }
}

// Bookmark a conversation for memory retention
async function bookmarkConversation(userId: string, data: any) {
  const { conversation_id, bookmarked = true } = data;

  if (!conversation_id) {
    return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 });
  }

  try {
    const res = await pool.query(
      `UPDATE sam_conversations 
       SET user_bookmarked = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING id`,
      [bookmarked, conversation_id, userId]
    );

    if (res.rowCount === 0) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: bookmarked ? 'Conversation bookmarked' : 'Bookmark removed'
    });
  } catch (error: any) {
    console.error('Bookmark error:', error);
    return NextResponse.json(
      { error: 'Failed to bookmark conversation', details: error.message },
      { status: 500 }
    );
  }
}

// Manually archive specific conversations
async function manualArchiveConversations(userId: string, data: any) {
  const { conversation_ids } = data;

  if (!conversation_ids || !Array.isArray(conversation_ids)) {
    return NextResponse.json({ error: 'Conversation IDs array required' }, { status: 400 });
  }

  try {
    const res = await pool.query(
      `UPDATE sam_conversations 
       SET 
        memory_archived = true, 
        memory_archive_date = NOW(), 
        updated_at = NOW()
       WHERE id = ANY($1) AND user_id = $2`,
      [conversation_ids, userId]
    );

    return NextResponse.json({
      success: true,
      archived_count: res.rowCount,
      message: `${res.rowCount} conversations archived`
    });
  } catch (error: any) {
    console.error('Manual archive error:', error);
    return NextResponse.json(
      { error: 'Failed to archive conversations', details: error.message },
      { status: 500 }
    );
  }
}