'use client';

import { useState } from 'react';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { ProspectData } from "./types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Linkedin, MapPin, Building, Star, Phone, Globe, Calendar, User, CheckCircle, XCircle, Trash2, Upload, RefreshCw, Search, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { toastSuccess, toastError, toastInfo } from '@/lib/toast';

interface ProspectDetailsSheetProps {
    prospect: ProspectData | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onApprove?: (ids: string[]) => void;
    onReject?: (ids: string[]) => void;
    onDelete?: (id: string) => void;
    onAddToCampaign?: (ids: string[]) => void;
    workspaceId?: string;
}

export function ProspectDetailsSheet({ prospect, open, onOpenChange, onApprove, onReject, onDelete, onAddToCampaign, workspaceId }: ProspectDetailsSheetProps) {
    const [isEnrichingEmail, setIsEnrichingEmail] = useState(false);
    const [isRefreshingProfile, setIsRefreshingProfile] = useState(false);

    if (!prospect) return null;

    const handleFindEmail = async () => {
        if (!workspaceId) {
            toastError('Workspace ID required for enrichment');
            return;
        }

        setIsEnrichingEmail(true);
        try {
            const response = await fetch('/api/prospect-approval/enrich', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prospect_id: prospect.id,
                    action: 'find_email',
                    workspace_id: workspaceId
                })
            });

            const data = await response.json();

            if (data.success) {
                if (data.status === 'already_enriched') {
                    toastInfo(`Email already exists: ${data.email}`);
                } else if (data.email) {
                    toastSuccess(`Found email: ${data.email}` + (data.industry ? ` | Industry: ${data.industry}` : ''));
                } else if (data.industry) {
                    toastSuccess(`Found industry: ${data.industry}`);
                } else {
                    toastSuccess('Enrichment data saved.');
                }
            } else if (data.status === 'not_found') {
                toastInfo('No public email or industry found on this profile.');
            } else {
                toastError(data.error || data.message || 'Failed to start email lookup');
            }
        } catch (error) {
            console.error('Find email error:', error);
            toastError('Failed to start email lookup');
        } finally {
            setIsEnrichingEmail(false);
        }
    };

    const handleRefreshProfile = async () => {
        if (!workspaceId) {
            toastError('Workspace ID required for enrichment');
            return;
        }

        setIsRefreshingProfile(true);
        try {
            const response = await fetch('/api/prospect-approval/enrich', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prospect_id: prospect.id,
                    action: 'refresh_profile',
                    workspace_id: workspaceId
                })
            });

            const data = await response.json();

            if (data.success) {
                toastSuccess('Profile refresh queued. Data will update shortly.');
            } else {
                toastError(data.error || 'Failed to start profile refresh');
            }
        } catch (error) {
            console.error('Refresh profile error:', error);
            toastError('Failed to start profile refresh');
        } finally {
            setIsRefreshingProfile(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                <SheetHeader>
                    <div className="flex items-start justify-between">
                        <div>
                            <SheetTitle className="text-xl">{prospect.name}</SheetTitle>
                            <SheetDescription className="text-base font-medium text-foreground/80 mt-1">
                                {prospect.title} at {prospect.company}
                            </SheetDescription>
                        </div>
                        <Badge
                            variant={prospect.approvalStatus === 'approved' ? 'outline' : prospect.approvalStatus === 'rejected' ? 'destructive' : 'secondary'}
                            className={`text-sm capitalize ${prospect.approvalStatus === 'approved' ? 'bg-green-600/20 text-green-400 border-green-600/30' : ''}`}
                        >
                            {prospect.approvalStatus}
                        </Badge>
                    </div>
                </SheetHeader>

                <div className="mt-8 space-y-6">
                    {/* Quality Score */}
                    <div className="flex items-center gap-4 bg-muted/50 p-4 rounded-lg">
                        <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">Quality Score</span>
                            <div className="flex items-center gap-2 mt-1">
                                <Star className={`h-5 w-5 ${prospect.qualityScore >= 80 ? 'fill-green-500 text-green-500' : 'fill-yellow-500 text-yellow-500'}`} />
                                <span className="text-2xl font-bold">{prospect.qualityScore}</span>
                            </div>
                        </div>
                        <Separator orientation="vertical" className="h-10" />
                        <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">Connection</span>
                            <span className="font-semibold mt-1">{prospect.connectionDegree || 'Unknown'}</span>
                        </div>
                    </div>

                    <Separator />

                    {/* Contact Info */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                            <User className="w-5 h-5 text-purple-500" />
                            Contact Information
                        </h3>
                        <div className="grid gap-3">
                            <div className="flex items-center gap-3 text-sm">
                                <Mail className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium text-muted-foreground w-20">Email:</span>
                                <span className="flex-1">{prospect.email || 'N/A'}</span>
                                {!prospect.email && workspaceId && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleFindEmail}
                                        disabled={isEnrichingEmail}
                                        className="h-7 text-xs"
                                    >
                                        {isEnrichingEmail ? (
                                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                        ) : (
                                            <Search className="w-3 h-3 mr-1" />
                                        )}
                                        Enrich
                                    </Button>
                                )}
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <Phone className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium text-muted-foreground w-20">Phone:</span>
                                <span>{prospect.phone || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <Linkedin className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium text-muted-foreground w-20">LinkedIn:</span>
                                {prospect.linkedinUrl ? (
                                    <a href={prospect.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline truncate max-w-[300px]">
                                        {prospect.linkedinUrl}
                                    </a>
                                ) : (
                                    <span>N/A</span>
                                )}
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <MapPin className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium text-muted-foreground w-20">Location:</span>
                                <span>{prospect.location || 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Company Info */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                            <Building className="w-5 h-5 text-blue-500" />
                            Company Details
                        </h3>
                        <div className="grid gap-3">
                            <div className="flex items-center gap-3 text-sm">
                                <Building className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium text-muted-foreground w-20">Name:</span>
                                <span>{prospect.company || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <Globe className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium text-muted-foreground w-20">Industry:</span>
                                <span>{prospect.industry || 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Metadata */}
                    <div className="space-y-2">
                        <h3 className="font-semibold text-sm text-muted-foreground">Source Information</h3>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex flex-col p-2 bg-muted/30 rounded">
                                <span className="text-muted-foreground">Search Name</span>
                                <span className="font-medium truncate" title={prospect.campaignTag}>{prospect.campaignTag || 'N/A'}</span>
                            </div>
                            <div className="flex flex-col p-2 bg-muted/30 rounded">
                                <span className="text-muted-foreground">Source</span>
                                <span className="font-medium capitalize">{prospect.source}</span>
                            </div>
                            <div className="flex flex-col p-2 bg-muted/30 rounded">
                                <span className="text-muted-foreground">Researched By</span>
                                <span className="font-medium">{prospect.researchedBy}</span>
                            </div>
                            <div className="flex flex-col p-2 bg-muted/30 rounded">
                                <span className="text-muted-foreground">Date Added</span>
                                <span className="font-medium">
                                    {prospect.createdAt instanceof Date
                                        ? prospect.createdAt.toLocaleDateString()
                                        : new Date(prospect.createdAt || Date.now()).toLocaleDateString()
                                    }
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-8 space-y-3">
                    <div className="flex gap-2">
                        <Button
                            onClick={() => onApprove?.([prospect.id])}
                            disabled={prospect.approvalStatus === 'approved'}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Approve
                        </Button>
                        <Button
                            onClick={() => onReject?.([prospect.id])}
                            disabled={prospect.approvalStatus === 'rejected'}
                            className="flex-1"
                            variant="destructive"
                        >
                            <XCircle className="w-4 h-4 mr-2" />
                            Reject
                        </Button>
                    </div>
                    <Button
                        onClick={() => onAddToCampaign?.([prospect.id])}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        <Upload className="w-4 h-4 mr-2" />
                        Add to Campaign
                    </Button>
                    <Separator />
                    {/* Enrichment Buttons */}
                    {workspaceId && (
                        <div className="flex gap-2">
                            <Button
                                onClick={handleFindEmail}
                                disabled={isEnrichingEmail || !!prospect.email}
                                className="flex-1"
                                variant="outline"
                            >
                                {isEnrichingEmail ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Search className="w-4 h-4 mr-2" />
                                )}
                                {prospect.email ? 'Enriched' : 'Find Email/Industry'}
                            </Button>
                            <Button
                                onClick={handleRefreshProfile}
                                disabled={isRefreshingProfile || !prospect.linkedinUrl}
                                className="flex-1"
                                variant="outline"
                            >
                                {isRefreshingProfile ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                )}
                                Refresh Profile
                            </Button>
                        </div>
                    )}
                    <Separator />
                    <div className="flex gap-2">
                        <Button
                            onClick={() => window.open(prospect.linkedinUrl, '_blank')}
                            disabled={!prospect.linkedinUrl}
                            className="flex-1"
                            variant="outline"
                        >
                            <Linkedin className="w-4 h-4 mr-2" />
                            View Profile
                        </Button>
                        <Button
                            onClick={() => window.location.href = `mailto:${prospect.email}`}
                            disabled={!prospect.email}
                            className="flex-1"
                            variant="outline"
                        >
                            <Mail className="w-4 h-4 mr-2" />
                            Send Email
                        </Button>
                    </div>
                    <Button
                        onClick={() => onDelete?.(prospect.id)}
                        className="w-full"
                        variant="outline"
                    >
                        <Trash2 className="w-4 h-4 mr-2 text-red-500" />
                        Delete Prospect
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
