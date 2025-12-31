import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, pool } from '@/lib/auth'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Provider ID is required'
      }, { status: 400 })
    }

    // Authenticate with Firebase
    const { userId } = await verifyAuth(request)

    // Delete the email provider ensuring user owns it
    const result = await pool.query(
      'DELETE FROM email_providers WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    )

    if (result.rowCount === 0) {
      console.error('❌ Failed to delete email provider: not found or not owned by user')
      return NextResponse.json({
        success: false,
        error: 'Failed to delete provider'
      }, { status: 500 })
    }

    console.log(`✅ Deleted email provider: ${id}`)

    return NextResponse.json({
      success: true,
      message: 'Email provider deleted successfully',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Failed to delete email provider:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
