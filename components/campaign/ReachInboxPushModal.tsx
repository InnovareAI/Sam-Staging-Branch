'use client';

import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Send,
    Loader2,
    Info
} from "lucide-react";

// Types
import type { Campaign } from "@/types/campaign";

interface ReachInboxPushModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    campaign: Campaign | null;
    reachInboxCampaigns: any[];
    loading: boolean;
    pushing: boolean;
    onPush: (reachInboxId: string) => Promise<void>;
}

export function ReachInboxPushModal({
    isOpen,
    onOpenChange,
    campaign,
    reachInboxCampaigns,
    loading,
    pushing,
    onPush
}: ReachInboxPushModalProps) {
    const [selectedId, setSelectedId] = useState("");

    const handlePush = async () => {
        if (!selectedId) return;
        await onPush(selectedId);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md glass-effect shadow-2xl p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 border-b border-border/40">
                    <div className="flex gap-4 items-center">
                        <div className="p-3 rounded-2xl bg-pink-500/10 border border-pink-500/20">
                            <Send className="w-6 h-6 text-pink-400" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-black tracking-tight uppercase">Distribute Leads</DialogTitle>
                            <DialogDescription className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest mt-0.5">
                                Push to ReachInbox for multi-channel outreach
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-6 space-y-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                            <Loader2 className="w-8 h-8 text-pink-400 animate-spin" />
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Syncing External Campaigns...</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 ml-1">Destination Campaign</label>
                                <Select value={selectedId} onValueChange={setSelectedId}>
                                    <SelectTrigger className="bg-background/40 border-border/40 h-12 font-bold focus:ring-pink-500/20">
                                        <SelectValue placeholder="Search ReachInbox campaigns" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border/40 backdrop-blur-3xl">
                                        {reachInboxCampaigns.map((c) => (
                                            <SelectItem key={c.id} value={c.id} className="font-medium">
                                                {c.name} <span className="opacity-40 text-[10px] ml-2 font-bold uppercase tracking-tighter">({c.status})</span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="p-4 rounded-2xl bg-muted/30 border border-border/20 space-y-2">
                                <div className="flex justify-between items-center text-[11px] font-semibold">
                                    <span className="text-muted-foreground/60">Source Campaign:</span>
                                    <span className="text-foreground">{campaign?.name}</span>
                                </div>
                                <div className="flex justify-between items-center text-[11px] font-semibold">
                                    <span className="text-muted-foreground/60">Lead Count:</span>
                                    <span className="text-pink-400 font-black">{campaign?.total_prospects || campaign?.prospects_count || 'Syncing...'}</span>
                                </div>
                            </div>

                            <div className="flex gap-2.5 p-3 rounded-xl bg-pink-400/5 border border-pink-400/10">
                                <Info className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
                                <p className="text-[10px] font-medium leading-relaxed text-muted-foreground/80">
                                    Distributing leads will sync names, emails, and job titles. Only leads with verified email addresses will be transferred.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-6 border-t border-border/40 bg-muted/20 flex flex-row gap-3">
                    <Button variant="ghost" className="flex-1 font-bold uppercase tracking-widest text-[10px]" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button
                        disabled={!selectedId || pushing || loading}
                        onClick={handlePush}
                        className="flex-[2] bg-pink-500 text-white hover:bg-pink-600 font-black uppercase tracking-tighter shadow-[0_0_20px_rgba(236,72,153,0.3)]"
                    >
                        {pushing ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Transferring...
                            </>
                        ) : (
                            "Start Distribution"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
