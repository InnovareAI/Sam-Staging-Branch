'use client';

import React, { useState, useEffect } from 'react';
import { X, MessageCircle, Save, Loader2, Mail, CheckCircle, AlertCircle } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface ReplyAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
}

interface ReplyAgentConfig {
  enabled: boolean;
  approval_mode: 'auto' | 'manual';
  response_tone: 'professional' | 'friendly' | 'casual' | 'formal';
  reply_delay_hours: number;
  ai_model: string;
  reply_guidelines: string;
  connected_email: string | null;
}

export default function ReplyAgentModal({ isOpen, onClose, workspaceId }: ReplyAgentModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [config, setConfig] = useState<ReplyAgentConfig>({
    enabled: false,
    approval_mode: 'manual',
    response_tone: 'professional',
    reply_delay_hours: 2,
    ai_model: 'claude-3.5-sonnet',
    reply_guidelines: 'Always be professional and helpful. Reference our product benefits when relevant. Ask qualifying questions to understand prospect needs.',
    connected_email: null,
  });

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen, workspaceId]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const supabase = createClientComponentClient();

      // Load reply agent config
      const { data, error } = await supabase
        .from('workspace_reply_agent_config')
        .select('*')
        .eq('workspace_id', workspaceId)
        .single();

      if (data) {
        setConfig(data);
      }

      // Check for connected email accounts
      const { data: emailAccounts } = await supabase
        .from('user_unipile_accounts')
        .select('account_email, provider')
        .eq('workspace_id', workspaceId)
        .in('provider', ['GMAIL', 'OUTLOOK'])
        .limit(1)
        .single();

      if (emailAccounts) {
        setConfig(prev => ({ ...prev, connected_email: emailAccounts.account_email }));
      }
    } catch (error) {
      console.error('Failed to load reply agent config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage('');

    try {
      const supabase = createClientComponentClient();

      const { error } = await supabase
        .from('workspace_reply_agent_config')
        .upsert({
          workspace_id: workspaceId,
          enabled: config.enabled,
          approval_mode: config.approval_mode,
          response_tone: config.response_tone,
          reply_delay_hours: config.reply_delay_hours,
          ai_model: config.ai_model,
          reply_guidelines: config.reply_guidelines,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'workspace_id'
        });

      if (error) throw error;

      setSaveMessage('✓ Reply Agent configuration saved successfully');
      setTimeout(() => {
        setSaveMessage('');
      }, 3000);
    } catch (error) {
      console.error('Failed to save reply agent config:', error);
      setSaveMessage('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <MessageCircle size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Reply Agent Configuration</h2>
              <p className="text-gray-400 text-sm">Automated AI responses to prospect replies</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={32} className="animate-spin text-blue-500" />
            </div>
          ) : (
            <>
              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                <div>
                  <div className="text-white font-medium">Enable Reply Agent</div>
                  <div className="text-gray-400 text-sm">Automatically respond to prospect replies with AI</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Connected Email Status */}
              <div className="p-4 bg-gray-700 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-white font-medium">Connected Email Account</div>
                  {config.connected_email ? (
                    <CheckCircle size={20} className="text-green-400" />
                  ) : (
                    <AlertCircle size={20} className="text-yellow-400" />
                  )}
                </div>
                {config.connected_email ? (
                  <div className="flex items-center space-x-2 text-gray-300">
                    <Mail size={16} />
                    <span className="text-sm">{config.connected_email}</span>
                  </div>
                ) : (
                  <div className="text-gray-400 text-sm">
                    No email account connected. Configure email providers first.
                  </div>
                )}
              </div>

              {/* Approval Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Approval Mode
                </label>
                <div className="space-y-2">
                  <label className="flex items-start p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors">
                    <input
                      type="radio"
                      name="approval_mode"
                      value="manual"
                      checked={config.approval_mode === 'manual'}
                      onChange={(e) => setConfig({ ...config, approval_mode: e.target.value as 'auto' | 'manual' })}
                      className="mt-1 mr-3"
                    />
                    <div>
                      <div className="text-white font-medium">Manual Approval (HITL)</div>
                      <div className="text-gray-400 text-sm">Review and approve each AI-generated reply before sending</div>
                    </div>
                  </label>
                  <label className="flex items-start p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors">
                    <input
                      type="radio"
                      name="approval_mode"
                      value="auto"
                      checked={config.approval_mode === 'auto'}
                      onChange={(e) => setConfig({ ...config, approval_mode: e.target.value as 'auto' | 'manual' })}
                      className="mt-1 mr-3"
                    />
                    <div>
                      <div className="text-white font-medium">Automatic Sending</div>
                      <div className="text-gray-400 text-sm">AI sends replies automatically without review</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Response Tone */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Response Tone
                </label>
                <select
                  value={config.response_tone}
                  onChange={(e) => setConfig({ ...config, response_tone: e.target.value as any })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="casual">Casual</option>
                  <option value="formal">Formal</option>
                </select>
              </div>

              {/* Reply Delay */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Reply Delay (hours)
                </label>
                <input
                  type="number"
                  min="0"
                  max="72"
                  value={config.reply_delay_hours}
                  onChange={(e) => setConfig({ ...config, reply_delay_hours: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="2"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Natural response time. Set to 0 for instant replies.
                </p>
              </div>

              {/* AI Model */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  AI Model
                </label>
                <select
                  value={config.ai_model}
                  onChange={(e) => setConfig({ ...config, ai_model: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                  <option value="gpt-4">GPT-4</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
              </div>

              {/* Reply Guidelines */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Reply Guidelines
                </label>
                <textarea
                  value={config.reply_guidelines}
                  onChange={(e) => setConfig({ ...config, reply_guidelines: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[120px]"
                  placeholder="Enter guidelines for AI responses..."
                />
                <p className="mt-1 text-xs text-gray-400">
                  Instructions the AI will follow when generating replies
                </p>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSave}
                disabled={saving || !config.connected_email}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>Save Configuration</span>
                  </>
                )}
              </button>

              {saveMessage && (
                <p className={`text-sm text-center ${
                  saveMessage.startsWith('✓') ? 'text-green-400' : 'text-red-400'
                }`}>
                  {saveMessage}
                </p>
              )}

              {!config.connected_email && (
                <div className="p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <AlertCircle size={20} className="text-yellow-400 mt-0.5" />
                    <div className="text-yellow-200 text-sm">
                      Please connect an email account in <strong>Email Providers</strong> before enabling the Reply Agent.
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700">
          <button
            onClick={onClose}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
