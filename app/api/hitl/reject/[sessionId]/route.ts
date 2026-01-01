import { toastSuccess, toastError, toastWarning, toastInfo } from '@/lib/toast';
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { HITLApprovalEmailService } from '@/lib/services/hitl-approval-email-service';

/**
 * HITL Approval Decision - Reject Endpoint
 * Handles rejection decisions for HITL sessions
 */

const supabase = pool
const hitlService = new HITLApprovalEmailService()

interface RouteParams {
  params: {
    sessionId: string
  }
}

// POST - Reject the suggested message
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

    // Get reviewer info and rejection reason
    const body = await request.json().catch(() => ({}))
    const reviewedBy = body.reviewed_by || 'system'
    const rejectionReason = body.rejection_reason || 'Message rejected by reviewer'

    // Process rejection decision
    const result = await hitlService.processApprovalDecision(
      sessionId,
      'rejected',
      reviewedBy,
      undefined, // No final message
      rejectionReason
    )

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to process rejection'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Message rejected successfully',
      session_id: sessionId,
      decision: 'rejected'
    })

  } catch (error) {
    console.error('HITL rejection processing failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET - Show rejection confirmation page
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

    // Generate rejection confirmation HTML
    const confirmationHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reject SAM AI Message</title>
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
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .button {
      display: inline-block;
      background: #ef4444;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 10px 5px;
      border: none;
      cursor: pointer;
    }
    .button.secondary {
      background: #6b7280;
    }
    .form-group {
      margin: 20px 0;
    }
    .form-group label {
      display: block;
      margin-bottom: 8px;
      font-weight: 600;
    }
    .form-group textarea {
      width: 100%;
      min-height: 100px;
      padding: 12px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-family: inherit;
    }
    .status { 
      padding: 16px; 
      border-radius: 8px; 
      margin: 20px 0; 
      text-align: center;
    }
    .status.rejected { background: #fecaca; color: #991b1b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>❌ Reject SAM AI Message</h1>
      <p>${session.workspace?.name || 'Workspace'}</p>
    </div>
    
    ${session.approval_status === 'pending' ? `
    <h2>Reject Message</h2>
    <p><strong>Contact:</strong> ${session.prospect_name || 'Unknown'} 
       ${session.prospect_company ? `(${session.prospect_company})` : ''}</p>
    <p><strong>Channel:</strong> ${session.original_message_channel === 'linkedin' ? 'LinkedIn' : 'Email'}</p>
    
    <h3>Original Message:</h3>
    <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;">
      ${session.original_message_content}
    </div>
    
    <h3>SAM's Suggested Reply (to be rejected):</h3>
    <div class="message-preview">
      ${session.sam_suggested_reply}
    </div>
    
    <form onsubmit="rejectMessage(event)">
      <div class="form-group">
        <label for="rejectionReason">Reason for rejection (optional):</label>
        <textarea id="rejectionReason" name="rejectionReason" 
                  placeholder="Please provide feedback on why this message was rejected. This helps improve SAM's future responses."></textarea>
      </div>
      
      <div style="text-align: center; margin: 32px 0;">
        <button type="submit" class="button">❌ Confirm Rejection</button>
        <a href="/hitl/approve/${sessionId}" class="button secondary">← Back to Review</a>
      </div>
    </form>
    ` : `
    <div class="status rejected">
      <h2>Message Already ${session.approval_status.toUpperCase()}</h2>
      <p>This approval session has already been processed.</p>
      ${session.reviewed_at ? `<p>Reviewed at: ${new Date(session.reviewed_at).toLocaleString()}</p>` : ''}
    </div>
    `}
    
    <div style="text-align: center; margin-top: 40px; font-size: 14px; color: #666;">
      <p>Session ID: ${sessionId}</p>
    </div>
  </div>
  
  <script>
    async function rejectMessage(event) {
      event.preventDefault();
      
      const rejectionReason = document.getElementById('rejectionReason').value;
      
      try {
        const response = await fetch('/api/hitl/reject/${sessionId}', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            reviewed_by: 'email_rejection',
            rejection_reason: rejectionReason
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          document.querySelector('.container').innerHTML = \`
            <div class="status rejected">
              <h2>❌ Message Rejected</h2>
              <p>The message has been rejected and will not be sent.</p>
              <p><strong>Thank you for your feedback!</strong> This helps SAM learn and improve.</p>
            </div>
          \`;
        } else {
          alert('Error: ' + result.error);
        }
      } catch (error) {
        alert('Failed to reject message: ' + error.message);
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
    console.error('HITL rejection page generation failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
