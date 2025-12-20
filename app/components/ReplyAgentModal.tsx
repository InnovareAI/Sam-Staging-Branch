'use client';

import React, { useState, useEffect } from 'react';
import { X, MessageCircle, Save, Loader2, Mail, CheckCircle, AlertCircle } from 'lucide-react';
import { createClient } from '@/app/lib/supabase';

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
    ai_model: 'claude-opus-4-5-20251101',
    reply_guidelines: `## BEFORE RESPONDING - RESEARCH FIRST

1. **LinkedIn Profile**: Review their role, experience, recent posts
2. **Company LinkedIn**: Check company size, industry, recent updates
3. **Website**: Understand their product/service offering
4. **Product Match**: Identify which SAM features solve their specific pain points

## RESPONSE APPROACH

- Reference something specific from your research (shows you did homework)
- Match SAM benefits to their industry/role challenges
- Keep it short (2-4 sentences max)
- One clear CTA

## INTENT HANDLING

| Intent | Strategy |
|--------|----------|
| INTERESTED | Book the call, don't oversell |
| QUESTION | Answer directly, then pivot to call |
| OBJECTION | Acknowledge, reframe with research insight |
| TIMING | Respect it, offer follow-up |
| NOT INTERESTED | Exit gracefully |

## TONE: {{tone_setting}}

Sound human, not templated. No "just checking in" or "thanks so much for getting back!"`,
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
      const supabase = createClient();

      // Get the current user's email
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email || null;

      // Load reply agent config from the correct table
      const { data, error } = await supabase
        .from('reply_agent_settings')
        .select('*')
        .eq('workspace_id', workspaceId)
        .single();

      if (data) {
        // Map backend fields to frontend state
        setConfig(prev => ({
          ...prev,
          enabled: data.enabled ?? false,
          approval_mode: (data.approval_mode as 'auto' | 'manual') || 'manual',
          // Backend uses tone_of_voice, map to response_tone if it matches, else default
          response_tone: ['professional', 'friendly', 'casual', 'formal'].includes(data.tone_of_voice?.toLowerCase())
            ? data.tone_of_voice.toLowerCase()
            : 'professional',
          // Backend uses minutes, Frontend uses hours
          reply_delay_hours: data.reply_delay_minutes ? Math.round(data.reply_delay_minutes / 60) : 2,
          ai_model: data.ai_model || 'claude-opus-4-5-20251101',
          // Backend uses system_prompt_override for guidelines
          reply_guidelines: data.system_prompt_override || prev.reply_guidelines,
          // Use user's login email as connected email since we don't store it in settings
          connected_email: userEmail,
        }));
      } else {
        // No config exists yet, just use user's email
        setConfig(prev => ({ ...prev, connected_email: userEmail }));
      }
    } catch (error) {
      console.error('Failed to load reply agent config:', error);
      // Still try to get user email on error
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          setConfig(prev => ({ ...prev, connected_email: user.email }));
        }
      } catch { }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage('');

    try {
      const supabase = createClient();

      // Map frontend state to backend fields
      const updates = {
        workspace_id: workspaceId,
        enabled: config.enabled,
        approval_mode: config.approval_mode,
        // Backend expects specific string for tone_of_voice
        tone_of_voice: config.response_tone, // 'professional', 'friendly', etc.
        // Backend expects minutes
        reply_delay_minutes: config.reply_delay_hours * 60,
        ai_model: config.ai_model,
        // Backend uses system_prompt_override
        system_prompt_override: config.reply_guidelines,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('reply_agent_settings')
        .upsert(updates, {
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

              {/* Your Email Account */}
              <div className="p-4 bg-gray-700 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-white font-medium">Your Email Account</div>
                  <CheckCircle size={20} className="text-green-400" />
                </div>
                <div className="flex items-center space-x-2 text-gray-300">
                  <Mail size={16} />
                  <span className="text-sm">{config.connected_email || 'Loading...'}</span>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Replies will be sent from your account email address
                </p>
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
                  <option value="claude-opus-4-5-20251101">Claude Opus 4.5 (Recommended)</option>
                  <option value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5</option>
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
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[300px] font-mono text-sm"
                  placeholder="Enter guidelines for AI responses..."
                />
                <p className="mt-1 text-xs text-gray-400">
                  Instructions the AI will follow when generating replies
                </p>
              </div>

            </>
          )}
        </div>

        {/* Footer - Always visible Save and Close buttons */}
        <div className="p-6 border-t border-gray-700 space-y-3">
          {saveMessage && (
            <p className={`text-sm text-center ${saveMessage.startsWith('✓') ? 'text-green-400' : 'text-red-400'
              }`}>
              {saveMessage}
            </p>
          )}
          <button
            onClick={handleSave}
            disabled={saving || loading}
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
