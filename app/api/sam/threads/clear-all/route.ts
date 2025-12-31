/**
 * Clear All Threads API
 * Deletes all conversation threads for the authenticated user
 */

import { NextResponse, NextRequest } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await verifyAuth(request);

    // Delete all messages first (PG might handle cascade, but explicit delete is safer if FK not set to cascade)
    // Actually, let's delete threads and assume CASCADE is set or delete messages manually first to be safe.

    await pool.query(`
      DELETE FROM sam_thread_messages
      WHERE thread_id IN (
        SELECT id FROM sam_conversation_threads WHERE user_id = $1
      )
    `, [userId]);

    // Delete all threads for this user
    await pool.query(`
      DELETE FROM sam_conversation_threads
      WHERE user_id = $1
    `, [userId]);

    return NextResponse.json({
      success: true,
      message: 'All threads cleared'
    });

  } catch (error) {
    console.error('Clear threads API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
