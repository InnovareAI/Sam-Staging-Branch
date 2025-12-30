import React from 'react';
import { Clock, Globe, CalendarOff } from 'lucide-react';

export interface ScheduleSettingsData {
    timezone: string;
    working_hours_start: number;
    working_hours_end: number;
    skip_weekends: boolean;
    skip_holidays: boolean;
}

interface ScheduleSettingsProps {
    settings: ScheduleSettingsData;
    onChange: (settings: ScheduleSettingsData) => void;
}

const COMMON_TIMEZONES = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
    'Australia/Sydney'
];

export default function ScheduleSettings({ settings, onChange }: ScheduleSettingsProps) {
    const handleChange = (key: keyof ScheduleSettingsData, value: any) => {
        onChange({ ...settings, [key]: value });
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-semibold mb-4 flex items-center">
                    <Clock className="mr-2" />
                    Campaign Schedule
                </h2>
                <p className="text-gray-400 mb-4">Configure when messages should be sent to your prospects.</p>
            </div>

            <div className="bg-surface-muted rounded-lg p-6 space-y-6 border border-gray-700">

                {/* Timezone */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
                            <Globe className="w-4 h-4 mr-2" />
                            Timezone
                        </label>
                        <select
                            value={settings.timezone}
                            onChange={(e) => handleChange('timezone', e.target.value)}
                            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-foreground"
                        >
                            {COMMON_TIMEZONES.map((tz) => (
                                <option key={tz} value={tz}>{tz}</option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Messages will be sent relative to this timezone.</p>
                    </div>

                    {/* Business Hours */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
                            <Clock className="w-4 h-4 mr-2" />
                            Business Hours
                        </label>
                        <div className="flex items-center space-x-2">
                            <select
                                value={settings.working_hours_start}
                                onChange={(e) => handleChange('working_hours_start', parseInt(e.target.value))}
                                className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-foreground"
                            >
                                {Array.from({ length: 24 }).map((_, i) => (
                                    <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
                                ))}
                            </select>
                            <span className="text-gray-400">to</span>
                            <select
                                value={settings.working_hours_end}
                                onChange={(e) => handleChange('working_hours_end', parseInt(e.target.value))}
                                className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-foreground"
                            >
                                {Array.from({ length: 24 }).map((_, i) => (
                                    <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
                                ))}
                            </select>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Sending window (e.g., 8 AM to 6 PM).</p>
                    </div>
                </div>

                {/* Restrictions */}
                <div className="space-y-4 pt-4 border-t border-gray-700">
                    <h3 className="text-sm font-medium text-gray-300 mb-2 flex items-center">
                        <CalendarOff className="w-4 h-4 mr-2" />
                        Restrictions
                    </h3>

                    <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                        <div>
                            <span className="text-white font-medium">Skip Weekends</span>
                            <p className="text-xs text-gray-400">Do not send messages on Saturday or Sunday</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.skip_weekends}
                                onChange={(e) => handleChange('skip_weekends', e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                        <div>
                            <span className="text-white font-medium">Skip Holidays</span>
                            <p className="text-xs text-gray-400">Do not send messages on public holidays (US)</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.skip_holidays}
                                onChange={(e) => handleChange('skip_holidays', e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                </div>

            </div>
        </div>
    );
}
