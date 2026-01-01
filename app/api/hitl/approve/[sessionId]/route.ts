import { toastSuccess, toastError, toastWarning, toastInfo } from '@/lib/toast';
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { HITLApprovalEmailService } from '@/lib/services/hitl-approval-email-service';

/**
 * HITL Approval Decision - Approve Endpoint
 * Handles approval decisions for HITL sessions
 */

const supabase = pool
const hitlService = new HITLApprovalEmailService()

interface RouteParams {
  params: {
    sessionId: string
  }
}

// POST - Approve the suggested message
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = params
    
    // Get session data
    const { data: session, error } = await supabase
      .from('hitl_reply_approval_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (error || !session) {
      return NextResponse.json({
        success: false,
        error: 'Approval session not found'
      }, { status: 404 })
    }

    // Check if session is still pending
    if (session.approval_status !== 'pending') {
      return NextResponse.json({
        success: false,
        error: `Session already ${session.approval_status}`
      }, { status: 400 })
    }

    // Check if session has expired
    if (new Date(session.expires_at) < new Date()) {
      return NextResponse.json({
        success: false,
        error: 'Approval session has expired'
      }, { status: 400 })
    }

    // Get reviewer info from request (could be from auth token or form data)
    const body = await request.json().catch(() => ({}))
    const reviewedBy = body.reviewed_by || 'system' // TODO: Get from authenticated user

    // Process approval decision
    const result = await hitlService.processApprovalDecision(
      sessionId,
      'approved',
      reviewedBy,
      session.sam_suggested_reply // Use original suggested reply
    )

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to process approval'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Message approved and sent',
      session_id: sessionId,
      decision: 'approved'
    })

  } catch (error) {
    console.error('HITL approval processing failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET - Show approval confirmation page (for email links)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = params
    
    // Get session data
    const { data: session, error } = await supabase
      .from('hitl_reply_approval_sessions')
      .select(`
        *,
        workspace:workspaces(name)
      `)
      .eq('id', sessionId)
      .single()

    if (error || !session) {
      return NextResponse.json({
        success: false,
        error: 'Approval session not found'
      }, { status: 404 })
    }

    // Generate confirmation HTML
    const confirmationHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Approve SAM AI Message</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      line-height: 1.6; 
      color: #333; 
      margin: 0; 
      padding: 20px; 
      background-color: #f8f9fa;
    }
    .container { 
      max-width: 600px; 
      margin: 0 auto; 
      background: white; 
      border-radius: 12px; 
      padding: 32px; 
      box-shadow: 0 4px 6px rgba(0,0,0,0.1); 
    }
    .header { text-align: center; margin-bottom: 32px; }
    .message-preview {
      background: #f0f9ff;
      border: 1px solid #0ea5e9;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .button {
      display: inline-block;
      background: #22c55e;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 10px 5px;
    }
    .button.danger { background: #ef4444; }
    .button.warning { background: #f59e0b; }
    .status { 
      padding: 16px; 
      border-radius: 8px; 
      margin: 20px 0; 
      text-align: center;
    }
    .status.pending { background: #fef3c7; color: #92400e; }
    .status.approved { background: #d1fae5; color: #065f46; }
    .status.rejected { background: #fecaca; color: #991b1b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🤖 SAM AI Message Approval</h1>
      <p>${session.workspace?.name || 'Workspace'}</p>
    </div>
    
    ${session.approval_status === 'pending' ? `
    <h2>Review and Approve Message</h2>
    <p><strong>Contact:</strong> ${session.prospect_name || 'Unknown'} 
       ${session.prospect_company ? `(${session.prospect_company})` : ''}</p>
    <p><strong>Channel:</strong> ${session.original_message_channel === 'linkedin' ? 'LinkedIn' : 'Email'}</p>
    
    <h3>Original Message:</h3>
    <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;">
      ${session.original_message_content}
    </div>
    
    <h3>SAM's Suggested Reply:</h3>
    <div class="message-preview">
      ${session.sam_suggested_reply}
      ${session.sam_confidence_score ? `<p><small>Confidence: ${Math.round(session.sam_confidence_score * 100)}%</small></p>` : ''}
    </div>
    
    <div style="text-align: center; margin: 32px 0;">
      <button onclick="approveMessage()" class="button">✅ Approve & Send</button>
      <a href="/hitl/modify/${sessionId}" class="button warning">✏️ Modify</a>
      <a href="/hitl/reject/${sessionId}" class="button danger">❌ Reject</a>
    </div>
    ` : `
    <div class="status ${session.approval_status}">
      <h2>Session Status: ${session.approval_status.toUpperCase()}</h2>
      <p>This approval session has already been processed.</p>
      ${session.reviewed_at ? `<p>Reviewed at: ${new Date(session.reviewed_at).toLocaleString()}</p>` : ''}
    </div>
    `}
    
    <div style="text-align: center; margin-top: 40px; font-size: 14px; color: #666;">
      <p>Session ID: ${sessionId}</p>
    </div>
  </div>
  
  <script>
    async function approveMessage() {
      try {
        const response = await fetch('/api/hitl/approve/${sessionId}', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviewed_by: 'email_approval' })
        });
        
        const result = await response.json();
        
        if (result.success) {
          document.querySelector('.container').innerHTML = \`
            <div class="status approved">
              <h2>✅ Message Approved!</h2>
              <p>The message has been approved and sent successfully.</p>
            </div>
          \`;
        } else {
          alert('Error: ' + result.error);
        }
      } catch (error) {
        alert('Failed to approve message: ' + error.message);
      }
    }
  </script>
</body>
</html>
    `

    return new NextResponse(confirmationHtml, {
      headers: {
        'Content-Type': 'text/html',
      },
    })

  } catch (error) {
    console.error('HITL approval page generation failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
