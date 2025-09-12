import { ServerClient } from 'postmark';

export interface PostmarkSuppressionEntry {
  EmailAddress: string;
  SuppressionReason: string;
  Origin: string;
  CreatedAt: string;
}

export interface PostmarkError extends Error {
  ErrorCode?: number;
  Message?: string;
}

export interface PostmarkConfig {
  apiKey: string;
  fromEmail: string;
  companyName: string;
  contactEmail: string;
  contactName: string;
}

export interface EmailValidationResult {
  canSend: boolean;
  reason?: string;
  suppressionInfo?: PostmarkSuppressionEntry;
  alternativeEmail?: string;
}

export class PostmarkEmailHelper {
  private client: ServerClient;
  private config: PostmarkConfig;

  constructor(config: PostmarkConfig) {
    this.client = new ServerClient(config.apiKey);
    this.config = config;
  }

  /**
   * Check if an email address is suppressed in Postmark
   */
  async checkEmailSuppression(email: string): Promise<EmailValidationResult> {
    try {
      // Get suppressions for outbound message stream
      const suppressions = await this.client.getSuppressions('outbound');
      
      const suppressedEmail = suppressions.Suppressions?.find(
        (suppression: PostmarkSuppressionEntry) => 
          suppression.EmailAddress.toLowerCase() === email.toLowerCase()
      );

      if (suppressedEmail) {
        return {
          canSend: false,
          reason: this.getSuppressionReasonMessage(suppressedEmail.SuppressionReason),
          suppressionInfo: suppressedEmail
        };
      }

      return { canSend: true };

    } catch (error) {
      console.error(`Error checking email suppression for ${email}:`, error);
      // If we can't check suppression status, assume we can send but log the issue
      return { 
        canSend: true, 
        reason: 'Unable to verify suppression status - will attempt to send'
      };
    }
  }

  /**
   * Get a user-friendly message for suppression reasons
   */
  private getSuppressionReasonMessage(reason: string): string {
    switch (reason) {
      case 'HardBounce':
        return 'Email address has hard bounced (invalid/non-existent)';
      case 'SpamComplaint':
        return 'Recipient has marked emails as spam';
      case 'ManualSuppression':
        return 'Email address has been manually suppressed';
      case 'Unsubscribe':
        return 'Recipient has unsubscribed from emails';
      default:
        return `Email is suppressed (${reason})`;
    }
  }

  /**
   * Attempt to reactivate a suppressed email address
   */
  async reactivateEmail(email: string): Promise<{ success: boolean; message: string }> {
    try {
      // Delete the suppression entry
      await this.client.deleteSuppressions('outbound', { Suppressions: [{ EmailAddress: email }] });
      
      return {
        success: true,
        message: 'Email address reactivated successfully'
      };
    } catch (error) {
      const postmarkError = error as PostmarkError;
      return {
        success: false,
        message: postmarkError.Message || 'Failed to reactivate email address'
      };
    }
  }

  /**
   * Send email with comprehensive error handling
   */
  async sendEmailSafely(emailData: {
    To: string;
    From?: string;
    Subject: string;
    HtmlBody: string;
    TextBody: string;
    MessageStream?: string;
  }): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
    suppressionInfo?: PostmarkSuppressionEntry;
    canRetryAfterReactivation?: boolean;
  }> {
    try {
      // First check if recipient is suppressed
      const validationResult = await this.checkEmailSuppression(emailData.To);
      
      if (!validationResult.canSend) {
        return {
          success: false,
          error: `Cannot send email: ${validationResult.reason}`,
          suppressionInfo: validationResult.suppressionInfo,
          canRetryAfterReactivation: true
        };
      }

      // Attempt to send the email
      const result = await this.client.sendEmail({
        From: emailData.From || this.config.fromEmail,
        To: emailData.To,
        Subject: emailData.Subject,
        HtmlBody: emailData.HtmlBody,
        TextBody: emailData.TextBody,
        MessageStream: emailData.MessageStream || 'outbound'
      });

      return {
        success: true,
        messageId: result.MessageID
      };

    } catch (error) {
      const postmarkError = error as PostmarkError;
      
      // Handle specific Postmark errors
      if (postmarkError.Message?.includes('InactiveRecipientsError') || 
          postmarkError.Message?.includes('inactive')) {
        
        // Re-check suppression status for detailed info
        const suppressionCheck = await this.checkEmailSuppression(emailData.To);
        
        return {
          success: false,
          error: 'Recipient is marked as inactive/suppressed in Postmark',
          suppressionInfo: suppressionCheck.suppressionInfo,
          canRetryAfterReactivation: true
        };
      }

      // Handle other Postmark errors
      return {
        success: false,
        error: postmarkError.Message || 'Unknown email sending error',
        canRetryAfterReactivation: false
      };
    }
  }

  /**
   * Generate test email addresses for different scenarios
   */
  generateTestEmails(): {
    safe: string[];
    forTesting: string[];
    description: string;
  } {
    return {
      safe: [
        'test@innovareai.com',
        'sandbox@3cubed.ai',
        'demo@meet-sam.com'
      ],
      forTesting: [
        // Postmark test email addresses that don't actually send
        'test@blackhole.postmarkapp.com',
        'bounce@simulator.postmarkapp.com'
      ],
      description: 'Use safe emails for production testing, test emails for development'
    };
  }

  /**
   * Create email bypass mode for testing
   */
  createBypassEmail(originalEmail: string): string {
    // For testing, redirect to a safe email while logging the original
    const timestamp = Date.now();
    console.log(`EMAIL_BYPASS_MODE: Original recipient: ${originalEmail}, redirected to test email at ${new Date().toISOString()}`);
    
    return 'test@blackhole.postmarkapp.com'; // Postmark's test email that accepts but doesn't deliver
  }

  /**
   * Bulk check multiple email addresses for suppression
   */
  async bulkCheckSuppressions(emails: string[]): Promise<Map<string, EmailValidationResult>> {
    const results = new Map<string, EmailValidationResult>();
    
    try {
      const suppressions = await this.client.getSuppressions('outbound');
      const suppressedEmails = new Set(
        suppressions.Suppressions?.map((s: PostmarkSuppressionEntry) => s.EmailAddress.toLowerCase()) || []
      );

      for (const email of emails) {
        if (suppressedEmails.has(email.toLowerCase())) {
          const suppressedEntry = suppressions.Suppressions?.find(
            (s: PostmarkSuppressionEntry) => s.EmailAddress.toLowerCase() === email.toLowerCase()
          );
          
          results.set(email, {
            canSend: false,
            reason: suppressedEntry ? this.getSuppressionReasonMessage(suppressedEntry.SuppressionReason) : 'Suppressed',
            suppressionInfo: suppressedEntry
          });
        } else {
          results.set(email, { canSend: true });
        }
      }
    } catch (error) {
      console.error('Error in bulk suppression check:', error);
      // If bulk check fails, mark all as "can send" but log the issue
      for (const email of emails) {
        results.set(email, { 
          canSend: true, 
          reason: 'Unable to verify suppression status'
        });
      }
    }

    return results;
  }
}

/**
 * Factory function to create PostmarkEmailHelper instances for different companies
 */
export function createPostmarkHelper(company: 'InnovareAI' | '3cubedai'): PostmarkEmailHelper | null {
  const config = getCompanyConfig(company);
  if (!config) return null;
  
  return new PostmarkEmailHelper(config);
}

function getCompanyConfig(company: string): PostmarkConfig | null {
  const configs = {
    InnovareAI: {
      apiKey: process.env.POSTMARK_INNOVAREAI_API_KEY || '',
      fromEmail: 'sp@innovareai.com',
      companyName: 'InnovareAI',
      contactEmail: 'sp@innovareai.com',
      contactName: 'Sarah Powell'
    },
    '3cubedai': {
      apiKey: process.env.POSTMARK_3CUBEDAI_API_KEY || '',
      fromEmail: 'sophia@3cubed.ai',
      companyName: '3CubedAI',
      contactEmail: 'sophia@3cubed.ai',
      contactName: 'Sophia Caldwell'
    }
  };

  const config = configs[company as keyof typeof configs];
  if (!config?.apiKey) {
    console.error(`Missing Postmark API key for ${company}`);
    return null;
  }

  return config;
}

/**
 * Emergency bypass mode - use for testing when suppressions are blocking everything
 */
export const EMAIL_BYPASS_MODE = process.env.EMAIL_BYPASS_MODE === 'true';

export function shouldBypassEmail(email: string): boolean {
  // In bypass mode, redirect emails to safe test addresses
  return EMAIL_BYPASS_MODE;
}

export function getSafeTestEmail(): string {
  return 'test@blackhole.postmarkapp.com';
}