'use client';

import React, { useState, useEffect } from 'react';
import { Send, X, CheckCircle, AlertCircle, Loader2, ArrowLeft, Trash2, Key } from 'lucide-react';

interface ReachInboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
}

const ReachInboxModal: React.FC<ReachInboxModalProps> = ({ isOpen, onClose, workspaceId }) => {
  const [apiKey, setApiKey] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [apiKeyPreview, setApiKeyPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'warning', message: string } | null>(null);

  // Fetch ReachInbox configuration status
  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/workspace-settings/reachinbox', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.status === 401) {
        console.log('⚠️ ReachInbox settings: Authentication issue');
        setIsConfigured(false);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        console.error('ReachInbox settings API error:', response.status);
        setIsConfigured(false);
        setLoading(false);
        return;
      }

      const data = await response.json();
      console.log('📧 ReachInbox config response:', data);

      if (data.success) {
        setIsConfigured(data.configured);
        setApiKeyPreview(data.api_key_preview);
      } else {
        setIsConfigured(false);
      }
    } catch (error) {
      console.error('Error fetching ReachInbox config:', error);
      setIsConfigured(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
      setApiKey(''); // Reset form when modal opens
    }
  }, [isOpen]);

  const showNotification = (type: 'success' | 'error' | 'warning', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Save API key
  const saveApiKey = async () => {
    if (!apiKey.trim()) {
      showNotification('error', 'Please enter an API key');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/workspace-settings/reachinbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey.trim() }),
      });

      const data = await response.json();

      if (data.success) {
        if (data.warning) {
          showNotification('warning', data.warning);
        } else {
          showNotification('success', 'ReachInbox API key saved successfully');
        }
        setApiKey('');
        await fetchConfig();
      } else {
        throw new Error(data.error || 'Failed to save API key');
      }
    } catch (error) {
      console.error('Error saving ReachInbox API key:', error);
      showNotification('error', error instanceof Error ? error.message : 'Failed to save API key');
    } finally {
      setSaving(false);
    }
  };

  // Remove API key
  const removeApiKey = async () => {
    if (!confirm('Are you sure you want to remove the ReachInbox integration? This will disable the "Push to ReachInbox" feature for all campaigns.')) {
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/workspace-settings/reachinbox', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        showNotification('success', 'ReachInbox integration removed');
        await fetchConfig();
      } else {
        throw new Error(data.error || 'Failed to remove API key');
      }
    } catch (error) {
      console.error('Error removing ReachInbox API key:', error);
      showNotification('error', 'Failed to remove API key');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 border border-gray-600 max-h-[90vh] overflow-y-auto">
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
              <Send className="mr-3 text-pink-400" size={28} />
              ReachInbox Integration
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
              notification.type === 'success'
                ? 'bg-green-600 text-white'
                : notification.type === 'warning'
                ? 'bg-yellow-600 text-white'
                : 'bg-red-600 text-white'
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

        {/* Loading State */}
        {loading ? (
          <div className="bg-gray-700 rounded-lg p-8 text-center">
            <Loader2 className="animate-spin mx-auto mb-2 text-gray-400" size={24} />
            <p className="text-gray-400">Loading configuration...</p>
          </div>
        ) : (
          <>
            {/* Current Configuration Status */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-white mb-4">Configuration Status</h3>
              <div className={`rounded-lg p-4 flex items-center justify-between ${
                isConfigured ? 'bg-green-900 bg-opacity-30 border border-green-700' : 'bg-gray-700'
              }`}>
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${isConfigured ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                  <div>
                    <div className="text-white font-medium">
                      {isConfigured ? 'ReachInbox Connected' : 'Not Configured'}
                    </div>
                    {apiKeyPreview && (
                      <div className="text-sm text-gray-400 mt-1">
                        API Key: {apiKeyPreview}
                      </div>
                    )}
                  </div>
                </div>
                {isConfigured && (
                  <button
                    onClick={removeApiKey}
                    disabled={saving}
                    className="text-red-400 hover:text-red-300 transition-colors flex items-center gap-2"
                    title="Remove integration"
                  >
                    <Trash2 size={16} />
                    <span className="text-sm">Remove</span>
                  </button>
                )}
              </div>
            </div>

            {/* API Key Configuration */}
            <div className="bg-gray-700 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                <Key className="text-pink-400" size={20} />
                {isConfigured ? 'Update API Key' : 'Configure API Key'}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    ReachInbox API Key
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your ReachInbox API key"
                    className="w-full px-4 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500 focus:outline-none transition-colors"
                  />
                  <p className="mt-2 text-xs text-gray-400">
                    Find your API key in ReachInbox Settings → API & Integrations
                  </p>
                </div>

                <button
                  onClick={saveApiKey}
                  disabled={saving || !apiKey.trim()}
                  className="w-full bg-pink-600 hover:bg-pink-700 disabled:bg-pink-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      <span>{isConfigured ? 'Update API Key' : 'Save API Key'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Info Section */}
            <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="text-blue-400 flex-shrink-0 mt-0.5" size={20} />
                <div className="text-sm text-gray-300">
                  <p className="font-medium text-white mb-2">How to Use ReachInbox Integration</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-400">
                    <li>Configure your API key above to enable ReachInbox integration</li>
                    <li>Once configured, you can push email campaign leads to existing ReachInbox campaigns</li>
                    <li>Look for the "Push to ReachInbox" button in your email campaigns</li>
                    <li>ReachInbox and Unipile email are mutually exclusive - use one or the other</li>
                  </ul>
                  <p className="mt-3 text-xs">
                    <strong>Note:</strong> The API key is stored securely at the workspace level. Only workspace admins can configure integrations.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

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

export default ReachInboxModal;
