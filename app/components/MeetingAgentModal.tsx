'use client';

import React, { useState, useEffect } from 'react';
import { X, Calendar, Save, Loader2, Clock, Bell, UserX, CheckCircle, AlertCircle } from 'lucide-react';
import { createClient } from '@/app/lib/supabase';

interface MeetingAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
}

interface MeetingAgentConfig {
  enabled: boolean;
  auto_book: boolean;
  approval_mode: 'auto' | 'manual';
  reminder_24h_enabled: boolean;
  reminder_1h_enabled: boolean;
  reminder_15m_enabled: boolean;
  no_show_detection_enabled: boolean;
  no_show_grace_period_minutes: number;
  max_reschedule_attempts: number;
  default_meeting_duration: number;
  ai_model: string;
  follow_up_guidelines: string;
}

interface MeetingStats {
  scheduled: number;
  completed: number;
  no_shows: number;
  pending_follow_ups: number;
}

export default function MeetingAgentModal({ isOpen, onClose, workspaceId }: MeetingAgentModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [stats, setStats] = useState<MeetingStats>({ scheduled: 0, completed: 0, no_shows: 0, pending_follow_ups: 0 });
  const [config, setConfig] = useState<MeetingAgentConfig>({
    enabled: true,
    auto_book: false,
    approval_mode: 'manual',
    reminder_24h_enabled: true,
    reminder_1h_enabled: true,
    reminder_15m_enabled: true,
    no_show_detection_enabled: true,
    no_show_grace_period_minutes: 15,
    max_reschedule_attempts: 3,
    default_meeting_duration: 30,
    ai_model: 'claude-sonnet-4-5-20250929',
    follow_up_guidelines: `## MEETING FOLLOW-UP GUIDELINES

### No-Show Follow-Up
- Acknowledge the missed meeting without blame
- Express genuine interest in rescheduling
- Offer 2-3 alternative times
- Keep it brief and understanding

### Post-Meeting Follow-Up
- Thank them for their time
- Summarize key discussion points
- Outline agreed next steps
- Include any promised materials/links

### Cancellation Follow-Up
- Acknowledge the cancellation professionally
- Express understanding
- Offer to reschedule when convenient
- Keep the door open

### Tone Guidelines
- Professional but warm
- Respectful of their time
- No guilt-tripping or pressure
- Clear call-to-action`,
  });

  useEffect(() => {
    if (isOpen) {
      loadConfig();
      loadStats();
    }
  }, [isOpen, workspaceId]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('workspace_meeting_agent_config')
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
      console.error('Failed to load meeting agent config:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      // Get meeting counts
      const [scheduled, completed, noShows, pendingFollowUps] = await Promise.all([
        supabase
          .from('meetings')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .eq('status', 'scheduled'),
        supabase
          .from('meetings')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .eq('status', 'completed'),
        supabase
          .from('meetings')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .eq('status', 'no_show'),
        supabase
          .from('meeting_follow_up_drafts')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .eq('status', 'pending_approval'),
      ]);

      setStats({
        scheduled: scheduled.count || 0,
        completed: completed.count || 0,
        no_shows: noShows.count || 0,
        pending_follow_ups: pendingFollowUps.count || 0,
      });
    } catch (error) {
      console.error('Failed to load meeting stats:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage('');

    try {
      const { error } = await supabase
        .from('workspace_meeting_agent_config')
        .upsert({
          workspace_id: workspaceId,
          ...config,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'workspace_id'
        });

      if (error) throw error;

      setSaveMessage('✓ Meeting Agent configuration saved successfully');
      setTimeout(() => {
        setSaveMessage('');
      }, 3000);
    } catch (error) {
      console.error('Failed to save meeting agent config:', error);
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
            <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
              <Calendar size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Meeting Agent Configuration</h2>
              <p className="text-gray-400 text-sm">Automate booking, reminders, and follow-ups</p>
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
              <Loader2 size={32} className="animate-spin text-purple-500" />
            </div>
          ) : (
            <>
              {/* Stats Overview */}
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 bg-gray-700 rounded-lg text-center">
                  <div className="text-2xl font-semibold text-white">{stats.scheduled}</div>
                  <div className="text-gray-400 text-sm">Scheduled</div>
                </div>
                <div className="p-4 bg-gray-700 rounded-lg text-center">
                  <div className="text-2xl font-semibold text-green-400">{stats.completed}</div>
                  <div className="text-gray-400 text-sm">Completed</div>
                </div>
                <div className="p-4 bg-gray-700 rounded-lg text-center">
                  <div className="text-2xl font-semibold text-red-400">{stats.no_shows}</div>
                  <div className="text-gray-400 text-sm">No-Shows</div>
                </div>
                <div className="p-4 bg-gray-700 rounded-lg text-center">
                  <div className="text-2xl font-semibold text-yellow-400">{stats.pending_follow_ups}</div>
                  <div className="text-gray-400 text-sm">Pending</div>
                </div>
              </div>

              {/* Pending Follow-ups Alert */}
              {stats.pending_follow_ups > 0 && (
                <div className="flex items-center justify-between p-4 bg-yellow-600/20 border border-yellow-600/50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Clock size={20} className="text-yellow-400" />
                    <div>
                      <div className="text-white font-medium">{stats.pending_follow_ups} follow-ups awaiting approval</div>
                      <div className="text-gray-400 text-sm">Review no-show and post-meeting follow-ups</div>
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
                  <div className="text-white font-medium">Enable Meeting Agent</div>
                  <div className="text-gray-400 text-sm">Detect booking links, schedule reminders, handle follow-ups</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {/* Auto-Book Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                <div>
                  <div className="text-white font-medium">Auto-Book Meetings</div>
                  <div className="text-gray-400 text-sm">Automatically book the first available slot when a prospect shares their calendar link</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.auto_book}
                    onChange={(e) => setConfig({ ...config, auto_book: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {/* Approval Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Follow-Up Approval Mode
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
                      <div className="text-gray-400 text-sm">Review AI-generated follow-ups before sending</div>
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
                      <div className="text-gray-400 text-sm">AI sends follow-ups automatically (reminders always auto-send)</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Reminder Settings */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  <Bell size={16} className="inline mr-2" />
                  Reminder Settings
                </label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                    <span className="text-white">24-hour reminder</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.reminder_24h_enabled}
                        onChange={(e) => setConfig({ ...config, reminder_24h_enabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                    <span className="text-white">1-hour reminder</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.reminder_1h_enabled}
                        onChange={(e) => setConfig({ ...config, reminder_1h_enabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                    <span className="text-white">15-minute reminder</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.reminder_15m_enabled}
                        onChange={(e) => setConfig({ ...config, reminder_15m_enabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* No-Show Settings */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  <UserX size={16} className="inline mr-2" />
                  No-Show Detection
                </label>
                <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg mb-3">
                  <span className="text-white">Enable no-show detection</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.no_show_detection_enabled}
                      onChange={(e) => setConfig({ ...config, no_show_detection_enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Grace period (minutes after scheduled time)</label>
                  <select
                    value={config.no_show_grace_period_minutes}
                    onChange={(e) => setConfig({ ...config, no_show_grace_period_minutes: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value={5}>5 minutes</option>
                    <option value={10}>10 minutes</option>
                    <option value={15}>15 minutes (Recommended)</option>
                    <option value={30}>30 minutes</option>
                  </select>
                </div>
              </div>

              {/* Max Reschedule Attempts */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Maximum Reschedule Attempts
                </label>
                <select
                  value={config.max_reschedule_attempts}
                  onChange={(e) => setConfig({ ...config, max_reschedule_attempts: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value={1}>1 attempt</option>
                  <option value={2}>2 attempts</option>
                  <option value={3}>3 attempts (Recommended)</option>
                  <option value={4}>4 attempts</option>
                  <option value={5}>5 attempts</option>
                </select>
                <p className="mt-1 text-xs text-gray-400">
                  Number of times to offer rescheduling after a no-show or cancellation
                </p>
              </div>

              {/* AI Model */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  AI Model for Follow-Ups
                </label>
                <select
                  value={config.ai_model}
                  onChange={(e) => setConfig({ ...config, ai_model: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent min-h-[250px] font-mono text-sm"
                  placeholder="Enter guidelines for meeting follow-ups..."
                />
                <p className="mt-1 text-xs text-gray-400">
                  Instructions the AI will follow when generating meeting follow-up messages
                </p>
              </div>

              {/* Supported Platforms */}
              <div className="p-4 bg-purple-600/10 border border-purple-600/30 rounded-lg">
                <div className="flex items-start space-x-3">
                  <Calendar size={20} className="text-purple-400 mt-0.5" />
                  <div>
                    <div className="text-white font-medium mb-1">Supported Booking Platforms</div>
                    <div className="text-gray-400 text-sm">
                      The Meeting Agent automatically detects and handles these booking links:
                    </div>
                    <ul className="mt-2 text-sm text-gray-400 space-y-1">
                      <li>• <strong>Calendly</strong> - Full support (scraping + booking)</li>
                      <li>• <strong>Cal.com</strong> - Full support (scraping + booking)</li>
                      <li>• <strong>HubSpot Meetings</strong> - Detection only</li>
                      <li>• <strong>Google Calendar</strong> - Detection only</li>
                      <li>• <strong>Microsoft Bookings</strong> - Detection only</li>
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
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
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
