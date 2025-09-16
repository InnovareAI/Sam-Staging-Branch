/**
 * Email Approval Parser Service
 * Parses client email responses for SAM reply approvals
 * Handles APPROVED, CHANGES, STOP commands
 */

export type ApprovalAction = 'APPROVED' | 'CHANGES' | 'STOP' | 'UNKNOWN';

export interface ApprovalResult {
  action: ApprovalAction;
  updatedMessage?: string;
  originalThreadId?: string;
  clientEmail: string;
  timestamp: string;
  confidence: number; // 0-1 score for parsing accuracy
}

export interface EmailParseInput {
  subject: string;
  body: string;
  fromEmail: string;
  messageId?: string;
  inReplyTo?: string;
}

export class EmailApprovalParser {
  private approvalPatterns = {
    approved: [
      /^APPROVED$/im,
      /^APPROVE$/im,
      /^YES$/im,
      /^SEND\s*IT$/im,
      /^GO\s*AHEAD$/im,
      /^LOOKS?\s*GOOD$/im,
      /^SEND\s*AS\s*IS$/im,
      /approved.*send/im,
      /send.*as.*drafted/im,
      /this.*looks.*good/im
    ],
    
    changes: [
      /^CHANGES?:\s*(.+)/ims,
      /^UPDATE:\s*(.+)/ims,
      /^MODIFY:\s*(.+)/ims,
      /^EDIT:\s*(.+)/ims,
      /^REVISE:\s*(.+)/ims,
      /^SEND\s*WITH\s*CHANGES?:\s*(.+)/ims,
      /change.*to:\s*(.+)/ims,
      /update.*message:\s*(.+)/ims,
      /instead.*say:\s*(.+)/ims,
      /replace.*with:\s*(.+)/ims
    ],
    
    stop: [
      /^STOP$/im,
      /^CANCEL$/im,
      /^NO$/im,
      /^DON'T\s*SEND$/im,
      /^DO\s*NOT\s*SEND$/im,
      /^ABORT$/im,
      /^REJECT$/im,
      /don't.*send.*this/im,
      /cancel.*message/im,
      /stop.*sending/im,
      /do.*not.*proceed/im
    ]
  };

  /**
   * Parse client email response for approval decision
   */
  parseApprovalEmail(input: EmailParseInput): ApprovalResult {
    const { subject, body, fromEmail } = input;
    const cleanBody = this.cleanEmailBody(body);
    const fullText = `${subject} ${cleanBody}`.trim();

    console.log('📧 Parsing approval email...', { 
      from: fromEmail, 
      bodyLength: cleanBody.length,
      subjectContains: subject.toLowerCase()
    });

    // Try to extract thread ID from subject or headers
    const threadId = this.extractThreadId(subject, input.inReplyTo);

    // Test for APPROVED
    for (const pattern of this.approvalPatterns.approved) {
      if (pattern.test(fullText)) {
        return {
          action: 'APPROVED',
          originalThreadId: threadId,
          clientEmail: fromEmail,
          timestamp: new Date().toISOString(),
          confidence: 0.9
        };
      }
    }

    // Test for CHANGES
    for (const pattern of this.approvalPatterns.changes) {
      const match = fullText.match(pattern);
      if (match) {
        const updatedMessage = match[1]?.trim();
        return {
          action: 'CHANGES',
          updatedMessage: updatedMessage || cleanBody,
          originalThreadId: threadId,
          clientEmail: fromEmail,
          timestamp: new Date().toISOString(),
          confidence: updatedMessage ? 0.95 : 0.7
        };
      }
    }

    // Test for STOP
    for (const pattern of this.approvalPatterns.stop) {
      if (pattern.test(fullText)) {
        return {
          action: 'STOP',
          originalThreadId: threadId,
          clientEmail: fromEmail,
          timestamp: new Date().toISOString(),
          confidence: 0.9
        };
      }
    }

    // Fallback: If email contains substantial text, treat as CHANGES
    if (cleanBody.length > 20 && !this.isAutoReply(cleanBody)) {
      return {
        action: 'CHANGES',
        updatedMessage: cleanBody,
        originalThreadId: threadId,
        clientEmail: fromEmail,
        timestamp: new Date().toISOString(),
        confidence: 0.5 // Lower confidence for fallback
      };
    }

    // Unknown/unparseable
    return {
      action: 'UNKNOWN',
      originalThreadId: threadId,
      clientEmail: fromEmail,
      timestamp: new Date().toISOString(),
      confidence: 0.1
    };
  }

  /**
   * Clean email body by removing signatures, quoted text, etc.
   */
  private cleanEmailBody(body: string): string {
    if (!body) return '';

    let cleaned = body;

    // Remove common email signatures and footers
    const signaturePatterns = [
      /^--\s*$/m, // Standard signature delimiter
      /^Best regards,.*$/ims,
      /^Regards,.*$/ims,
      /^Thanks,.*$/ims,
      /^Sent from my.*$/ims,
      /^Get Outlook for.*$/ims,
      /^Confidentiality Notice.*$/ims
    ];

    for (const pattern of signaturePatterns) {
      cleaned = cleaned.replace(pattern, '');
    }

    // Remove quoted email content (lines starting with >)
    cleaned = cleaned.replace(/^>.*$/gm, '');
    
    // Remove "On [date], [person] wrote:" type headers
    cleaned = cleaned.replace(/^On\s+.*wrote:.*$/gm, '');
    
    // Remove HTML tags if present
    cleaned = cleaned.replace(/<[^>]*>/g, '');
    
    // Remove excessive whitespace
    cleaned = cleaned.replace(/\n\s*\n/g, '\n').trim();

    return cleaned;
  }

  /**
   * Extract thread ID from subject line or message headers
   */
  private extractThreadId(subject: string, inReplyTo?: string): string | undefined {
    // Look for thread ID in subject line
    const subjectMatch = subject.match(/\[THREAD:([^\]]+)\]/);
    if (subjectMatch) {
      return subjectMatch[1];
    }

    // Look for SAM thread ID patterns
    const samThreadMatch = subject.match(/SAM-(\w+)/);
    if (samThreadMatch) {
      return samThreadMatch[1];
    }

    // Use In-Reply-To header if available
    if (inReplyTo) {
      return inReplyTo;
    }

    return undefined;
  }

  /**
   * Detect auto-reply messages
   */
  private isAutoReply(body: string): boolean {
    const autoReplyPatterns = [
      /out of office/i,
      /automatic reply/i,
      /auto-reply/i,
      /vacation response/i,
      /away message/i,
      /currently unavailable/i
    ];

    return autoReplyPatterns.some(pattern => pattern.test(body));
  }

  /**
   * Generate approval email template for clients
   */
  generateApprovalEmailTemplate(
    originalMessage: string,
    draftReply: string,
    threadId: string,
    recipientName: string
  ): {
    subject: string;
    body: string;
    replyTo: string;
  } {
    const subject = `SAM Reply Approval Required [THREAD:${threadId}]`;
    
    const body = `
Hi ${recipientName},

SAM has drafted a reply to an incoming message. Please review and respond with one of the following:

🔹 APPROVED - Send the reply as drafted
🔹 CHANGES: [your updated message] - Send with modifications  
🔹 STOP - Do not send any reply

---

ORIGINAL MESSAGE:
${originalMessage}

---

DRAFTED REPLY:
${draftReply}

---

Reply to this email with your decision. The message will be sent automatically based on your response.

Thread ID: ${threadId}
Generated by SAM AI Assistant
    `.trim();

    return {
      subject,
      body,
      replyTo: process.env.SAM_APPROVAL_EMAIL || 'sam-approvals@innovareai.com'
    };
  }

  /**
   * Validate approval result before processing
   */
  validateApprovalResult(result: ApprovalResult): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (result.confidence < 0.3) {
      errors.push('Low confidence in email parsing');
    }

    if (result.action === 'CHANGES' && !result.updatedMessage?.trim()) {
      errors.push('Changes requested but no updated message provided');
    }

    if (!result.originalThreadId) {
      errors.push('Could not identify original thread ID');
    }

    if (!result.clientEmail || !result.clientEmail.includes('@')) {
      errors.push('Invalid client email address');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Singleton instance
export const emailApprovalParser = new EmailApprovalParser();