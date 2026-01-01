'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2, Save, Linkedin, Mail, Settings2, TrendingUp, Users, MessageSquare, UserPlus, Calendar, Smartphone } from 'lucide-react';
import { createClient } from '@/app/lib/supabase';

interface AccountLimitsModalProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
}

interface WarmupSettings {
  enabled: boolean;
  start_limit: number;
  end_limit: number;
  increase_by: number;
  step_length_days: number;
}

interface LinkedInLimits {
  warmup: WarmupSettings;
  daily_limits: {
    connection_requests: number;
    follow_up_messages: number;
    inmails: number;
    company_follows: number;
    event_invites: number;
  };
  range_limits: {
    connection_requests: { min: number; max: number };
    messages: { min: number; max: number };
    inmails: { min: number; max: number };
  };
  settings: {
    delete_pending_requests_after_days: number;
    capitalize_names: boolean;
    adjust_hourly_limits: boolean;
    send_without_connector_message: boolean;
  };
}

interface EmailLimits {
  warmup: WarmupSettings;
  daily_limits: {
    emails_per_day: number;
    emails_per_hour: number;
  };
}

interface AccountLimitsSettings {
  linkedin: LinkedInLimits;
  email: EmailLimits;
}

const defaultSettings: AccountLimitsSettings = {
  linkedin: {
    warmup: {
      enabled: true,
      start_limit: 5,
      end_limit: 25,
      increase_by: 2,
      step_length_days: 3,
    },
    daily_limits: {
      connection_requests: 20,
      follow_up_messages: 50,
      inmails: 10,
      company_follows: 10,
      event_invites: 10,
    },
    range_limits: {
      connection_requests: { min: 10, max: 30 },
      messages: { min: 20, max: 100 },
      inmails: { min: 5, max: 20 },
    },
    settings: {
      delete_pending_requests_after_days: 14,
      capitalize_names: true,
      adjust_hourly_limits: true,
      send_without_connector_message: false,
    },
  },
  email: {
    warmup: {
      enabled: true,
      start_limit: 10,
      end_limit: 100,
      increase_by: 10,
      step_length_days: 7,
    },
    daily_limits: {
      emails_per_day: 100,
      emails_per_hour: 20,
    },
  },
};

export default function AccountLimitsModal({
  workspaceId,
  isOpen,
  onClose,
  onSave
}: AccountLimitsModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'linkedin' | 'email'>('linkedin');
  const [settings, setSettings] = useState<AccountLimitsSettings>(defaultSettings);

  useEffect(() => {
    if (isOpen && workspaceId) {
      loadSettings();
    }
  }, [isOpen, workspaceId]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('workspace_account_limits')
        .select('*')
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (data) {
        setSettings({
          linkedin: data.linkedin_limits || defaultSettings.linkedin,
          email: data.email_limits || defaultSettings.email,
        });
      }
    } catch (error) {
      console.error('Failed to load account limits:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('workspace_account_limits')
        .upsert({
          workspace_id: workspaceId,
          linkedin_limits: settings.linkedin,
          email_limits: settings.email,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'workspace_id'
        });

      if (error) throw error;

      onSave?.();
      onClose();
    } catch (error) {
      console.error('Failed to save account limits:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateLinkedInWarmup = (field: keyof WarmupSettings, value: number | boolean) => {
    setSettings(prev => ({
      ...prev,
      linkedin: {
        ...prev.linkedin,
        warmup: { ...prev.linkedin.warmup, [field]: value },
      },
    }));
  };

  const updateLinkedInDailyLimit = (field: keyof LinkedInLimits['daily_limits'], value: number) => {
    setSettings(prev => ({
      ...prev,
      linkedin: {
        ...prev.linkedin,
        daily_limits: { ...prev.linkedin.daily_limits, [field]: value },
      },
    }));
  };

  const updateLinkedInSetting = (field: keyof LinkedInLimits['settings'], value: number | boolean) => {
    setSettings(prev => ({
      ...prev,
      linkedin: {
        ...prev.linkedin,
        settings: { ...prev.linkedin.settings, [field]: value },
      },
    }));
  };

  const updateEmailWarmup = (field: keyof WarmupSettings, value: number | boolean) => {
    setSettings(prev => ({
      ...prev,
      email: {
        ...prev.email,
        warmup: { ...prev.email.warmup, [field]: value },
      },
    }));
  };

  const updateEmailDailyLimit = (field: keyof EmailLimits['daily_limits'], value: number) => {
    setSettings(prev => ({
      ...prev,
      email: {
        ...prev.email,
        daily_limits: { ...prev.email.daily_limits, [field]: value },
      },
    }));
  };

  if (!isOpen) return null;

  const Toggle = ({
    checked,
    onChange,
    label,
    description
  }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
    description?: string;
  }) => (
    <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
      <div>
        <div className="text-white text-sm font-medium">{label}</div>
        {description && <div className="text-gray-400 text-xs">{description}</div>}
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
      </label>
    </div>
  );

  const NumberInput = ({
    label,
    value,
    onChange,
    min = 0,
    max = 1000,
    description,
    icon: Icon
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    min?: number;
    max?: number;
    description?: string;
    icon?: React.ElementType;
  }) => (
    <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
      <div className="flex items-center gap-3">
        {Icon && <Icon size={18} className="text-gray-400" />}
        <div>
          <div className="text-white text-sm font-medium">{label}</div>
          {description && <div className="text-gray-400 text-xs">{description}</div>}
        </div>
      </div>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, parseInt(e.target.value) || 0)))}
        min={min}
        max={max}
        className="w-20 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-pink-500"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-white">Account Limits</h2>
            <p className="text-sm text-gray-400 mt-1">
              Configure daily limits and warmup settings for your accounts
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveTab('linkedin')}
            className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors ${
              activeTab === 'linkedin'
                ? 'text-white border-b-2 border-pink-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Linkedin size={18} />
            LinkedIn Limits
          </button>
          <button
            onClick={() => setActiveTab('email')}
            className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors ${
              activeTab === 'email'
                ? 'text-white border-b-2 border-pink-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Mail size={18} />
            Email Limits
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-pink-500" />
          </div>
        ) : (
          <div className="overflow-y-auto max-h-[calc(90vh-220px)]">
            {/* LinkedIn Tab */}
            {activeTab === 'linkedin' && (
              <div className="p-6 space-y-6">
                {/* Warmup Section */}
                <div className="p-4 bg-blue-900/20 rounded-lg border border-blue-700/50">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp size={20} className="text-blue-400" />
                    <h3 className="text-lg font-medium text-white">Account Warmup</h3>
                  </div>

                  <Toggle
                    checked={settings.linkedin.warmup.enabled}
                    onChange={(v) => updateLinkedInWarmup('enabled', v)}
                    label="Enable Warmup"
                    description="Gradually increase limits to protect your account"
                  />

                  {settings.linkedin.warmup.enabled && (
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-sm text-gray-300 mb-2">Start Limit</label>
                        <input
                          type="number"
                          value={settings.linkedin.warmup.start_limit}
                          onChange={(e) => updateLinkedInWarmup('start_limit', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-pink-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-300 mb-2">End Limit</label>
                        <input
                          type="number"
                          value={settings.linkedin.warmup.end_limit}
                          onChange={(e) => updateLinkedInWarmup('end_limit', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-pink-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-300 mb-2">Increase By</label>
                        <input
                          type="number"
                          value={settings.linkedin.warmup.increase_by}
                          onChange={(e) => updateLinkedInWarmup('increase_by', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-pink-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-300 mb-2">Step Length (days)</label>
                        <input
                          type="number"
                          value={settings.linkedin.warmup.step_length_days}
                          onChange={(e) => updateLinkedInWarmup('step_length_days', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-pink-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Daily Limits Section */}
                <div className="p-4 bg-purple-900/20 rounded-lg border border-purple-700/50">
                  <div className="flex items-center gap-2 mb-4">
                    <Settings2 size={20} className="text-purple-400" />
                    <h3 className="text-lg font-medium text-white">Daily Limits</h3>
                  </div>

                  <div className="space-y-3">
                    <NumberInput
                      label="Connection Requests"
                      value={settings.linkedin.daily_limits.connection_requests}
                      onChange={(v) => updateLinkedInDailyLimit('connection_requests', v)}
                      max={100}
                      icon={UserPlus}
                      description="Max per day"
                    />
                    <NumberInput
                      label="Follow-up Messages"
                      value={settings.linkedin.daily_limits.follow_up_messages}
                      onChange={(v) => updateLinkedInDailyLimit('follow_up_messages', v)}
                      max={200}
                      icon={MessageSquare}
                      description="Max per day"
                    />
                    <NumberInput
                      label="InMails"
                      value={settings.linkedin.daily_limits.inmails}
                      onChange={(v) => updateLinkedInDailyLimit('inmails', v)}
                      max={50}
                      icon={Mail}
                      description="Max per day"
                    />
                    <NumberInput
                      label="Company Follows"
                      value={settings.linkedin.daily_limits.company_follows}
                      onChange={(v) => updateLinkedInDailyLimit('company_follows', v)}
                      max={50}
                      icon={Users}
                      description="Max per day"
                    />
                    <NumberInput
                      label="Event Invites"
                      value={settings.linkedin.daily_limits.event_invites}
                      onChange={(v) => updateLinkedInDailyLimit('event_invites', v)}
                      max={50}
                      icon={Calendar}
                      description="Max per day"
                    />
                  </div>
                </div>

                {/* Additional Settings */}
                <div className="p-4 bg-gray-700/30 rounded-lg border border-gray-600">
                  <div className="flex items-center gap-2 mb-4">
                    <Settings2 size={20} className="text-gray-400" />
                    <h3 className="text-lg font-medium text-white">Additional Settings</h3>
                  </div>

                  <div className="space-y-3">
                    <NumberInput
                      label="Delete pending requests after"
                      value={settings.linkedin.settings.delete_pending_requests_after_days}
                      onChange={(v) => updateLinkedInSetting('delete_pending_requests_after_days', v)}
                      min={7}
                      max={90}
                      description="days"
                    />
                    <Toggle
                      checked={settings.linkedin.settings.capitalize_names}
                      onChange={(v) => updateLinkedInSetting('capitalize_names', v)}
                      label="Capitalize names automatically"
                      description="Ensure proper name formatting in messages"
                    />
                    <Toggle
                      checked={settings.linkedin.settings.adjust_hourly_limits}
                      onChange={(v) => updateLinkedInSetting('adjust_hourly_limits', v)}
                      label="Adjust hourly limits automatically"
                      description="Spread activity naturally throughout the day"
                    />
                    <Toggle
                      checked={settings.linkedin.settings.send_without_connector_message}
                      onChange={(v) => updateLinkedInSetting('send_without_connector_message', v)}
                      label="Send without connector message"
                      description="Continue sending even when LinkedIn limits connector messages"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Email Tab */}
            {activeTab === 'email' && (
              <div className="p-6 space-y-6">
                {/* Email Warmup Section */}
                <div className="p-4 bg-green-900/20 rounded-lg border border-green-700/50">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp size={20} className="text-green-400" />
                    <h3 className="text-lg font-medium text-white">Email Warmup</h3>
                  </div>

                  <Toggle
                    checked={settings.email.warmup.enabled}
                    onChange={(v) => updateEmailWarmup('enabled', v)}
                    label="Enable Warmup"
                    description="Gradually increase email limits to build sender reputation"
                  />

                  {settings.email.warmup.enabled && (
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-sm text-gray-300 mb-2">Start Limit</label>
                        <input
                          type="number"
                          value={settings.email.warmup.start_limit}
                          onChange={(e) => updateEmailWarmup('start_limit', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-pink-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-300 mb-2">End Limit</label>
                        <input
                          type="number"
                          value={settings.email.warmup.end_limit}
                          onChange={(e) => updateEmailWarmup('end_limit', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-pink-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-300 mb-2">Increase By</label>
                        <input
                          type="number"
                          value={settings.email.warmup.increase_by}
                          onChange={(e) => updateEmailWarmup('increase_by', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-pink-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-300 mb-2">Step Length (days)</label>
                        <input
                          type="number"
                          value={settings.email.warmup.step_length_days}
                          onChange={(e) => updateEmailWarmup('step_length_days', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-pink-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Email Daily Limits */}
                <div className="p-4 bg-orange-900/20 rounded-lg border border-orange-700/50">
                  <div className="flex items-center gap-2 mb-4">
                    <Settings2 size={20} className="text-orange-400" />
                    <h3 className="text-lg font-medium text-white">Daily Limits</h3>
                  </div>

                  <div className="space-y-3">
                    <NumberInput
                      label="Emails per Day"
                      value={settings.email.daily_limits.emails_per_day}
                      onChange={(v) => updateEmailDailyLimit('emails_per_day', v)}
                      max={500}
                      icon={Mail}
                      description="Maximum emails sent per day"
                    />
                    <NumberInput
                      label="Emails per Hour"
                      value={settings.email.daily_limits.emails_per_hour}
                      onChange={(v) => updateEmailDailyLimit('emails_per_hour', v)}
                      max={100}
                      icon={Mail}
                      description="Maximum emails sent per hour"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-700 bg-gray-800/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={saveSettings}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-pink-600 hover:bg-pink-700 disabled:bg-pink-800 text-white rounded-lg transition-colors"
          >
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
