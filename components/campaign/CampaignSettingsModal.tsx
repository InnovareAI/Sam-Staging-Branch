'use client';

import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Settings,
    Clock,
    Globe,
    Calendar,
    Timer,
    Info,
    Flag
} from "lucide-react";

// Types
import type { Campaign } from "@/types/campaign";

interface CampaignSettingsModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    campaign: Campaign | null;
    onSave: (settings: CampaignSettings) => Promise<void>;
}

interface CampaignSettings {
    timezone: string;
    country_code: string;
    working_hours_start: number;
    working_hours_end: number;
    skip_weekends: boolean;
    skip_holidays: boolean;
    daily_limit: number;
    connection_wait_hours: number;
    followup_wait_days: number;
}

const COUNTRIES = [
    { value: "US", label: "United States" },
    { value: "GB", label: "United Kingdom" },
    { value: "CA", label: "Canada" },
    { value: "AU", label: "Australia" },
    { value: "DE", label: "Germany" },
    { value: "FR", label: "France" },
    { value: "NL", label: "Netherlands" },
    { value: "CH", label: "Switzerland" },
    { value: "SG", label: "Singapore" },
    { value: "JP", label: "Japan" },
    { value: "AE", label: "UAE" },
    { value: "NZ", label: "New Zealand" },
];

const TIMEZONES = [
    { value: "America/New_York", label: "US Eastern (New York)" },
    { value: "America/Chicago", label: "US Central (Chicago)" },
    { value: "America/Denver", label: "US Mountain (Denver)" },
    { value: "America/Los_Angeles", label: "US Pacific (Los Angeles)" },
    { value: "Europe/London", label: "UK (London)" },
    { value: "Europe/Paris", label: "Central Europe (Paris)" },
    { value: "Europe/Berlin", label: "Germany (Berlin)" },
    { value: "Europe/Amsterdam", label: "Netherlands (Amsterdam)" },
    { value: "Europe/Zurich", label: "Switzerland (Zurich)" },
    { value: "Asia/Singapore", label: "Singapore" },
    { value: "Asia/Tokyo", label: "Japan (Tokyo)" },
    { value: "Asia/Shanghai", label: "China (Shanghai)" },
    { value: "Asia/Dubai", label: "UAE (Dubai)" },
    { value: "Australia/Sydney", label: "Australia (Sydney)" },
    { value: "Pacific/Auckland", label: "New Zealand (Auckland)" },
];

export function CampaignSettingsModal({
    isOpen,
    onOpenChange,
    campaign,
    onSave
}: CampaignSettingsModalProps) {
    const [settings, setSettings] = useState<CampaignSettings>({
        timezone: "America/Los_Angeles",
        country_code: "US",
        working_hours_start: 9,
        working_hours_end: 18,
        skip_weekends: true,
        skip_holidays: true,
        daily_limit: 25,
        connection_wait_hours: 36,
        followup_wait_days: 5,
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (campaign && isOpen) {
            // Load existing settings from campaign
            const flowSettings = (campaign as any).flow_settings || {};
            setSettings({
                timezone: (campaign as any).timezone || "America/Los_Angeles",
                country_code: (campaign as any).country_code || "US",
                working_hours_start: (campaign as any).working_hours_start || 9,
                working_hours_end: (campaign as any).working_hours_end || 18,
                skip_weekends: (campaign as any).skip_weekends ?? true,
                skip_holidays: (campaign as any).skip_holidays ?? true,
                daily_limit: (campaign as any).daily_limit || 25,
                connection_wait_hours: flowSettings.connection_wait_hours || 36,
                followup_wait_days: flowSettings.followup_wait_days || 5,
            });
        }
    }, [campaign, isOpen]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(settings);
            onOpenChange(false);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    if (!campaign) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[85vh] p-0 overflow-hidden glass-effect shadow-2xl flex flex-col">
                <DialogHeader className="p-6 border-b border-border/40">
                    <div className="flex gap-4 items-center">
                        <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                            <Settings className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-semibold tracking-tight">Campaign Settings</DialogTitle>
                            <DialogDescription className="text-xs font-medium text-muted-foreground/60 uppercase tracking-widest mt-0.5">
                                Configure execution preferences for <span className="text-foreground">{campaign.name}</span>
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <ScrollArea className="flex-1">
                    <div className="p-6 space-y-8">
                        {/* Timezone Section */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <Globe className="w-4 h-4 text-blue-400" />
                                Timezone & Scheduling
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">
                                        Prospect Timezone
                                    </Label>
                                    <Select
                                        value={settings.timezone}
                                        onValueChange={(value) => setSettings({ ...settings, timezone: value })}
                                    >
                                        <SelectTrigger className="bg-background/40 border-border/40">
                                            <SelectValue placeholder="Select timezone" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {TIMEZONES.map((tz) => (
                                                <SelectItem key={tz.value} value={tz.value}>
                                                    {tz.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-muted-foreground/60">
                                        Messages sent during business hours in this timezone
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">
                                        Daily Send Limit
                                    </Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={100}
                                        value={settings.daily_limit}
                                        onChange={(e) => setSettings({ ...settings, daily_limit: parseInt(e.target.value) || 25 })}
                                        className="bg-background/40 border-border/40"
                                    />
                                    <p className="text-[10px] text-muted-foreground/60">
                                        Max messages per day (recommended: 25-50)
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Working Hours Section */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <Clock className="w-4 h-4 text-emerald-400" />
                                Working Hours
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">
                                        Start Hour
                                    </Label>
                                    <Select
                                        value={settings.working_hours_start.toString()}
                                        onValueChange={(value) => setSettings({ ...settings, working_hours_start: parseInt(value) })}
                                    >
                                        <SelectTrigger className="bg-background/40 border-border/40">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[6, 7, 8, 9, 10, 11, 12].map((hour) => (
                                                <SelectItem key={hour} value={hour.toString()}>
                                                    {hour}:00 AM
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">
                                        End Hour
                                    </Label>
                                    <Select
                                        value={settings.working_hours_end.toString()}
                                        onValueChange={(value) => setSettings({ ...settings, working_hours_end: parseInt(value) })}
                                    >
                                        <SelectTrigger className="bg-background/40 border-border/40">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[14, 15, 16, 17, 18, 19, 20, 21].map((hour) => (
                                                <SelectItem key={hour} value={hour.toString()}>
                                                    {hour > 12 ? hour - 12 : hour}:00 PM
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/40">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-medium">Skip Weekends</Label>
                                    <p className="text-[10px] text-muted-foreground/60">Don't send messages on Saturday or Sunday</p>
                                </div>
                                <Switch
                                    checked={settings.skip_weekends}
                                    onCheckedChange={(checked) => setSettings({ ...settings, skip_weekends: checked })}
                                />
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/40">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-medium">Skip Holidays</Label>
                                    <p className="text-[10px] text-muted-foreground/60">Pause during major holidays in selected country</p>
                                </div>
                                <Switch
                                    checked={settings.skip_holidays}
                                    onCheckedChange={(checked) => setSettings({ ...settings, skip_holidays: checked })}
                                />
                            </div>

                            {settings.skip_holidays && (
                                <div className="space-y-2 pl-4 border-l-2 border-border/40">
                                    <Label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">
                                        <Flag className="w-3 h-3 inline mr-1" />Holiday Country
                                    </Label>
                                    <Select
                                        value={settings.country_code}
                                        onValueChange={(value) => setSettings({ ...settings, country_code: value })}
                                    >
                                        <SelectTrigger className="bg-background/40 border-border/40 w-48">
                                            <SelectValue placeholder="Select country" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {COUNTRIES.map((c) => (
                                                <SelectItem key={c.value} value={c.value}>
                                                    {c.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>

                        {/* Timing Section */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <Timer className="w-4 h-4 text-orange-400" />
                                Message Timing
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">
                                        Wait After Connection Request
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            min={12}
                                            max={72}
                                            value={settings.connection_wait_hours}
                                            onChange={(e) => setSettings({ ...settings, connection_wait_hours: parseInt(e.target.value) || 36 })}
                                            className="bg-background/40 border-border/40 w-20"
                                        />
                                        <span className="text-sm text-muted-foreground">hours</span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground/60">
                                        Time to wait for connection before follow-up
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">
                                        Follow-up Delay
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            min={1}
                                            max={30}
                                            value={settings.followup_wait_days}
                                            onChange={(e) => setSettings({ ...settings, followup_wait_days: parseInt(e.target.value) || 5 })}
                                            className="bg-background/40 border-border/40 w-20"
                                        />
                                        <span className="text-sm text-muted-foreground">days</span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground/60">
                                        Days between follow-up messages
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </ScrollArea>

                <DialogFooter className="p-6 border-t border-border/40 bg-muted/20 flex flex-row items-center justify-between shrink-0">
                    <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground/60">
                        <Info className="w-3.5 h-3.5" />
                        Changes apply to future messages only
                    </div>
                    <div className="flex gap-3">
                        <Button variant="ghost" onClick={() => onOpenChange(false)} className="font-medium uppercase tracking-widest text-[10px]">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-blue-500 text-white hover:bg-blue-600 font-medium uppercase tracking-tight shadow-[0_0_20px_rgba(59,130,246,0.2)] min-w-[140px]"
                        >
                            {isSaving ? "Saving..." : "Save Settings"}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
