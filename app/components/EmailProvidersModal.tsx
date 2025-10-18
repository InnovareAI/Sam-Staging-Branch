'use client';

import React, { useState, useEffect } from 'react';
import { Mail, X, Plus, Trash2, CheckCircle, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';

interface EmailProvider {
  id: string;
  user_id: string;
  provider_type: 'google' | 'microsoft' | 'smtp';
  provider_name: string;
  email_address: string;
  status: 'connected' | 'disconnected' | 'error' | 'syncing';
  config?: Record<string, any>;
  last_sync?: string;
  last_error?: string;
  created_at: string;
  updated_at: string;
  // SMTP specific fields
  smtp_host?: string;
  smtp_port?: number;
  smtp_username?: string;
  smtp_use_tls?: boolean;
  smtp_use_ssl?: boolean;
}


interface SMTPFormData {
  email_address: string;
  smtp_host: string;
  smtp_port: string;
  smtp_username: string;
  smtp_password: string;
  smtp_use_tls: boolean;
  smtp_use_ssl: boolean;
}

interface EmailProvidersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EmailProvidersModal: React.FC<EmailProvidersModalProps> = ({ isOpen, onClose }) => {
  const [providers, setProviders] = useState<EmailProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [addProviderType, setAddProviderType] = useState<'google' | 'microsoft' | 'smtp' | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // SMTP Form State
  const [smtpForm, setSmtpForm] = useState<SMTPFormData>({
    email_address: '',
    smtp_host: '',
    smtp_port: '587',
    smtp_username: '',
    smtp_password: '',
    smtp_use_tls: true,
    smtp_use_ssl: false,
  });

  // Fetch email providers
  const fetchProviders = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/email-providers', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      // Handle 401 auth errors gracefully
      if (response.status === 401) {
        console.log('⚠️  Email providers: Authentication issue, showing empty state');
        setProviders([]);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        console.error('Email providers API error:', response.status);
        setProviders([]);
        setLoading(false);
        return;
      }

      const data = await response.json();
      if (data.success) {
        setProviders(data.providers || []);
      } else {
        setProviders([]);
      }
    } catch (error) {
      console.error('Error fetching email providers:', error);
      // Don't show error notification, just show empty state
      setProviders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchProviders();
    }
  }, [isOpen]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Connect Google account via Unipile
  const connectGoogle = async () => {
    try {
      setIsConnecting(true);
      const response = await fetch('/api/unipile/hosted-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'GOOGLE',
          type: 'MESSAGING',
        }),
      });
      const data = await response.json();

      if (data.success && (data.auth_url || data.url)) {
        // Redirect to Unipile hosted auth with custom domain
        window.location.href = data.auth_url || data.url;
      } else {
        throw new Error(data.error || 'Failed to initiate Google OAuth');
      }
    } catch (error) {
      console.error('Error connecting Google:', error);
      showNotification('error', 'Failed to connect Google account');
      setIsConnecting(false);
    }
  };

  // Connect Microsoft account via Unipile
  const connectMicrosoft = async () => {
    try {
      setIsConnecting(true);
      const response = await fetch('/api/unipile/hosted-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'OUTLOOK',
          type: 'MESSAGING',
        }),
      });
      const data = await response.json();

      if (data.success && (data.auth_url || data.url)) {
        // Redirect to Unipile hosted auth with custom domain
        window.location.href = data.auth_url || data.url;
      } else {
        throw new Error(data.error || 'Failed to initiate Microsoft OAuth');
      }
    } catch (error) {
      console.error('Error connecting Microsoft:', error);
      showNotification('error', 'Failed to connect Microsoft account');
      setIsConnecting(false);
    }
  };

  // Add SMTP provider
  const addSMTPProvider = async () => {
    try {
      setIsConnecting(true);

      const response = await fetch('/api/email-providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_type: 'smtp',
          provider_name: 'Custom SMTP',
          email_address: smtpForm.email_address,
          config: {
            host: smtpForm.smtp_host,
            port: parseInt(smtpForm.smtp_port),
            username: smtpForm.smtp_username,
            password: smtpForm.smtp_password,
            use_tls: smtpForm.smtp_use_tls,
            use_ssl: smtpForm.smtp_use_ssl,
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        showNotification('success', 'SMTP account added successfully');
        setShowAddProvider(false);
        setAddProviderType(null);
        setSmtpForm({
          email_address: '',
          smtp_host: '',
          smtp_port: '587',
          smtp_username: '',
          smtp_password: '',
          smtp_use_tls: true,
          smtp_use_ssl: false,
        });
        await fetchProviders();
      } else {
        throw new Error(data.error || 'Failed to add SMTP provider');
      }
    } catch (error) {
      console.error('Error adding SMTP provider:', error);
      showNotification('error', 'Failed to add SMTP account');
    } finally {
      setIsConnecting(false);
    }
  };

  // Delete provider
  const deleteProvider = async (providerId: string) => {
    if (!confirm('Are you sure you want to remove this email account?')) return;

    try {
      const response = await fetch(`/api/email-providers/${providerId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        showNotification('success', 'Email account removed');
        await fetchProviders();
      } else {
        throw new Error(data.error || 'Failed to delete provider');
      }
    } catch (error) {
      console.error('Error deleting provider:', error);
      showNotification('error', 'Failed to remove email account');
    }
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'disconnected':
        return 'bg-gray-500';
      case 'error':
        return 'bg-red-500';
      case 'syncing':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Get provider icon/logo
  const getProviderLogo = (type: string) => {
    switch (type) {
      case 'google':
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
        );
      case 'microsoft':
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#f25022" d="M0 0h11.5v11.5H0z" />
            <path fill="#00a4ef" d="M12.5 0H24v11.5H12.5z" />
            <path fill="#7fba00" d="M0 12.5h11.5V24H0z" />
            <path fill="#ffb900" d="M12.5 12.5H24V24H12.5z" />
          </svg>
        );
      case 'smtp':
        return <Mail className="w-5 h-5 text-gray-400" />;
      default:
        return <Mail className="w-5 h-5 text-gray-400" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 border border-gray-600 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <button
              onClick={onClose}
              className="mr-3 text-gray-400 hover:text-gray-200 transition-colors flex items-center"
              title="Back to Settings"
            >
              <ArrowLeft size={24} />
            </button>
            <h2 className="text-2xl font-semibold text-white flex items-center">
              <Mail className="mr-3 text-blue-400" size={28} />
              Email Integration Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Notification */}
        {notification && (
          <div
            className={`mb-4 p-4 rounded-lg flex items-center ${
              notification.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle className="mr-2" size={20} />
            ) : (
              <AlertCircle className="mr-2" size={20} />
            )}
            {notification.message}
          </div>
        )}

        {/* Connected Accounts */}
        <div className="mb-6">
          <div className="mb-4">
            <h3 className="text-lg font-medium text-white">Connected Email Accounts</h3>
          </div>

          {loading ? (
            <div className="bg-gray-700 rounded-lg p-8 text-center">
              <RefreshCw className="animate-spin mx-auto mb-2 text-gray-400" size={24} />
              <p className="text-gray-400">Loading email accounts...</p>
            </div>
          ) : providers.length === 0 ? (
            <div className="bg-gray-700 rounded-lg p-6 text-center">
              <p className="text-gray-400 text-sm">
                Email accounts will appear here once connected
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {providers.map((provider) => (
                <div
                  key={provider.id}
                  className="bg-gray-700 rounded-lg p-4 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-4">
                    {getProviderLogo(provider.provider_type)}
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-white font-medium">{provider.email_address}</span>
                        <div
                          className={`w-2 h-2 rounded-full ${getStatusColor(provider.status)}`}
                          title={provider.status}
                        ></div>
                      </div>
                      <div className="text-sm text-gray-400">
                        {provider.provider_name} • {provider.status}
                        {provider.last_sync && (
                          <> • Last sync: {new Date(provider.last_sync).toLocaleString()}</>
                        )}
                      </div>
                      {provider.last_error && (
                        <div className="text-sm text-red-400 mt-1">Error: {provider.last_error}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {provider.status === 'error' && (
                      <button
                        onClick={() => fetchProviders()}
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                        title="Retry connection"
                      >
                        <RefreshCw size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => deleteProvider(provider.id)}
                      className="text-red-400 hover:text-red-300 transition-colors"
                      title="Remove account"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Provider Section - Always Visible */}
        <div className="bg-gray-700 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-white">
              {addProviderType === 'smtp' ? 'Configure SMTP Account' : 'Add Email Account'}
            </h3>
            {addProviderType === 'smtp' && (
              <button
                onClick={() => {
                  // Go back to provider selection
                  setAddProviderType(null);
                  setSmtpForm({
                    email_address: '',
                    smtp_host: '',
                    smtp_port: '587',
                    smtp_username: '',
                    smtp_password: '',
                    smtp_use_tls: true,
                    smtp_use_ssl: false,
                  });
                }}
                className="text-gray-400 hover:text-gray-200 transition-colors"
              >
                <X size={20} />
              </button>
            )}
          </div>

            {!addProviderType ? (
              <div className="grid grid-cols-3 gap-4">
                {/* Google OAuth */}
                <button
                  onClick={() => connectGoogle()}
                  disabled={isConnecting}
                  className="bg-gray-600 hover:bg-gray-500 disabled:bg-gray-500 p-6 rounded-lg transition-colors text-center"
                >
                  <svg className="w-12 h-12 mx-auto mb-3" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <div className="text-white font-medium">Google</div>
                  <div className="text-gray-300 text-sm mt-1">Gmail & Workspace</div>
                </button>

                {/* Microsoft OAuth */}
                <button
                  onClick={() => connectMicrosoft()}
                  disabled={isConnecting}
                  className="bg-gray-600 hover:bg-gray-500 disabled:bg-gray-500 p-6 rounded-lg transition-colors text-center"
                >
                  <svg className="w-12 h-12 mx-auto mb-3" viewBox="0 0 24 24">
                    <path fill="#f25022" d="M0 0h11.5v11.5H0z" />
                    <path fill="#00a4ef" d="M12.5 0H24v11.5H12.5z" />
                    <path fill="#7fba00" d="M0 12.5h11.5V24H0z" />
                    <path fill="#ffb900" d="M12.5 12.5H24V24H12.5z" />
                  </svg>
                  <div className="text-white font-medium">Microsoft</div>
                  <div className="text-gray-300 text-sm mt-1">Outlook & Office 365</div>
                </button>

                {/* SMTP */}
                <button
                  onClick={() => setAddProviderType('smtp')}
                  className="bg-gray-600 hover:bg-gray-500 p-6 rounded-lg transition-colors text-center"
                >
                  <Mail className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <div className="text-white font-medium">SMTP</div>
                  <div className="text-gray-300 text-sm mt-1">Custom Email Server</div>
                </button>
              </div>
            ) : addProviderType === 'smtp' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                  <input
                    type="email"
                    value={smtpForm.email_address}
                    onChange={(e) => setSmtpForm({ ...smtpForm, email_address: e.target.value })}
                    placeholder="your-email@domain.com"
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">SMTP Host</label>
                    <input
                      type="text"
                      value={smtpForm.smtp_host}
                      onChange={(e) => setSmtpForm({ ...smtpForm, smtp_host: e.target.value })}
                      placeholder="smtp.gmail.com"
                      className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Port</label>
                    <input
                      type="number"
                      value={smtpForm.smtp_port}
                      onChange={(e) => setSmtpForm({ ...smtpForm, smtp_port: e.target.value })}
                      placeholder="587"
                      className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Username</label>
                    <input
                      type="text"
                      value={smtpForm.smtp_username}
                      onChange={(e) => setSmtpForm({ ...smtpForm, smtp_username: e.target.value })}
                      placeholder="Email username"
                      className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                    <input
                      type="password"
                      value={smtpForm.smtp_password}
                      onChange={(e) => setSmtpForm({ ...smtpForm, smtp_password: e.target.value })}
                      placeholder="App password"
                      className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-6">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={smtpForm.smtp_use_tls}
                      onChange={(e) => setSmtpForm({ ...smtpForm, smtp_use_tls: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-gray-300">Use TLS</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={smtpForm.smtp_use_ssl}
                      onChange={(e) => setSmtpForm({ ...smtpForm, smtp_use_ssl: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-gray-300">Use SSL</span>
                  </label>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => {
                      setAddProviderType(null);
                      setSmtpForm({
                        email_address: '',
                        smtp_host: '',
                        smtp_port: '587',
                        smtp_username: '',
                        smtp_password: '',
                        smtp_use_tls: true,
                        smtp_use_ssl: false,
                      });
                    }}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addSMTPProvider}
                    disabled={
                      isConnecting ||
                      !smtpForm.email_address ||
                      !smtpForm.smtp_host ||
                      !smtpForm.smtp_port ||
                      !smtpForm.smtp_username ||
                      !smtpForm.smtp_password
                    }
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    {isConnecting ? 'Adding...' : 'Add SMTP Account'}
                  </button>
                </div>
              </div>
            ) : null}
        </div>

        {/* Info Section */}
        <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="text-blue-400 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-gray-300">
              <p className="font-medium text-white mb-1">Email Account Usage</p>
              <ul className="list-disc list-inside space-y-1 text-gray-400">
                <li>Connected accounts can be used for cold email campaigns</li>
                <li>You can add multiple accounts for better deliverability and rotation</li>
                <li>OAuth (Google/Microsoft) is more secure than SMTP credentials</li>
                <li>SMTP accounts require app-specific passwords for Gmail</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Close Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailProvidersModal;
