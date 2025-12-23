'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toastError, toastSuccess } from '@/lib/toast';
import { Loader2, UserPlus, MessageSquare, Mail, Send, AlertTriangle, CheckCircle, XCircle, X } from 'lucide-react';

interface ProspectData {
    id: string;
    email?: string;
    linkedinUrl?: string;
    connectionDegree?: string;
    campaignTag?: string;
    approvalStatus?: string;
    [key: string]: any;
}

interface CreateCampaignModalProps {
    open: boolean;
    onClose: () => void;
    workspaceId: string;
    onSuccess: (campaignId: string) => void;
    defaultName?: string;
    prospects?: ProspectData[];
    hasEmailAccount?: boolean;
}

interface PreflightResults {
    summary: {
        canProceed: number;
        blocked: number;
        alreadyContacted: number;
        pendingInvitation: number;
        duplicates: number;
        wrongDegree: number;
        previouslyFailed: number;
        verified: number;
        rateLimitStatus?: {
            canSend: boolean;
            dailyUsed: number;
            dailyLimit: number;
            weeklyUsed: number;
            weeklyLimit: number;
            warning?: string;
        };
    };
    validProspects: ProspectData[];
}

export function CreateCampaignModal({
    open,
    onClose,
    workspaceId,
    onSuccess,
    defaultName,
    prospects = [],
    hasEmailAccount = true // Default to true if not provided
}: CreateCampaignModalProps) {
    const [name, setName] = useState(defaultName || '');
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Pre-flight check state
    const [showPreflightResults, setShowPreflightResults] = useState(false);
    const [preflightLoading, setPreflightLoading] = useState(false);
    const [preflightResults, setPreflightResults] = useState<PreflightResults | null>(null);
    const [pendingCampaignType, setPendingCampaignType] = useState<string | null>(null);

    // Update name when modal opens with new defaultName
    useEffect(() => {
        if (open) {
            const suggestedName = prospects[0]?.campaignTag || defaultName || `Campaign-${new Date().toISOString().split('T')[0]}`;
            setName(suggestedName);
            // Reset states
            setShowPreflightResults(false);
            setPreflightResults(null);
            setPendingCampaignType(null);
        }
    }, [open, defaultName, prospects]);

    // Calculate eligibility counts based on business rules
    // IMPORTANT: Only approved prospects can be added to campaigns
    const eligibility = useMemo(() => {
        const approvedProspects = prospects.filter(p => p.approvalStatus === 'approved');

        const hasValidEmail = (p: ProspectData) => {
            const email = p.email;
            return email && typeof email === 'string' && email.trim().length > 0;
        };

        const hasLinkedIn = (p: ProspectData) => p.linkedinUrl;

        const is1stDegree = (p: ProspectData) => {
            if (!hasLinkedIn(p)) return false;
            const degree = String(p.connectionDegree || '').toLowerCase();
            return degree.includes('1st') || degree === '1';
        };

        const is2ndOr3rdDegree = (p: ProspectData) => {
            if (!hasLinkedIn(p)) return false;
            const degree = String(p.connectionDegree || '').toLowerCase();
            return !degree.includes('1st') && degree !== '1';
        };

        return {
            approvedCount: approvedProspects.length,
            emailCount: approvedProspects.filter(hasValidEmail).length,
            messengerCount: approvedProspects.filter(is1stDegree).length,
            connectorCount: approvedProspects.filter(is2ndOr3rdDegree).length,
            linkedInCount: approvedProspects.filter(hasLinkedIn).length,
            approvedProspects,
        };
    }, [prospects]);

    const CAMPAIGN_TYPES = [
        {
            value: 'connector',
            label: 'LinkedIn Connector',
            description: 'Send connection requests to 2nd/3rd degree connections',
            icon: UserPlus,
            color: 'purple',
            count: eligibility.connectorCount,
            enabled: eligibility.connectorCount > 0,
        },
        {
            value: 'messenger',
            label: 'LinkedIn Messenger',
            description: 'Send direct messages to 1st degree connections',
            icon: MessageSquare,
            color: 'green',
            count: eligibility.messengerCount,
            enabled: eligibility.messengerCount > 0,
        },
        {
            value: 'inmail',
            label: 'LinkedIn InMail',
            description: 'Message anyone (uses Premium InMail credits)',
            icon: Send,
            color: 'amber',
            count: eligibility.linkedInCount,
            enabled: eligibility.linkedInCount > 0,
        },
        {
            value: 'open_inmail',
            label: 'LinkedIn Open InMail',
            description: 'Free InMail to Open Profiles (no credits needed)',
            icon: Send,
            color: 'teal',
            count: eligibility.linkedInCount,
            enabled: eligibility.linkedInCount > 0,
        },
        {
            value: 'email',
            label: 'Email Campaign',
            description: 'Send emails to prospects with email addresses',
            icon: Mail,
            color: 'blue',
            count: eligibility.emailCount,
            enabled: eligibility.emailCount > 0 && hasEmailAccount,
            needsEmailAccount: !hasEmailAccount && eligibility.emailCount > 0,
        },
    ];

    // Filter prospects based on campaign type
    const filterProspectsByType = (type: string) => {
        const approvedProspects = eligibility.approvedProspects;

        const hasValidEmail = (p: ProspectData) => {
            const email = p.email;
            return email && typeof email === 'string' && email.trim().length > 0;
        };

        const hasLinkedIn = (p: ProspectData) => p.linkedinUrl;

        if (type === 'email') {
            return approvedProspects.filter(hasValidEmail);
        } else if (type === 'connector') {
            return approvedProspects.filter(p => {
                if (!hasLinkedIn(p)) return false;
                const degree = String(p.connectionDegree || '').toLowerCase();
                return !degree.includes('1st') && degree !== '1';
            });
        } else if (type === 'messenger') {
            return approvedProspects.filter(p => {
                if (!hasLinkedIn(p)) return false;
                const degree = String(p.connectionDegree || '').toLowerCase();
                return degree.includes('1st') || degree === '1';
            });
        } else {
            // inmail, open_inmail - all with LinkedIn
            return approvedProspects.filter(hasLinkedIn);
        }
    };

    // Run pre-flight check before creating campaign
    const handleSelectType = async (type: string) => {
        if (!name.trim()) {
            toastError('Please enter a campaign name');
            return;
        }

        const eligibleProspects = filterProspectsByType(type);
        if (eligibleProspects.length === 0) {
            toastError('No eligible prospects for this campaign type');
            return;
        }

        setSelectedType(type);
        setPendingCampaignType(type);
        setPreflightLoading(true);
        setShowPreflightResults(true);

        try {
            // Safely serialize prospects for API
            const safeProspects = eligibleProspects.map(p => ({
                id: p.id,
                name: p.name || 'Unknown',
                email: p.email,
                linkedinUrl: p.linkedinUrl,
                connectionDegree: p.connectionDegree,
                company: p.company,
                title: p.title,
                sessionId: p.sessionId,
                campaignName: name.trim()
            }));

            const response = await fetch('/api/linkedin/preflight-check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prospects: safeProspects,
                    workspaceId,
                    campaignType: type
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.message || 'Pre-flight check failed');
            }

            const data = await response.json();
            setPreflightResults(data);
        } catch (error: any) {
            console.error('Pre-flight check failed:', error);
            toastError(error.message || 'Failed to verify prospects');
            setShowPreflightResults(false);
        } finally {
            setPreflightLoading(false);
        }
    };

    // Create campaign after pre-flight approval
    const handleCreateCampaign = async () => {
        if (!pendingCampaignType || !preflightResults?.validProspects?.length) return;

        setLoading(true);
        try {
            const response = await fetch('/api/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspace_id: workspaceId,
                    name: name.trim(),
                    campaign_type: pendingCampaignType,
                    status: 'draft'
                })
            });

            const data = await response.json();
            const campaignData = data.data?.campaign || data.campaign;

            if (!response.ok) {
                throw new Error(data.details || data.error || 'Failed to create campaign');
            }

            if (data.success && campaignData?.id) {
                toastSuccess(`Campaign "${name}" created with ${preflightResults.summary.canProceed} prospects!`);
                onSuccess(campaignData.id);
                handleClose();
            } else {
                throw new Error(data.message || 'Failed to create campaign');
            }
        } catch (error) {
            console.error(error);
            toastError(error instanceof Error ? error.message : "Failed to create campaign");
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setName('');
        setSelectedType(null);
        setShowPreflightResults(false);
        setPreflightResults(null);
        setPendingCampaignType(null);
        onClose();
    };

    const getColorClasses = (color: string) => {
        const colors: Record<string, { bg: string; text: string; border: string; hover: string }> = {
            purple: { bg: 'bg-purple-600/20', text: 'text-purple-400', border: 'border-purple-500', hover: 'hover:border-purple-500' },
            green: { bg: 'bg-green-600/20', text: 'text-green-400', border: 'border-green-500', hover: 'hover:border-green-500' },
            blue: { bg: 'bg-blue-600/20', text: 'text-blue-400', border: 'border-blue-500', hover: 'hover:border-blue-500' },
            amber: { bg: 'bg-amber-600/20', text: 'text-amber-400', border: 'border-amber-500', hover: 'hover:border-amber-500' },
            teal: { bg: 'bg-teal-600/20', text: 'text-teal-400', border: 'border-teal-500', hover: 'hover:border-teal-500' },
        };
        return colors[color] || colors.blue;
    };

    // Render pre-flight results view
    if (showPreflightResults) {
        const summary = preflightResults?.summary;
        const validCount = summary?.canProceed || 0;
        const blockedCount = summary?.blocked || 0;

        return (
            <Dialog open={open} onOpenChange={handleClose}>
                <DialogContent className="sm:max-w-[500px] bg-background border-border max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-white text-lg font-semibold">
                            {preflightLoading ? 'Verifying Prospects...' : 'Pre-flight Check Results'}
                        </DialogTitle>
                    </DialogHeader>

                    {preflightLoading ? (
                        <div className="flex flex-col items-center py-8">
                            <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
                            <p className="text-muted-foreground">Checking prospects against existing campaigns...</p>
                            <p className="text-gray-500 text-sm mt-2">This may take a few seconds</p>
                        </div>
                    ) : summary ? (
                        <div className="space-y-4">
                            {/* Summary Stats */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-green-600/20 rounded-lg p-3 border border-green-600/30">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="w-5 h-5 text-green-400" />
                                        <span className="text-green-400 font-semibold text-lg">{validCount}</span>
                                    </div>
                                    <div className="text-green-300 text-sm">Ready to proceed</div>
                                </div>
                                <div className="bg-red-600/20 rounded-lg p-3 border border-red-600/30">
                                    <div className="flex items-center gap-2">
                                        <XCircle className="w-5 h-5 text-red-400" />
                                        <span className="text-red-400 font-semibold text-lg">{blockedCount}</span>
                                    </div>
                                    <div className="text-red-300 text-sm">Cannot proceed</div>
                                </div>
                            </div>

                            {/* Rate Limit Status */}
                            {summary.rateLimitStatus && (
                                <div className={`p-3 rounded-lg border ${summary.rateLimitStatus.canSend
                                    ? 'bg-gray-700/50 border-gray-600'
                                    : 'bg-yellow-600/20 border-yellow-600/30'
                                    }`}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertTriangle className={`w-4 h-4 ${summary.rateLimitStatus.canSend ? 'text-gray-400' : 'text-yellow-400'}`} />
                                        <span className="text-white text-sm font-medium">Rate Limits</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Today: {summary.rateLimitStatus.dailyUsed}/{summary.rateLimitStatus.dailyLimit}</span>
                                        <span className="text-muted-foreground">This week: {summary.rateLimitStatus.weeklyUsed}/{summary.rateLimitStatus.weeklyLimit}</span>
                                    </div>
                                    {summary.rateLimitStatus.warning && (
                                        <p className="text-yellow-400 text-xs mt-2">{summary.rateLimitStatus.warning}</p>
                                    )}
                                </div>
                            )}

                            {/* Blocked Reasons Breakdown */}
                            {blockedCount > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-white text-sm font-medium">Blocked Reasons:</h4>
                                    {summary.alreadyContacted > 0 && (
                                        <div className="flex items-center justify-between text-sm bg-gray-700/50 rounded-lg px-3 py-2">
                                            <span className="text-muted-foreground">Already contacted</span>
                                            <span className="text-red-400 font-medium">{summary.alreadyContacted}</span>
                                        </div>
                                    )}
                                    {summary.pendingInvitation > 0 && (
                                        <div className="flex items-center justify-between text-sm bg-gray-700/50 rounded-lg px-3 py-2">
                                            <span className="text-muted-foreground">Pending invitation</span>
                                            <span className="text-yellow-400 font-medium">{summary.pendingInvitation}</span>
                                        </div>
                                    )}
                                    {summary.duplicates > 0 && (
                                        <div className="flex items-center justify-between text-sm bg-gray-700/50 rounded-lg px-3 py-2">
                                            <span className="text-muted-foreground">Duplicates in batch</span>
                                            <span className="text-orange-400 font-medium">{summary.duplicates}</span>
                                        </div>
                                    )}
                                    {summary.wrongDegree > 0 && (
                                        <div className="flex items-center justify-between text-sm bg-gray-700/50 rounded-lg px-3 py-2">
                                            <span className="text-muted-foreground">Wrong connection degree</span>
                                            <span className="text-purple-400 font-medium">{summary.wrongDegree}</span>
                                        </div>
                                    )}
                                    {summary.previouslyFailed > 0 && (
                                        <div className="flex items-center justify-between text-sm bg-gray-700/50 rounded-lg px-3 py-2">
                                            <span className="text-muted-foreground">Previously failed</span>
                                            <span className="text-gray-400 font-medium">{summary.previouslyFailed}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Verified count */}
                            {summary.verified > 0 && (
                                <div className="text-sm text-muted-foreground">
                                    ✓ {summary.verified} profiles verified with LinkedIn
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-3 mt-6">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setShowPreflightResults(false);
                                        setPreflightResults(null);
                                        setSelectedType(null);
                                    }}
                                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white border-gray-600"
                                >
                                    Back
                                </Button>
                                <Button
                                    onClick={handleCreateCampaign}
                                    disabled={validCount === 0 || loading}
                                    className={`flex-1 ${validCount > 0
                                        ? 'bg-blue-600 hover:bg-blue-500 text-white'
                                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                        }`}
                                >
                                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {validCount > 0 ? `Create with ${validCount} prospects` : 'No valid prospects'}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <XCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
                            <p className="text-muted-foreground">Failed to verify prospects</p>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        );
    }

    // Render campaign type selection view
    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px] bg-background border-border">
                <DialogHeader>
                    <DialogTitle className="text-white text-lg font-semibold">Create New Campaign</DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Name your campaign and choose the type
                        {eligibility.approvedCount > 0 ? (
                            <span className="ml-1">• {eligibility.approvedCount} approved prospects</span>
                        ) : prospects.length > 0 ? (
                            <span className="ml-1 text-amber-400">• 0 approved (approve prospects first)</span>
                        ) : null}
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-4 space-y-6">
                    {/* Campaign Name Input */}
                    <div>
                        <label htmlFor="campaign-name" className="block text-sm font-medium text-gray-300 mb-2">
                            Campaign Name
                        </label>
                        <Input
                            id="campaign-name"
                            placeholder="Enter campaign name..."
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-surface-muted border-border text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
                            autoFocus
                        />
                    </div>

                    {/* Campaign Type Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-3">
                            Campaign Type
                        </label>
                        <div className="space-y-3">
                            {CAMPAIGN_TYPES.map((type) => {
                                const colors = getColorClasses(type.color);
                                const Icon = type.icon;
                                const isDisabled = !type.enabled || loading;
                                const isLoading = loading && selectedType === type.value;

                                return (
                                    <div key={type.value}>
                                        <button
                                            onClick={() => type.enabled && handleSelectType(type.value)}
                                            disabled={isDisabled}
                                            className={`w-full p-4 rounded-lg border-2 transition-all text-left group ${isDisabled
                                                ? 'border-border bg-surface-muted/50 opacity-50 cursor-not-allowed'
                                                : `border-border ${colors.hover} hover:bg-surface-muted`
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${type.enabled ? `${colors.bg} ${colors.text}` : 'bg-gray-600/20 text-gray-500'}`}>
                                                    {isLoading ? (
                                                        <Loader2 className="w-5 h-5 animate-spin" />
                                                    ) : (
                                                        <Icon className="w-5 h-5" />
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className={type.enabled ? 'text-white font-semibold' : 'text-gray-500 font-semibold'}>
                                                            {type.label}
                                                        </span>
                                                        <span className={`text-xs px-2 py-0.5 rounded-full ${type.enabled
                                                            ? `${colors.bg} ${colors.text}`
                                                            : 'bg-gray-700 text-gray-500'
                                                            }`}>
                                                            {type.count} eligible
                                                        </span>
                                                    </div>
                                                    <div className={type.enabled ? 'text-gray-400 text-sm' : 'text-gray-600 text-sm'}>
                                                        {type.description}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                        {/* Warning for email when no account connected */}
                                        {'needsEmailAccount' in type && type.needsEmailAccount && (
                                            <div className="mt-2 p-3 bg-yellow-600/20 border border-yellow-600/30 rounded-lg flex items-start gap-2">
                                                <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                                                <div className="flex-1">
                                                    <p className="text-yellow-300 text-xs font-medium">No email account connected</p>
                                                    <p className="text-yellow-400/80 text-xs mt-0.5">
                                                        Connect an email provider in Settings → Integrations to send email campaigns
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Cancel Button */}
                <div className="mt-4">
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={loading}
                        className="w-full bg-gray-700 hover:bg-gray-600 text-white border-gray-600"
                    >
                        Cancel
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
