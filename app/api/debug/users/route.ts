import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const supabase = pool
    
    const { data: users, error } = await supabase.auth.admin.listUsers()
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Return just email addresses and IDs for debugging
    const userList = users.users?.map(user => ({
      id: user.id,
      email: user.email,
      created_at: user.created_at
    })) || []

    return NextResponse.json({
      success: true,
      count: userList.length,
      users: userList
    })

  } catch (error) {
    console.error('Error listing users:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}