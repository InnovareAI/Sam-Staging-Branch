'use client';

import React, { useState } from 'react';
import { Clock, Calendar, Globe, AlertCircle, X } from 'lucide-react';
import { toastSuccess, toastError } from '@/lib/toast';

interface CampaignScheduleSettings {
  timezone: string;
  working_hours_start: number;
  working_hours_end: number;
  skip_weekends: boolean;
  skip_holidays: boolean;
  country_code: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  campaignId?: string;
  currentSettings?: Partial<CampaignScheduleSettings>;
}

// Common timezones
const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
];

// Countries with holiday calendars (sorted alphabetically by label)
const COUNTRIES = [
  { value: 'AT', label: 'Austria' },
  { value: 'AU', label: 'Australia' },
  { value: 'BE', label: 'Belgium' },
  { value: 'BR', label: 'Brazil' },
  { value: 'CA', label: 'Canada' },
  { value: 'CN', label: 'China' },
  { value: 'DK', label: 'Denmark' },
  { value: 'FI', label: 'Finland' },
  { value: 'FR', label: 'France' },
  { value: 'DE', label: 'Germany' },
  { value: 'GR', label: 'Greece' },
  { value: 'IS', label: 'Iceland' },
  { value: 'IN', label: 'India' },
  { value: 'IE', label: 'Ireland' },
  { value: 'IT', label: 'Italy' },
  { value: 'JP', label: 'Japan' },
  { value: 'MX', label: 'Mexico' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'NZ', label: 'New Zealand' },
  { value: 'NO', label: 'Norway' },
  { value: 'PL', label: 'Poland' },
  { value: 'PT', label: 'Portugal' },
  { value: 'SG', label: 'Singapore' },
  { value: 'ZA', label: 'South Africa' },
  { value: 'KR', label: 'South Korea' },
  { value: 'ES', label: 'Spain' },
  { value: 'SE', label: 'Sweden' },
  { value: 'CH', label: 'Switzerland' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'US', label: 'United States' },
  { value: 'INTL', label: 'International (minimal)' },
];

export default function CampaignScheduleSettingsModal({ isOpen, onClose, campaignId, currentSettings }: Props) {
  const [settings, setSettings] = useState<CampaignScheduleSettings>({
    timezone: 'America/Los_Angeles',
    working_hours_start: 5,
    working_hours_end: 18,
    skip_weekends: true,
    skip_holidays: true,
    country_code: 'US',
    ...currentSettings
  });

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      toastSuccess('Campaign schedule settings saved');
      onClose();
    } catch (error) {
      console.error('Error saving settings:', error);
      toastError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-lg max-w-[500px] w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Campaign Schedule Settings
              </h3>
              <p className="text-gray-400 text-sm mt-1">
                Configure when your campaign messages are sent. All times are converted to your selected timezone.
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Timezone Selector */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
              <Globe className="h-4 w-4" />
              Timezone
            </label>
            <select
              value={settings.timezone}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400">
              Campaign messages will be sent according to this timezone
            </p>
          </div>

          {/* Working Hours */}
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
              <Clock className="h-4 w-4" />
              Working Hours
            </label>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Start Time</label>
                <select
                  value={settings.working_hours_start.toString()}
                  onChange={(e) => setSettings({ ...settings, working_hours_start: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i.toString()}>
                      {i.toString().padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-400">End Time</label>
                <select
                  value={settings.working_hours_end.toString()}
                  onChange={(e) => setSettings({ ...settings, working_hours_end: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i.toString()}>
                      {i.toString().padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="text-xs text-gray-400">
              Messages will only be sent between {settings.working_hours_start}:00 and {settings.working_hours_end}:00
            </p>
          </div>

          {/* Skip Weekends */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                  <Calendar className="h-4 w-4" />
                  Skip Weekends
                </label>
                <p className="text-xs text-gray-400">
                  Don't send messages on Saturday and Sunday
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.skip_weekends}
                onClick={() => setSettings({ ...settings, skip_weekends: !settings.skip_weekends })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.skip_weekends ? 'bg-purple-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.skip_weekends ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Warning when skip_weekends is disabled */}
            {!settings.skip_weekends && (
              <div className="flex items-start gap-2 p-3 bg-red-900/20 border border-red-500/50 rounded">
                <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-red-200">
                  <strong>Warning:</strong> Sending messages on weekends may appear unnatural and could flag your LinkedIn account. Only change this if you are 100% confident in what you are doing. Use at your own risk.
                </div>
              </div>
            )}
          </div>

          {/* Skip Holidays */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                  <Calendar className="h-4 w-4" />
                  Skip Public Holidays
                </label>
                <p className="text-xs text-gray-400">
                  Don't send messages on public holidays
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.skip_holidays}
                onClick={() => setSettings({ ...settings, skip_holidays: !settings.skip_holidays })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.skip_holidays ? 'bg-purple-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.skip_holidays ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Warning when skip_holidays is disabled */}
            {!settings.skip_holidays && (
              <div className="flex items-start gap-2 p-3 bg-red-900/20 border border-red-500/50 rounded">
                <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-red-200">
                  <strong>Warning:</strong> Sending messages on holidays may appear unnatural and could flag your LinkedIn account. Only change this if you are 100% confident in what you are doing. Use at your own risk.
                </div>
              </div>
            )}

            {settings.skip_holidays && (
              <div className="space-y-2 ml-6">
                <label className="text-sm text-gray-400">Holiday Calendar</label>
                <select
                  value={settings.country_code}
                  onChange={(e) => setSettings({ ...settings, country_code: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {COUNTRIES.map((country) => (
                    <option key={country.value} value={country.value}>
                      {country.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="flex items-start gap-2 p-3 bg-blue-900/20 border border-blue-500/30 rounded">
            <AlertCircle className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-200">
              <strong>Note:</strong> If a scheduled message falls outside these hours/days,
              it will be automatically rescheduled to the next available time.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
