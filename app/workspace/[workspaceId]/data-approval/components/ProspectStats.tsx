'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Users, UserCheck, UserX, Clock, FolderOpen } from "lucide-react";

import { cn } from "@/lib/utils";

interface ProspectStatsProps {
    total: number;
    approved: number;
    rejected: number;
    pending: number;
    lists?: number;
    className?: string;
}

export function ProspectStats({ total, approved, rejected, pending, lists = 0, className }: ProspectStatsProps) {
    const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;
    const pendingRate = total > 0 ? Math.round((pending / total) * 100) : 0;

    const stats = [
        {
            label: "Total Prospects",
            value: total.toLocaleString(),
            subLabel: `${pending} pending review`,
            icon: Users,
            color: "text-slate-400",
            bg: "bg-slate-500/10",
            border: "border-slate-500/20",
            glow: "shadow-[0_0_20px_rgba(148,163,184,0.1)]"
        },
        {
            label: "Lists",
            value: lists.toLocaleString(),
            subLabel: "CSV & Search active",
            icon: FolderOpen,
            color: "text-blue-400",
            bg: "bg-blue-500/10",
            border: "border-blue-500/20",
            glow: "shadow-[0_0_20px_rgba(59,130,246,0.1)]"
        },
        {
            label: "Approved",
            value: approved.toLocaleString(),
            subLabel: `${approvalRate}% quality rate`,
            icon: UserCheck,
            color: "text-emerald-400",
            bg: "bg-emerald-500/10",
            border: "border-emerald-500/20",
            glow: "shadow-[0_0_20px_rgba(16,185,129,0.1)]",
            progress: approvalRate,
            progressColor: "bg-emerald-500"
        },
        {
            label: "Pending",
            value: pending.toLocaleString(),
            subLabel: "Needs sampling",
            icon: Clock,
            color: "text-amber-400",
            bg: "bg-amber-500/10",
            border: "border-amber-500/20",
            glow: "shadow-[0_0_20px_rgba(245,158,11,0.1)]",
            progress: pendingRate,
            progressColor: "bg-amber-500"
        },
        {
            label: "Rejected",
            value: rejected.toLocaleString(),
            subLabel: "Unqualified leads",
            icon: UserX,
            color: "text-rose-400",
            bg: "bg-rose-500/10",
            border: "border-rose-500/20",
            glow: "shadow-[0_0_20px_rgba(244,63,94,0.1)]"
        }
    ];

    return (
        <div className={cn("grid gap-5 md:grid-cols-2 lg:grid-cols-5", className)}>
            {stats.map((stat, i) => (
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
                        <div className="text-3xl font-semibold tracking-tight text-foreground">
                            {stat.value}
                        </div>
                        {stat.progress !== undefined ? (
                            <div className="mt-3 space-y-1.5">
                                <Progress
                                    value={stat.progress}
                                    className="h-1.5 bg-background/50"
                                />
                                <div className="flex justify-between text-[10px] font-medium text-muted-foreground">
                                    <span>{stat.subLabel}</span>
                                    <span>{stat.progress}%</span>
                                </div>
                            </div>
                        ) : (
                            <p className="mt-1 text-[11px] font-medium text-muted-foreground/70">
                                {stat.subLabel}
                            </p>
                        )}
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
