'use client';

import React from "react";
import { Rocket } from "lucide-react";
import { CampaignCard } from "./CampaignCard";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Types
import type { Campaign } from "@/types/campaign";

interface CampaignListProps {
    campaigns: Campaign[];
    loading: boolean;
    onToggleStatus?: (id: string, currentStatus: string) => void;
    onExecute?: (id: string) => void;
    onArchive?: (id: string) => void;
    onViewMessages?: (campaign: Campaign) => void;
    onViewProspects?: (id: string) => void;
    onAddProspects?: (campaign: Campaign) => void;
    onReachInbox?: (campaign: Campaign) => void;
    onShowAnalytics?: (id: string) => void;
    onEdit?: (campaign: Campaign) => void;
    onEditSettings?: (campaign: Campaign) => void;
    selectedCampaigns?: Set<string>;
    onToggleSelection?: (id: string) => void;
    reachInboxConfigured?: boolean;
    className?: string;
}

export function CampaignList({
    campaigns,
    loading,
    onToggleStatus,
    onExecute,
    onArchive,
    onViewMessages,
    onViewProspects,
    onAddProspects,
    onReachInbox,
    onShowAnalytics,
    onEdit,
    onEditSettings,
    selectedCampaigns = new Set(),
    onToggleSelection,
    reachInboxConfigured = false,
    className
}: CampaignListProps) {
    if (loading) {
        return (
            <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-6", className)}>
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-48 rounded-xl border border-border/40 glass-effect animate-pulse flex flex-col p-6 gap-4">
                        <div className="flex justify-between items-start">
                            <div className="space-y-2 flex-1">
                                <Skeleton className="h-6 w-3/4 bg-border/40" />
                                <Skeleton className="h-4 w-1/4 bg-border/40" />
                            </div>
                            <div className="flex gap-2">
                                <Skeleton className="h-8 w-8 rounded bg-border/40" />
                                <Skeleton className="h-8 w-8 rounded bg-border/40" />
                            </div>
                        </div>
                        <div className="mt-auto grid grid-cols-4 gap-4 pt-4 border-t border-border/40">
                            {[1, 2, 3, 4].map(j => (
                                <Skeleton key={j} className="h-10 bg-border/40" />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (campaigns.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-20 border border-dashed border-border/40 rounded-3xl bg-card/10">
                <Rocket className="h-12 w-12 text-muted-foreground/20 mb-4" />
                <h3 className="text-xl font-bold text-foreground/60 tracking-tight">No Campaigns Found</h3>
                <p className="text-sm text-muted-foreground/60 mt-1">Start by creating your first outreach campaign.</p>
            </div>
        );
    }

    return (
        <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20", className)}>
            {campaigns.map((c) => (
                <CampaignCard
                    key={c.id}
                    campaign={c}
                    onToggleStatus={onToggleStatus || (() => { })}
                    onExecute={onExecute || (() => { })}
                    onArchive={onArchive || (() => { })}
                    onViewMessages={onViewMessages || (() => { })}
                    onViewProspects={onViewProspects || (() => { })}
                    onAddProspects={onAddProspects || (() => { })}
                    onPushToReachInbox={onReachInbox}
                    onShowAnalytics={onShowAnalytics || (() => { })}
                    onEdit={onEdit || (() => { })}
                    onEditSettings={onEditSettings}
                    isSelected={selectedCampaigns.has(c.id)}
                    onToggleSelection={onToggleSelection || (() => { })}
                    reachInboxConfigured={reachInboxConfigured}
                />
            ))}
        </div>
    );
}
