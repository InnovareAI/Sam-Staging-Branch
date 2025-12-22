'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Users, UserCheck, UserX, Clock } from "lucide-react";

interface ProspectStatsProps {
    total: number;
    approved: number;
    rejected: number;
    pending: number;
}

export function ProspectStats({ total, approved, rejected, pending }: ProspectStatsProps) {
    const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;
    const pendingRate = total > 0 ? Math.round((pending / total) * 100) : 0;

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Prospects</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{total.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                        {pending} pending review
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Approved</CardTitle>
                    <UserCheck className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{approved.toLocaleString()}</div>
                    <Progress value={approvalRate} className="mt-2 h-1.5" indicatorColor="bg-green-500" />
                    <p className="text-xs text-muted-foreground mt-1">
                        {approvalRate}% approval rate
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Pending</CardTitle>
                    <Clock className="h-4 w-4 text-yellow-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{pending.toLocaleString()}</div>
                    <Progress value={pendingRate} className="mt-2 h-1.5" indicatorColor="bg-yellow-500" />
                    <p className="text-xs text-muted-foreground mt-1">
                        Needs attention
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Rejected</CardTitle>
                    <UserX className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{rejected.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                        Duplicates or unqualified
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
