/**
 * Unipile Sender Service
 * Handles sending messages and emails via Unipile API
 * Supports LinkedIn messaging, email sending, and reply threading
 */

export interface UnipileAccount {
  id: string;
  name: string;
  type: 'LINKEDIN' | 'EMAIL' | 'GMAIL' | 'OUTLOOK';
  connection_params: any;
  sources: Array<{ id: string; type: string }>;
}

export interface SendMessageRequest {
  accountId: string;
  chatId?: string;
  recipientId?: string;
  message: string;
  replyToMessageId?: string;
}

export interface SendEmailRequest {
  accountId: string;
  to: string;
  subject: string;
  body: string;
  replyToMessageId?: string;
  threadId?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  platform: 'linkedin' | 'email';
  timestamp: string;
}

export class UnipileSender {
  private unipileDsn: string;
  private unipileApiKey: string;

  constructor() {
    this.unipileDsn = process.env.UNIPILE_DSN!;
    this.unipileApiKey = process.env.UNIPILE_API_KEY!;

    if (!this.unipileDsn || !this.unipileApiKey) {
      throw new Error('Unipile credentials not configured. Missing UNIPILE_DSN or UNIPILE_API_KEY');
    }
  }

  /**
   * Send a LinkedIn message via Unipile
   */
  async sendLinkedInMessage(request: SendMessageRequest): Promise<SendResult> {
    try {
      console.log('📤 Sending LinkedIn message via Unipile...', {
        accountId: request.accountId,
        hasReplyTo: !!request.replyToMessageId
      });

      const url = `https://${this.unipileDsn}/api/v1/accounts/${request.accountId}/messaging/send`;
      
      const payload = {
        chat_id: request.chatId,
        recipient_id: request.recipientId,
        message: request.message,
        reply_to_message_id: request.replyToMessageId,
        platform: 'linkedin'
      };

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'X-API-KEY': this.unipileApiKey,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Unipile LinkedIn send failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ LinkedIn message sent successfully:', result);

        return {
          success: true,
          messageId: result.message_id || result.id,
          platform: 'linkedin',
          timestamp: new Date().toISOString()
        };
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error('Unipile API timeout after 30 seconds');
        }
        throw fetchError;
      }

    } catch (error) {
      console.error('❌ Failed to send LinkedIn message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        platform: 'linkedin',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Send an email via Unipile
   */
  async sendEmail(request: SendEmailRequest): Promise<SendResult> {
    try {
      console.log('📧 Sending email via Unipile...', {
        accountId: request.accountId,
        to: request.to,
        hasReplyTo: !!request.replyToMessageId
      });

      const url = `https://${this.unipileDsn}/api/v1/accounts/${request.accountId}/email/send`;
      
      const payload = {
        to: request.to,
        subject: request.subject,
        body: request.body,
        reply_to_message_id: request.replyToMessageId,
        thread_id: request.threadId,
        format: 'html' // Assuming HTML format for rich content
      };

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'X-API-KEY': this.unipileApiKey,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Unipile email send failed: ${response.status} - ${errorText}`);
      }

        const result = await response.json();
        console.log('✅ Email sent successfully:', result);

        return {
          success: true,
          messageId: result.message_id || result.id,
          platform: 'email',
          timestamp: new Date().toISOString()
        };
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error('Unipile API timeout after 30 seconds');
        }
        throw fetchError;
      }

    } catch (error) {
      console.error('❌ Failed to send email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        platform: 'email',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Reply to a specific message (auto-detects platform)
   */
  async replyToMessage(
    originalMessage: {
      id: string;
      platform: 'linkedin' | 'email';
      chatId?: string;
      senderId?: string;
      email?: string;
    },
    replyText: string,
    accountId: string
  ): Promise<SendResult> {
    
    if (originalMessage.platform === 'linkedin') {
      return this.sendLinkedInMessage({
        accountId,
        chatId: originalMessage.chatId,
        recipientId: originalMessage.senderId,
        message: replyText,
        replyToMessageId: originalMessage.id
      });
    } else if (originalMessage.platform === 'email') {
      // Extract subject from original message for reply
      const replySubject = `Re: ${originalMessage.email || 'Your message'}`;
      
      return this.sendEmail({
        accountId,
        to: originalMessage.email || originalMessage.senderId || '',
        subject: replySubject,
        body: replyText,
        replyToMessageId: originalMessage.id
      });
    } else {
      throw new Error(`Unsupported platform: ${originalMessage.platform}`);
    }
  }

  /**
   * Get available accounts for sending (reuse MCP function pattern)
   */
  async getAvailableAccounts(): Promise<UnipileAccount[]> {
    try {
      const url = `https://${this.unipileDsn}/api/v1/accounts`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-API-KEY': this.unipileApiKey,
          'Accept': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch accounts: ${response.status}`);
      }

      const accounts = await response.json();
      return Array.isArray(accounts) ? accounts : (accounts.items || []);
      
    } catch (error) {
      console.error('❌ Failed to get available accounts:', error);
      return [];
    }
  }

  /**
   * Test connection and permissions
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const accounts = await this.getAvailableAccounts();
      return {
        success: true,
        ...accounts.length > 0 && { accountsFound: accounts.length }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }
}

// Singleton instance
export const unipileSender = new UnipileSender();