'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Clock, Calendar, Globe, AlertCircle } from 'lucide-react';
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

// Countries with holiday calendars
const COUNTRIES = [
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'CA', label: 'Canada' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'AU', label: 'Australia' },
  { value: 'JP', label: 'Japan' },
  { value: 'SG', label: 'Singapore' },
];

export default function CampaignScheduleSettingsModal({ isOpen, onClose, campaignId, currentSettings }: Props) {
  const [settings, setSettings] = useState<CampaignScheduleSettings>({
    timezone: 'America/New_York',
    working_hours_start: 7,  // 7 AM
    working_hours_end: 18,    // 6 PM
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-gray-800 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Campaign Schedule Settings
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Configure when your campaign messages are sent. All times are converted to your selected timezone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Timezone Selector */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Timezone
            </Label>
            <Select
              value={settings.timezone}
              onValueChange={(value) => setSettings({ ...settings, timezone: value })}
            >
              <SelectTrigger className="bg-gray-700 border-gray-600">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value} className="text-white">
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-400">
              Campaign messages will be sent according to this timezone
            </p>
          </div>

          {/* Working Hours */}
          <div className="space-y-4">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Working Hours
            </Label>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-gray-400">Start Time</Label>
                <Select
                  value={settings.working_hours_start.toString()}
                  onValueChange={(value) => setSettings({ ...settings, working_hours_start: parseInt(value) })}
                >
                  <SelectTrigger className="bg-gray-700 border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600 max-h-[200px]">
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={i.toString()} className="text-white">
                        {i.toString().padStart(2, '0')}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-gray-400">End Time</Label>
                <Select
                  value={settings.working_hours_end.toString()}
                  onValueChange={(value) => setSettings({ ...settings, working_hours_end: parseInt(value) })}
                >
                  <SelectTrigger className="bg-gray-700 border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600 max-h-[200px]">
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={i.toString()} className="text-white">
                        {i.toString().padStart(2, '0')}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p className="text-xs text-gray-400">
              Messages will only be sent between {settings.working_hours_start}:00 and {settings.working_hours_end}:00
            </p>
          </div>

          {/* Skip Weekends */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Skip Weekends
              </Label>
              <p className="text-xs text-gray-400">
                Don't send messages on Saturday and Sunday
              </p>
            </div>
            <Switch
              checked={settings.skip_weekends}
              onCheckedChange={(checked) => setSettings({ ...settings, skip_weekends: checked })}
            />
          </div>

          {/* Skip Holidays */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Skip Public Holidays
                </Label>
                <p className="text-xs text-gray-400">
                  Don't send messages on public holidays
                </p>
              </div>
              <Switch
                checked={settings.skip_holidays}
                onCheckedChange={(checked) => setSettings({ ...settings, skip_holidays: checked })}
              />
            </div>

            {settings.skip_holidays && (
              <div className="space-y-2 ml-6">
                <Label className="text-sm text-gray-400">Holiday Calendar</Label>
                <Select
                  value={settings.country_code}
                  onValueChange={(value) => setSettings({ ...settings, country_code: value })}
                >
                  <SelectTrigger className="bg-gray-700 border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600">
                    {COUNTRIES.map((country) => (
                      <SelectItem key={country.value} value={country.value} className="text-white">
                        {country.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
