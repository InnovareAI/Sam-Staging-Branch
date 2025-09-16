/**
 * Email Integration Service for SAM AI Platform
 * Handles Google Workspace, Microsoft 365, SMTP, and Calendly integrations
 */

interface EmailProvider {
  id: string;
  user_id: string;
  provider_type: 'google' | 'microsoft' | 'smtp' | 'calendly';
  provider_name: string;
  email_address: string;
  status: 'connected' | 'disconnected' | 'error' | 'syncing';
  config: Record<string, any>;
}

interface EmailMessage {
  id: string;
  external_message_id: string;
  subject: string;
  from_address: string;
  from_name?: string;
  to_addresses: string[];
  body_text?: string;
  body_html?: string;
  message_date: string;
  is_read: boolean;
  has_attachments: boolean;
}

interface GoogleOAuthConfig {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  scopes: string[];
}

interface MicrosoftOAuthConfig {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  scopes: string[];
}

interface SMTPConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  use_tls: boolean;
  use_ssl: boolean;
}

export class EmailIntegrationService {
  private googleConfig: GoogleOAuthConfig;
  private microsoftConfig: MicrosoftOAuthConfig;

  constructor() {
    this.googleConfig = {
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirect_uri: process.env.GOOGLE_REDIRECT_URI || '',
      scopes: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/userinfo.email'
      ]
    };

    this.microsoftConfig = {
      client_id: process.env.MICROSOFT_CLIENT_ID || '',
      client_secret: process.env.MICROSOFT_CLIENT_SECRET || '',
      redirect_uri: process.env.MICROSOFT_REDIRECT_URI || '',
      scopes: [
        'https://graph.microsoft.com/Mail.Read',
        'https://graph.microsoft.com/Mail.Send',
        'https://graph.microsoft.com/Calendars.Read',
        'https://graph.microsoft.com/User.Read'
      ]
    };
  }

  /**
   * Generate Google OAuth 2.0 authorization URL
   */
  getGoogleAuthURL(userId: string): string {
    const params = new URLSearchParams({
      client_id: this.googleConfig.client_id,
      redirect_uri: this.googleConfig.redirect_uri,
      response_type: 'code',
      scope: this.googleConfig.scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: userId // Pass user ID for security
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Generate Microsoft OAuth 2.0 authorization URL
   */
  getMicrosoftAuthURL(userId: string): string {
    const params = new URLSearchParams({
      client_id: this.microsoftConfig.client_id,
      redirect_uri: this.microsoftConfig.redirect_uri,
      response_type: 'code',
      scope: this.microsoftConfig.scopes.join(' '),
      response_mode: 'query',
      state: userId // Pass user ID for security
    });

    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  }

  /**
   * Exchange Google authorization code for tokens
   */
  async exchangeGoogleCode(code: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    email: string;
  }> {
    try {
      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.googleConfig.client_id,
          client_secret: this.googleConfig.client_secret,
          redirect_uri: this.googleConfig.redirect_uri,
          grant_type: 'authorization_code',
          code
        })
      });

      if (!tokenResponse.ok) {
        throw new Error(`Token exchange failed: ${tokenResponse.statusText}`);
      }

      const tokens = await tokenResponse.json();

      // Get user email
      const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
      });

      if (!userResponse.ok) {
        throw new Error(`User info fetch failed: ${userResponse.statusText}`);
      }

      const userInfo = await userResponse.json();

      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        email: userInfo.email
      };
    } catch (error) {
      console.error('Google OAuth exchange failed:', error);
      throw error;
    }
  }

  /**
   * Exchange Microsoft authorization code for tokens
   */
  async exchangeMicrosoftCode(code: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    email: string;
  }> {
    try {
      // Exchange code for tokens
      const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.microsoftConfig.client_id,
          client_secret: this.microsoftConfig.client_secret,
          redirect_uri: this.microsoftConfig.redirect_uri,
          grant_type: 'authorization_code',
          code
        })
      });

      if (!tokenResponse.ok) {
        throw new Error(`Token exchange failed: ${tokenResponse.statusText}`);
      }

      const tokens = await tokenResponse.json();

      // Get user email
      const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
      });

      if (!userResponse.ok) {
        throw new Error(`User info fetch failed: ${userResponse.statusText}`);
      }

      const userInfo = await userResponse.json();

      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        email: userInfo.mail || userInfo.userPrincipalName
      };
    } catch (error) {
      console.error('Microsoft OAuth exchange failed:', error);
      throw error;
    }
  }

  /**
   * Test SMTP connection
   */
  async testSMTPConnection(config: SMTPConfig): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // This is a placeholder - in a real implementation, you'd use nodemailer or similar
      // to test the SMTP connection
      console.log('Testing SMTP connection:', {
        host: config.host,
        port: config.port,
        username: config.username,
        use_tls: config.use_tls,
        use_ssl: config.use_ssl
      });

      // Simulate connection test
      if (!config.host || !config.port || !config.username || !config.password) {
        return {
          success: false,
          error: 'Missing required SMTP configuration fields'
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown SMTP error'
      };
    }
  }

  /**
   * Sync Gmail messages for a provider
   */
  async syncGmailMessages(provider: EmailProvider, accessToken: string): Promise<EmailMessage[]> {
    try {
      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!response.ok) {
        throw new Error(`Gmail API error: ${response.statusText}`);
      }

      const data = await response.json();
      const messages: EmailMessage[] = [];

      // Fetch details for each message
      for (const message of data.messages || []) {
        try {
          const detailResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });

          if (detailResponse.ok) {
            const messageDetail = await detailResponse.json();
            const headers = messageDetail.payload?.headers || [];
            
            const getHeader = (name: string) => 
              headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

            messages.push({
              id: message.id,
              external_message_id: message.id,
              subject: getHeader('Subject'),
              from_address: getHeader('From'),
              from_name: getHeader('From').split('<')[0].trim(),
              to_addresses: [getHeader('To')],
              body_text: messageDetail.snippet || '',
              body_html: '',
              message_date: new Date(parseInt(messageDetail.internalDate)).toISOString(),
              is_read: !messageDetail.labelIds?.includes('UNREAD'),
              has_attachments: messageDetail.payload?.parts?.some((part: any) => part.filename) || false
            });
          }
        } catch (error) {
          console.warn(`Failed to fetch message ${message.id}:`, error);
        }
      }

      return messages;
    } catch (error) {
      console.error('Gmail sync failed:', error);
      throw error;
    }
  }

  /**
   * Sync Outlook messages for a provider
   */
  async syncOutlookMessages(provider: EmailProvider, accessToken: string): Promise<EmailMessage[]> {
    try {
      const response = await fetch('https://graph.microsoft.com/v1.0/me/messages?$top=50&$orderby=receivedDateTime desc', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!response.ok) {
        throw new Error(`Microsoft Graph API error: ${response.statusText}`);
      }

      const data = await response.json();
      const messages: EmailMessage[] = [];

      for (const message of data.value || []) {
        messages.push({
          id: message.id,
          external_message_id: message.id,
          subject: message.subject || '',
          from_address: message.from?.emailAddress?.address || '',
          from_name: message.from?.emailAddress?.name || '',
          to_addresses: message.toRecipients?.map((r: any) => r.emailAddress?.address) || [],
          body_text: message.body?.content || '',
          body_html: message.body?.contentType === 'html' ? message.body?.content : '',
          message_date: message.receivedDateTime,
          is_read: message.isRead || false,
          has_attachments: message.hasAttachments || false
        });
      }

      return messages;
    } catch (error) {
      console.error('Outlook sync failed:', error);
      throw error;
    }
  }

  /**
   * Refresh Google OAuth token
   */
  async refreshGoogleToken(refreshToken: string): Promise<{
    access_token: string;
    expires_in: number;
  }> {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.googleConfig.client_id,
          client_secret: this.googleConfig.client_secret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Google token refresh failed:', error);
      throw error;
    }
  }

  /**
   * Refresh Microsoft OAuth token
   */
  async refreshMicrosoftToken(refreshToken: string): Promise<{
    access_token: string;
    expires_in: number;
  }> {
    try {
      const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.microsoftConfig.client_id,
          client_secret: this.microsoftConfig.client_secret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Microsoft token refresh failed:', error);
      throw error;
    }
  }

  /**
   * Get supported email providers
   */
  getSupportedProviders(): Array<{
    type: string;
    name: string;
    description: string;
    authRequired: boolean;
  }> {
    return [
      {
        type: 'google',
        name: 'Google Workspace',
        description: 'Gmail + Calendar + Drive',
        authRequired: true
      },
      {
        type: 'microsoft',
        name: 'Microsoft 365',
        description: 'Outlook + Teams + OneDrive',
        authRequired: true
      },
      {
        type: 'smtp',
        name: 'SMTP Email',
        description: 'Custom Email Provider',
        authRequired: false
      },
      {
        type: 'calendly',
        name: 'Calendly',
        description: 'Scheduling & Bookings',
        authRequired: true
      }
    ];
  }
}