'use client';

import React, { useState, useEffect } from 'react';
import { X, Send, Save, Loader2, CheckCircle, Clock, Zap } from 'lucide-react';
import { createClient } from '@/app/lib/supabase';

interface FollowUpAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
}

interface FollowUpAgentConfig {
  enabled: boolean;
  approval_mode: 'auto' | 'manual';
  max_touches: number;
  default_channel: 'linkedin' | 'email' | 'auto';
  business_hours_only: boolean;
  ai_model: string;
  follow_up_guidelines: string;
}

export default function FollowUpAgentModal({ isOpen, onClose, workspaceId }: FollowUpAgentModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [pendingDrafts, setPendingDrafts] = useState(0);
  const [config, setConfig] = useState<FollowUpAgentConfig>({
    enabled: true,
    approval_mode: 'manual',
    max_touches: 4,
    default_channel: 'linkedin',
    business_hours_only: true,
    ai_model: 'claude-sonnet-4-5-20250929',
    follow_up_guidelines: `## RE-ENGAGEMENT STRATEGY

### When to Trigger
- Prospect replied but then went silent (3+ days)
- No-show to scheduled call
- Post-demo silence
- Said "check back later" and date arrived

### Tone Guidelines
- Acknowledge the silence without guilt-tripping
- Reference previous conversation context
- Provide fresh value or different angle
- One clear, easy CTA

### Message Guidelines
- Keep it short (2-4 sentences)
- Sound human, not templated
- Don't repeat previous messages
- Graceful exit on final touch`,
  });

  useEffect(() => {
    if (isOpen) {
      loadConfig();
      loadPendingDrafts();
    }
  }, [isOpen, workspaceId]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('workspace_follow_up_agent_config')
        .select('*')
        .eq('workspace_id', workspaceId)
        .single();

      if (data) {
        setConfig(prev => ({
          ...prev,
          ...data,
        }));
      }
    } catch (error) {
      console.error('Failed to load follow-up agent config:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingDrafts = async () => {
    try {
      const supabase = createClient();
      const { count } = await supabase
        .from('follow_up_drafts')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('status', 'pending_approval');

      setPendingDrafts(count || 0);
    } catch (error) {
      console.error('Failed to load pending drafts:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage('');

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from('workspace_follow_up_agent_config')
        .upsert({
          workspace_id: workspaceId,
          enabled: config.enabled,
          approval_mode: config.approval_mode,
          max_touches: config.max_touches,
          default_channel: config.default_channel,
          business_hours_only: config.business_hours_only,
          ai_model: config.ai_model,
          follow_up_guidelines: config.follow_up_guidelines,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'workspace_id'
        });

      if (error) throw error;

      setSaveMessage('✓ Follow-Up Agent configuration saved successfully');
      setTimeout(() => {
        setSaveMessage('');
      }, 3000);
    } catch (error) {
      console.error('Failed to save follow-up agent config:', error);
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
            <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
              <Send size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Follow-Up Agent Configuration</h2>
              <p className="text-gray-400 text-sm">Automated follow-ups based on prospect behavior</p>
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
              <Loader2 size={32} className="animate-spin text-green-500" />
            </div>
          ) : (
            <>
              {/* Pending Drafts Alert */}
              {pendingDrafts > 0 && (
                <div className="flex items-center justify-between p-4 bg-yellow-600/20 border border-yellow-600/50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Clock size={20} className="text-yellow-400" />
                    <div>
                      <div className="text-white font-medium">{pendingDrafts} drafts awaiting approval</div>
                      <div className="text-gray-400 text-sm">Review and approve follow-up messages</div>
                    </div>
                  </div>
                  <button className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded-lg transition-colors">
                    Review
                  </button>
                </div>
              )}

              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                <div>
                  <div className="text-white font-medium">Enable Follow-Up Agent</div>
                  <div className="text-gray-400 text-sm">Automatically generate follow-up messages for prospects</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                </label>
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
                      <div className="text-gray-400 text-sm">Review and approve each AI-generated follow-up before sending</div>
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
                      <div className="text-gray-400 text-sm">AI sends follow-ups automatically without review</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Max Touches */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Maximum Follow-Up Touches
                </label>
                <select
                  value={config.max_touches}
                  onChange={(e) => setConfig({ ...config, max_touches: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value={2}>2 touches</option>
                  <option value={3}>3 touches</option>
                  <option value={4}>4 touches (Recommended)</option>
                  <option value={5}>5 touches</option>
                  <option value={6}>6 touches</option>
                  <option value={7}>7 touches</option>
                  <option value={8}>8 touches</option>
                  <option value={9}>9 touches</option>
                  <option value={10}>10 touches</option>
                </select>
                <p className="mt-1 text-xs text-gray-400">
                  Number of follow-up attempts before stopping outreach
                </p>
              </div>

              {/* Default Channel */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Default Channel
                </label>
                <select
                  value={config.default_channel}
                  onChange={(e) => setConfig({ ...config, default_channel: e.target.value as any })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="linkedin">LinkedIn DM</option>
                  <option value="email">Email</option>
                  <option value="auto">Auto (LinkedIn first, then email)</option>
                </select>
              </div>

              {/* Business Hours */}
              <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                <div>
                  <div className="text-white font-medium">Business Hours Only</div>
                  <div className="text-gray-400 text-sm">Only send follow-ups during business hours (9 AM - 6 PM)</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.business_hours_only}
                    onChange={(e) => setConfig({ ...config, business_hours_only: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                </label>
              </div>

              {/* AI Model */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  AI Model
                </label>
                <select
                  value={config.ai_model}
                  onChange={(e) => setConfig({ ...config, ai_model: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5 (Recommended)</option>
                  <option value="claude-opus-4-5-20251101">Claude Opus 4.5</option>
                  <option value="claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                  <option value="gpt-4">GPT-4</option>
                </select>
              </div>

              {/* Follow-Up Guidelines */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Follow-Up Guidelines
                </label>
                <textarea
                  value={config.follow_up_guidelines}
                  onChange={(e) => setConfig({ ...config, follow_up_guidelines: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent min-h-[300px] font-mono text-sm"
                  placeholder="Enter guidelines for AI follow-ups..."
                />
                <p className="mt-1 text-xs text-gray-400">
                  Instructions the AI will follow when generating follow-up messages
                </p>
              </div>

              {/* Scenario Info */}
              <div className="p-4 bg-green-600/10 border border-green-600/30 rounded-lg">
                <div className="flex items-start space-x-3">
                  <Zap size={20} className="text-green-400 mt-0.5" />
                  <div>
                    <div className="text-white font-medium mb-1">Re-Engagement Scenarios</div>
                    <div className="text-gray-400 text-sm">
                      The Follow-Up Agent handles prospects who need re-engagement:
                    </div>
                    <ul className="mt-2 text-sm text-gray-400 space-y-1">
                      <li>• <strong>Replied Then Silent</strong> - Was engaged but went quiet</li>
                      <li>• <strong>No Show to Call</strong> - Missed scheduled meeting</li>
                      <li>• <strong>Post-Demo Silence</strong> - Attended demo but not responding</li>
                      <li>• <strong>Check Back Later</strong> - Asked to follow up at specific date</li>
                    </ul>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 space-y-3">
          {saveMessage && (
            <p className={`text-sm text-center ${
              saveMessage.startsWith('✓') ? 'text-green-400' : 'text-red-400'
            }`}>
              {saveMessage}
            </p>
          )}
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
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
