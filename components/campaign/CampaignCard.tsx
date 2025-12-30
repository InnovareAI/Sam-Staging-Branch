'use client';

import React from "react";
import { motion } from "framer-motion";
import {
    Rocket,
    Pause,
    Play,
    Archive,
    Eye,
    Users,
    UserPlus,
    Send,
    BarChart3,
    Edit,
    Settings,
    CheckCircle,
    Clock,
    FileText,
    FlaskConical,
    MoreHorizontal,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Types
import type { Campaign } from "@/types/campaign";

interface CampaignCardProps {
    campaign: Campaign;
    onToggleStatus: (id: string, currentStatus: string) => void;
    onExecute: (id: string) => void;
    onArchive: (id: string) => void;
    onComplete: (id: string) => void;
    onViewMessages: (campaign: Campaign) => void;
    onViewProspects: (id: string) => void;
    onAddProspects: (campaign: Campaign) => void;
    onPushToReachInbox?: (campaign: Campaign) => void;
    onShowAnalytics: (id: string) => void;
    onEdit: (campaign: Campaign) => void;
    onEditSettings?: (campaign: Campaign) => void;
    isSelected?: boolean;
    onToggleSelection?: (id: string) => void;
    reachInboxConfigured?: boolean;
}

export function CampaignCard({
    campaign,
    onToggleStatus,
    onExecute,
    onArchive,
    onComplete,
    onViewMessages,
    onViewProspects,
    onAddProspects,
    onPushToReachInbox,
    onShowAnalytics,
    onEdit,
    onEditSettings,
    isSelected,
    onToggleSelection,
    reachInboxConfigured
}: CampaignCardProps) {
    const c = campaign;

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'active': return {
                label: 'Active',
                class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]',
                icon: CheckCircle
            };
            case 'paused': return {
                label: 'Paused',
                class: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                icon: Clock
            };
            case 'draft': return {
                label: 'Draft',
                class: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
                icon: FileText
            };
            case 'completed': return {
                label: 'Completed',
                class: 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)]',
                icon: CheckCircle
            };
            case 'archived': return {
                label: 'Archived',
                class: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
                icon: Archive
            };
            default: return {
                label: status.charAt(0).toUpperCase() + status.slice(1),
                class: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
                icon: FileText
            };
        }
    };

    const status = getStatusConfig(c.status);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4 }}
            className="group"
        >
            <Card className={cn(
                "relative overflow-hidden border transition-all duration-300 glass-effect hover:border-primary/40 shadow-xl hover:shadow-primary/5",
                isSelected && "border-primary/60 ring-1 ring-primary/20",
                c.status === 'draft' ? "opacity-90" : "opacity-100"
            )}>
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />

                <CardContent className="p-0">
                    {/* Header Section */}
                    <div className="p-5 pb-4">
                        <div className="flex justify-between items-start gap-4">
                            <div className="flex gap-3 min-w-0">
                                {c.status === 'draft' && onToggleSelection && (
                                    <div
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onToggleSelection(c.id);
                                        }}
                                        className={cn(
                                            "mt-1 w-5 h-5 rounded border-2 transition-all cursor-pointer flex items-center justify-center shrink-0",
                                            isSelected ? "bg-primary border-primary" : "border-muted-foreground/30 bg-background/50 hover:border-primary/50"
                                        )}
                                    >
                                        {isSelected && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <h3 className="text-lg font-medium tracking-tight text-foreground truncate group-hover:text-primary transition-colors">
                                        {c.name}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <Badge variant="outline" className={cn("px-2 py-0 h-5 rounded-full font-medium text-[9px] uppercase tracking-tighter flex items-center gap-1.5", status.class)}>
                                            <status.icon className="w-2.5 h-2.5" />
                                            {status.label}
                                        </Badge>
                                        <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest">
                                            {c.campaign_type || 'Connector'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Main Actions */}
                            <div className="flex items-center gap-1 shrink-0 relative z-10">
                                {c.status === 'active' ? (
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-amber-400 hover:bg-amber-400/10" onClick={() => onToggleStatus(c.id, c.status)}>
                                        <Pause className="h-4 w-4" />
                                    </Button>
                                ) : (
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-400 hover:bg-emerald-400/10" onClick={() => onToggleStatus(c.id, c.status)}>
                                        <Play className="h-4 w-4" />
                                    </Button>
                                )}

                                {(c.status === 'active' || c.status === 'paused') && (
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={() => onExecute(c.id)}>
                                        <Rocket className="h-4 w-4" />
                                    </Button>
                                )}

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button size="icon" variant="ghost" className="h-8 w-8">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-52 bg-card/90 backdrop-blur-xl border-border/40 shadow-2xl">
                                        {c.status !== 'completed' && (
                                            <DropdownMenuItem onClick={() => onAddProspects(c)} className="gap-2 cursor-pointer text-emerald-400 focus:text-emerald-400 focus:bg-emerald-400/10">
                                                <UserPlus className="w-4 h-4" /> Add Prospects
                                            </DropdownMenuItem>
                                        )}
                                        <DropdownMenuSeparator className="bg-border/40" />
                                        <DropdownMenuItem onClick={() => onShowAnalytics(c.id)} className="gap-2 cursor-pointer">
                                            <BarChart3 className="w-4 h-4 text-blue-400" /> Full Analytics
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onEdit(c)} disabled={c.status === 'archived'} className="gap-2 cursor-pointer">
                                            <Edit className="w-4 h-4 text-primary" /> Edit Messaging
                                        </DropdownMenuItem>
                                        {onEditSettings && (
                                            <DropdownMenuItem onClick={() => onEditSettings(c)} disabled={c.status === 'archived'} className="gap-2 cursor-pointer">
                                                <Settings className="w-4 h-4 text-blue-400" /> Edit Settings
                                            </DropdownMenuItem>
                                        )}
                                        <DropdownMenuSeparator className="bg-border/40" />
                                        <DropdownMenuItem onClick={() => onArchive(c.id)} className="gap-2 text-rose-400 focus:text-rose-400 focus:bg-rose-400/10 cursor-pointer">
                                            <Archive className="w-4 h-4" /> Archive Campaign
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onComplete(c.id)} disabled={c.status === 'completed' || c.status === 'archived'} className="gap-2 text-primary focus:text-primary focus:bg-primary/10 cursor-pointer">
                                            <CheckCircle className="w-4 h-4" /> Mark as Completed
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    </div>

                    {/* Stats Section */}
                    <div className="px-5 pb-5">
                        {c.status !== 'draft' ? (
                            <div className="grid grid-cols-4 gap-4 pt-4 border-t border-border/40 relative">
                                <div className="space-y-1">
                                    <div className="text-xl font-medium tracking-tight text-foreground">{c.sent || 0}</div>
                                    <div className="text-[9px] font-normal uppercase tracking-widest text-muted-foreground/60">Sent</div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-xl font-medium tracking-tight text-emerald-400">{c.connections || 0}</div>
                                    <div className="text-[9px] font-normal uppercase tracking-widest text-muted-foreground/60">Accepted</div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-xl font-medium tracking-tight text-blue-400">{c.replies || 0}</div>
                                    <div className="text-[9px] font-normal uppercase tracking-widest text-muted-foreground/60">Replied</div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-xl font-medium tracking-tight text-muted-foreground/30">0</div>
                                    <div className="text-[9px] font-normal uppercase tracking-widest text-muted-foreground/60">Failed</div>
                                </div>
                            </div>
                        ) : (
                            <div className="pt-4 border-t border-border/40 flex items-center justify-center h-12">
                                <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/40 italic">
                                    Ready for configuration
                                </span>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}
