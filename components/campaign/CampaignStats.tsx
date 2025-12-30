'use client';

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Rocket,
    MessageCircle,
    Send,
    CheckCircle,
    TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Updated interface to accept pre-calculated stats for performance
interface CampaignStatsData {
    total: number;
    active: number;
    paused: number;
    completed: number;
    sent: number;
    connected: number;
    replied: number;
}

interface CampaignStatsProps {
    stats: CampaignStatsData;
    className?: string;
}

export function CampaignStats({ stats, className }: CampaignStatsProps) {
    const replyRate = stats.sent > 0 ? Math.round((stats.replied / stats.sent) * 100) : 0;
    const connectRate = stats.sent > 0 ? Math.round((stats.connected / stats.sent) * 100) : 0;

    const statCards = [
        {
            label: "Total Campaigns",
            value: stats.total.toLocaleString(),
            subLabel: `${stats.active} active, ${stats.paused} paused`,
            icon: Rocket,
            color: "text-primary",
            bg: "bg-primary/10",
            border: "border-primary/20",
            glow: "shadow-[0_0_20px_rgba(var(--primary),0.1)]"
        },
        {
            label: "Messages Sent",
            value: stats.sent.toLocaleString(),
            subLabel: "Total volume across all",
            icon: Send,
            color: "text-blue-400",
            bg: "bg-blue-500/10",
            border: "border-blue-500/20",
            glow: "shadow-[0_0_20px_rgba(59,130,246,0.1)]"
        },
        {
            label: "Connection Rate",
            value: `${connectRate}%`,
            subLabel: `${stats.connected} new connections`,
            icon: CheckCircle,
            color: "text-amber-400",
            bg: "bg-amber-500/10",
            border: "border-amber-500/20",
            glow: "shadow-[0_0_20px_rgba(245,158,11,0.1)]"
        },
        {
            label: "Engagement Rate",
            value: `${replyRate}%`,
            subLabel: `${stats.replied} total replies`,
            icon: MessageCircle,
            color: "text-emerald-400",
            bg: "bg-emerald-500/10",
            border: "border-emerald-500/20",
            glow: "shadow-[0_0_20px_rgba(16,185,129,0.1)]",
            trend: replyRate > 15 ? "positive" : "stable"
        }
    ];

    return (
        <div className={cn("grid gap-5 md:grid-cols-2 lg:grid-cols-4", className)}>
            {statCards.map((stat, i) => (
                <Card key={i} className={cn(
                    "relative overflow-hidden border transition-all duration-300 hover:scale-[1.02] hover:shadow-xl",
                    stat.bg,
                    stat.border,
                    stat.glow
                )}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">
                            {stat.label}
                        </CardTitle>
                        <stat.icon className={cn("h-4 w-4", stat.color)} />
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <div className="text-3xl font-semibold tracking-tight text-foreground">
                                {stat.value}
                            </div>
                            {stat.trend === "positive" && (
                                <div className="flex items-center text-xs font-medium text-emerald-400">
                                    <TrendingUp className="h-3 w-3 mr-1" />
                                    HIGH
                                </div>
                            )}
                        </div>
                        <p className="mt-1 text-[11px] font-medium text-muted-foreground/70">
                            {stat.subLabel}
                        </p>
                    </CardContent>

                    {/* Decorative Background Glow */}
                    <div className={cn(
                        "absolute -right-4 -top-4 h-16 w-16 rounded-full blur-3xl opacity-20",
                        stat.bg
                    )} />
                </Card>
            ))}
        </div>
    );
}
