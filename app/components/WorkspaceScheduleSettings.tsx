'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Calendar, Clock, Globe, Loader2, Save } from 'lucide-react';
import { createClient } from '@/app/lib/supabase';
import moment from 'moment-timezone';

interface WorkspaceScheduleSettingsProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
}

interface DaySchedule {
  enabled: boolean;
  start: string;
  end: string;
}

interface InactiveDate {
  id: string;
  start_date: string;
  end_date: string;
  description?: string;
}

interface ScheduleSettings {
  timezone: string;
  weekly_schedule: {
    monday: DaySchedule;
    tuesday: DaySchedule;
    wednesday: DaySchedule;
    thursday: DaySchedule;
    friday: DaySchedule;
    saturday: DaySchedule;
    sunday: DaySchedule;
  };
  inactive_dates: InactiveDate[];
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_LABELS: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

const TIMEZONES = [
  // Americas
  { value: 'America/New_York', label: 'US/Eastern', region: 'Americas' },
  { value: 'America/Chicago', label: 'US/Central', region: 'Americas' },
  { value: 'America/Denver', label: 'US/Mountain', region: 'Americas' },
  { value: 'America/Los_Angeles', label: 'US/Pacific', region: 'Americas' },
  { value: 'America/Toronto', label: 'Canada/Eastern', region: 'Americas' },
  { value: 'America/Vancouver', label: 'Canada/Pacific', region: 'Americas' },
  // Europe
  { value: 'Europe/London', label: 'UK/London', region: 'Europe' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET)', region: 'Europe' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET)', region: 'Europe' },
  { value: 'Europe/Amsterdam', label: 'Europe/Amsterdam', region: 'Europe' },
  { value: 'Europe/Zurich', label: 'Europe/Zurich', region: 'Europe' },
  { value: 'Europe/Dublin', label: 'Europe/Dublin', region: 'Europe' },
  // Africa
  { value: 'Africa/Johannesburg', label: 'South Africa (SAST)', region: 'Africa' },
  // Asia-Pacific
  { value: 'Asia/Dubai', label: 'UAE/Dubai', region: 'Middle East' },
  { value: 'Asia/Riyadh', label: 'Saudi Arabia', region: 'Middle East' },
  { value: 'Asia/Singapore', label: 'Singapore', region: 'Asia-Pacific' },
  { value: 'Asia/Tokyo', label: 'Japan/Tokyo', region: 'Asia-Pacific' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney', region: 'Asia-Pacific' },
  { value: 'Pacific/Auckland', label: 'New Zealand', region: 'Asia-Pacific' },
];

const defaultSchedule: ScheduleSettings = {
  timezone: 'America/New_York',
  weekly_schedule: {
    monday: { enabled: true, start: '07:00', end: '22:00' },
    tuesday: { enabled: true, start: '07:00', end: '22:00' },
    wednesday: { enabled: true, start: '07:00', end: '22:00' },
    thursday: { enabled: true, start: '07:00', end: '22:00' },
    friday: { enabled: true, start: '07:00', end: '22:00' },
    saturday: { enabled: true, start: '10:00', end: '19:00' },
    sunday: { enabled: true, start: '11:30', end: '17:00' },
  },
  inactive_dates: [],
};

export default function WorkspaceScheduleSettings({
  workspaceId,
  isOpen,
  onClose,
  onSave
}: WorkspaceScheduleSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ScheduleSettings>(defaultSchedule);
  const [localTime, setLocalTime] = useState('');
  const [selectedInactiveDates, setSelectedInactiveDates] = useState<Set<string>>(new Set());
  const [newInactiveStart, setNewInactiveStart] = useState('');
  const [newInactiveEnd, setNewInactiveEnd] = useState('');

  // Update local time every second
  useEffect(() => {
    const updateTime = () => {
      const time = moment().tz(settings.timezone).format('HH:mm');
      setLocalTime(time);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [settings.timezone]);

  // Load settings on mount
  useEffect(() => {
    if (isOpen && workspaceId) {
      loadSettings();
    }
  }, [isOpen, workspaceId]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('workspace_schedule_settings')
        .select('*')
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (data) {
        setSettings({
          timezone: data.timezone || defaultSchedule.timezone,
          weekly_schedule: data.weekly_schedule || defaultSchedule.weekly_schedule,
          inactive_dates: data.inactive_dates || [],
        });
      }
    } catch (error) {
      console.error('Failed to load schedule settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('workspace_schedule_settings')
        .upsert({
          workspace_id: workspaceId,
          timezone: settings.timezone,
          weekly_schedule: settings.weekly_schedule,
          inactive_dates: settings.inactive_dates,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'workspace_id'
        });

      if (error) throw error;

      onSave?.();
      onClose();
    } catch (error) {
      console.error('Failed to save schedule settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateDaySchedule = (day: typeof DAYS[number], field: keyof DaySchedule, value: string | boolean) => {
    setSettings(prev => ({
      ...prev,
      weekly_schedule: {
        ...prev.weekly_schedule,
        [day]: {
          ...prev.weekly_schedule[day],
          [field]: value,
        },
      },
    }));
  };

  const addInactiveDate = () => {
    if (!newInactiveStart || !newInactiveEnd) return;

    const newDate: InactiveDate = {
      id: crypto.randomUUID(),
      start_date: newInactiveStart,
      end_date: newInactiveEnd,
    };

    setSettings(prev => ({
      ...prev,
      inactive_dates: [...prev.inactive_dates, newDate],
    }));

    setNewInactiveStart('');
    setNewInactiveEnd('');
  };

  const deleteSelectedInactiveDates = () => {
    setSettings(prev => ({
      ...prev,
      inactive_dates: prev.inactive_dates.filter(d => !selectedInactiveDates.has(d.id)),
    }));
    setSelectedInactiveDates(new Set());
  };

  const toggleInactiveDateSelection = (id: string) => {
    const newSelection = new Set(selectedInactiveDates);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedInactiveDates(newSelection);
  };

  const selectAllInactiveDates = () => {
    if (selectedInactiveDates.size === settings.inactive_dates.length) {
      setSelectedInactiveDates(new Set());
    } else {
      setSelectedInactiveDates(new Set(settings.inactive_dates.map(d => d.id)));
    }
  };

  const getTodayName = () => {
    return moment().format('dddd').toLowerCase();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-white">Schedule Settings</h2>
            <p className="text-sm text-gray-400 mt-1">
              Configure when automated actions run for this workspace
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-pink-500" />
          </div>
        ) : (
          <div className="overflow-y-auto max-h-[calc(90vh-180px)]">
            {/* Timezone Section */}
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center gap-2 mb-4">
                <Globe size={20} className="text-pink-400" />
                <h3 className="text-lg font-medium text-white">Time Zone</h3>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                Select time zone that is natural for activity for your accounts.
              </p>

              <div className="flex items-center gap-4">
                <select
                  value={settings.timezone}
                  onChange={(e) => setSettings(prev => ({ ...prev, timezone: e.target.value }))}
                  className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  {['Americas', 'Europe', 'Africa', 'Middle East', 'Asia-Pacific'].map(region => (
                    <optgroup key={region} label={region}>
                      {TIMEZONES.filter(tz => tz.region === region).map(tz => (
                        <option key={tz.value} value={tz.value}>{tz.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                <div className="flex items-center gap-2 px-4 py-3 bg-gray-700 rounded-lg">
                  <Clock size={18} className="text-gray-400" />
                  <span className="text-white font-mono text-lg">{localTime}</span>
                  <span className="text-gray-400 text-sm">local time</span>
                </div>
              </div>
            </div>

            {/* Weekly Schedule Section */}
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center gap-2 mb-4">
                <Calendar size={20} className="text-pink-400" />
                <h3 className="text-lg font-medium text-white">Weekly Active Hours</h3>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                Set the hours when campaign messages are sent. Actions will only run during these times.
              </p>

              {/* Day shortcuts */}
              <div className="flex gap-2 mb-4">
                {DAYS.map(day => (
                  <button
                    key={day}
                    onClick={() => updateDaySchedule(day, 'enabled', !settings.weekly_schedule[day].enabled)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      settings.weekly_schedule[day].enabled
                        ? 'bg-pink-600 text-white'
                        : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    {day.substring(0, 3).charAt(0).toUpperCase() + day.substring(1, 3)}
                  </button>
                ))}
              </div>

              {/* Day schedules */}
              <div className="space-y-3">
                {DAYS.map(day => {
                  const schedule = settings.weekly_schedule[day];
                  const isToday = getTodayName() === day;

                  return (
                    <div
                      key={day}
                      className={`flex items-center gap-4 p-3 rounded-lg ${
                        isToday ? 'bg-pink-900/20 border border-pink-700/50' : 'bg-gray-700/50'
                      }`}
                    >
                      <div className="w-32 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={schedule.enabled}
                          onChange={(e) => updateDaySchedule(day, 'enabled', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-500 text-pink-600 focus:ring-pink-500 bg-gray-700"
                        />
                        <span className={`text-sm font-medium ${schedule.enabled ? 'text-white' : 'text-gray-500'}`}>
                          {DAY_LABELS[day]}
                          {isToday && <span className="ml-2 text-xs text-pink-400">Today</span>}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="time"
                          value={schedule.start}
                          onChange={(e) => updateDaySchedule(day, 'start', e.target.value)}
                          disabled={!schedule.enabled}
                          className={`px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500 ${
                            !schedule.enabled && 'opacity-50'
                          }`}
                        />
                        <span className="text-gray-400">to</span>
                        <input
                          type="time"
                          value={schedule.end}
                          onChange={(e) => updateDaySchedule(day, 'end', e.target.value)}
                          disabled={!schedule.enabled}
                          className={`px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500 ${
                            !schedule.enabled && 'opacity-50'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Inactive Days Section */}
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-medium text-white">Additional Inactive Days</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Add specific dates (like holidays or time off) when automated actions should pause.
                  </p>
                </div>
              </div>

              {/* Add new inactive date */}
              <div className="flex items-center gap-3 mb-4 p-4 bg-gray-700/50 rounded-lg">
                <input
                  type="date"
                  value={newInactiveStart}
                  onChange={(e) => setNewInactiveStart(e.target.value)}
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
                <span className="text-gray-400">to</span>
                <input
                  type="date"
                  value={newInactiveEnd}
                  onChange={(e) => setNewInactiveEnd(e.target.value)}
                  min={newInactiveStart}
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
                <button
                  onClick={addInactiveDate}
                  disabled={!newInactiveStart || !newInactiveEnd}
                  className="flex items-center gap-2 px-4 py-2 bg-pink-600 hover:bg-pink-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  <Plus size={16} />
                  Add Inactive
                </button>
              </div>

              {/* Inactive dates list */}
              {settings.inactive_dates.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2 text-sm text-gray-400">
                      <input
                        type="checkbox"
                        checked={selectedInactiveDates.size === settings.inactive_dates.length && settings.inactive_dates.length > 0}
                        onChange={selectAllInactiveDates}
                        className="w-4 h-4 rounded border-gray-500 text-pink-600 focus:ring-pink-500 bg-gray-700"
                      />
                      Select all
                    </label>

                    {selectedInactiveDates.size > 0 && (
                      <button
                        onClick={deleteSelectedInactiveDates}
                        className="flex items-center gap-1 px-3 py-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors text-sm"
                      >
                        <Trash2 size={14} />
                        Delete selected
                      </button>
                    )}
                  </div>

                  {settings.inactive_dates.map(inactive => (
                    <div
                      key={inactive.id}
                      className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg"
                    >
                      <input
                        type="checkbox"
                        checked={selectedInactiveDates.has(inactive.id)}
                        onChange={() => toggleInactiveDateSelection(inactive.id)}
                        className="w-4 h-4 rounded border-gray-500 text-pink-600 focus:ring-pink-500 bg-gray-700"
                      />
                      <Calendar size={16} className="text-gray-400" />
                      <span className="text-white">
                        {moment(inactive.start_date).format('DD MMM, YYYY')}
                        {inactive.start_date !== inactive.end_date &&
                          ` - ${moment(inactive.end_date).format('DD MMM, YYYY')}`
                        }
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {settings.inactive_dates.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Calendar size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No inactive dates configured</p>
                  <p className="text-sm">Add dates when you want to pause all automated actions</p>
                </div>
              )}
            </div>
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
