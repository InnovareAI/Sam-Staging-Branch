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
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Users,
    Search,
    UserPlus,
    Loader2,
    Briefcase,
    Building2,
    ListChecks,
    Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

// Types
import type { Campaign } from "@/types/campaign";

interface ProspectList {
    id: string;
    name: string;
    tag?: string;
    status: string;
    created_at: string;
    available_count: number;
    total_approved: number;
}

interface CampaignProspectsModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    campaign: Campaign | null;
    availableProspects: any[];
    availableLists?: ProspectList[];
    loading: boolean;
    loadingLists?: boolean;
    onAddProspects: (ids: string[]) => Promise<void>;
    onAddList?: (listId: string) => Promise<void>;
}

export function CampaignProspectsModal({
    isOpen,
    onOpenChange,
    campaign,
    availableProspects,
    availableLists = [],
    loading,
    loadingLists = false,
    onAddProspects,
    onAddList
}: CampaignProspectsModalProps) {
    const [activeTab, setActiveTab] = useState<'lists' | 'individual'>('lists');
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [selectedListId, setSelectedListId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const filteredProspects = availableProspects.filter(p => {
        const search = searchTerm.toLowerCase();
        return (
            p.first_name?.toLowerCase().includes(search) ||
            p.last_name?.toLowerCase().includes(search) ||
            p.company_name?.toLowerCase().includes(search) ||
            p.title?.toLowerCase().includes(search)
        );
    });

    const filteredLists = availableLists.filter(l => {
        const search = searchTerm.toLowerCase();
        return l.name.toLowerCase().includes(search) || l.tag?.toLowerCase().includes(search);
    });

    const toggleProspect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleAddIndividual = async () => {
        setIsSubmitting(true);
        try {
            await onAddProspects(selectedIds);
            onOpenChange(false);
            setSelectedIds([]);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddList = async () => {
        if (!selectedListId || !onAddList) return;
        setIsSubmitting(true);
        try {
            await onAddList(selectedListId);
            onOpenChange(false);
            setSelectedListId(null);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[85vh] p-0 overflow-hidden glass-effect shadow-2xl flex flex-col">
                <DialogHeader className="p-6 border-b border-border/40">
                    <div className="flex gap-4 items-center">
                        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                            <UserPlus className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-semibold tracking-tight">Add Prospects</DialogTitle>
                            <DialogDescription className="text-xs font-medium text-muted-foreground/60 uppercase tracking-widest mt-0.5">
                                Enroll leads into <span className="text-foreground">{campaign?.name}</span>
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {/* Tab Selection */}
                <div className="px-6 pt-4">
                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'lists' | 'individual')}>
                        <TabsList className="bg-muted/30 border border-border/40 p-1 rounded-xl h-10">
                            <TabsTrigger value="lists" className="rounded-lg h-8 px-4 data-[state=active]:bg-emerald-500 data-[state=active]:text-white text-xs font-medium">
                                <ListChecks className="w-3.5 h-3.5 mr-2" />
                                Lists ({availableLists.length})
                            </TabsTrigger>
                            <TabsTrigger value="individual" className="rounded-lg h-8 px-4 data-[state=active]:bg-emerald-500 data-[state=active]:text-white text-xs font-medium">
                                <Users className="w-3.5 h-3.5 mr-2" />
                                Individual ({availableProspects.length})
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                {/* Search */}
                <div className="px-6 py-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                        <Input
                            placeholder={activeTab === 'lists' ? "Search lists..." : "Search by name, company, or title..."}
                            className="pl-10 bg-background/40 border-border/40 font-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <ScrollArea className="flex-1">
                    {activeTab === 'lists' ? (
                        <div className="divide-y divide-border/20 px-2">
                            {loadingLists ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                                    <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/40">Loading Lists...</p>
                                </div>
                            ) : filteredLists.length > 0 ? (
                                filteredLists.map((list) => (
                                    <div
                                        key={list.id}
                                        className={cn(
                                            "flex items-center gap-4 p-4 mx-2 my-1 rounded-xl transition-all cursor-pointer hover:bg-emerald-500/5",
                                            selectedListId === list.id && "bg-emerald-500/10 ring-1 ring-emerald-500/30"
                                        )}
                                        onClick={() => setSelectedListId(list.id === selectedListId ? null : list.id)}
                                    >
                                        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                            <ListChecks className="w-5 h-5 text-emerald-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-medium text-sm text-foreground truncate">{list.name}</h4>
                                            <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground/60 font-medium">
                                                <span className="flex items-center gap-1">
                                                    <Users className="w-3 h-3" />
                                                    {list.available_count} available
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {formatDate(list.created_at)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-lg font-semibold text-emerald-400">{list.available_count}</div>
                                            <div className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/40">prospects</div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 opacity-40">
                                    <ListChecks className="w-12 h-12 mb-4" />
                                    <p className="text-xs font-medium uppercase tracking-widest">No available lists found</p>
                                    <p className="text-[10px] text-muted-foreground/60 mt-1">Import prospects to create lists</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="divide-y divide-border/20">
                            {/* Bulk Selection Controls */}
                            <div className="px-6 py-3 bg-muted/10 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-[10px] font-medium uppercase tracking-wider border-border/40 hover:bg-emerald-500/10 hover:text-emerald-400"
                                        onClick={() => setSelectedIds(filteredProspects.map(p => p.id))}
                                        disabled={filteredProspects.length === 0}
                                    >
                                        Select All ({filteredProspects.length})
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60"
                                        onClick={() => setSelectedIds([])}
                                        disabled={selectedIds.length === 0}
                                    >
                                        Clear
                                    </Button>
                                </div>
                            </div>

                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                                    <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/40">Loading Prospects...</p>
                                </div>
                            ) : filteredProspects.length > 0 ? (
                                filteredProspects.map((prospect) => (
                                    <div
                                        key={prospect.id}
                                        className={cn(
                                            "flex items-center gap-4 p-4 transition-all cursor-pointer hover:bg-emerald-500/5",
                                            selectedIds.includes(prospect.id) && "bg-emerald-500/10"
                                        )}
                                        onClick={() => toggleProspect(prospect.id)}
                                    >
                                        <Checkbox
                                            checked={selectedIds.includes(prospect.id)}
                                            onCheckedChange={() => toggleProspect(prospect.id)}
                                            className="rounded-md border-border/40 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <h4 className="font-medium text-sm text-foreground truncate">{prospect.first_name} {prospect.last_name}</h4>
                                                {prospect.email && (
                                                    <span className="text-[9px] font-medium uppercase tracking-tighter text-emerald-400/80 bg-emerald-400/10 px-1.5 py-0.5 rounded">Has Email</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground/60 font-medium">
                                                <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" /> {prospect.title || 'No Title'}</span>
                                                <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {prospect.company_name || 'No Company'}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 opacity-40">
                                    <Users className="w-12 h-12 mb-4" />
                                    <p className="text-xs font-medium uppercase tracking-widest">No matching prospects found</p>
                                </div>
                            )}
                        </div>
                    )}
                </ScrollArea>

                <DialogFooter className="p-6 border-t border-border/40 bg-muted/20 flex flex-row items-center justify-between shrink-0">
                    <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60 whitespace-nowrap">
                        {activeTab === 'lists'
                            ? (selectedListId ? `1 list selected` : 'Select a list')
                            : `${selectedIds.length} selected`
                        }
                    </span>
                    <div className="flex gap-3">
                        <Button variant="ghost" className="font-medium uppercase tracking-widest text-[10px]" onClick={() => onOpenChange(false)}>Cancel</Button>
                        {activeTab === 'lists' ? (
                            <Button
                                disabled={!selectedListId || isSubmitting || !onAddList}
                                onClick={handleAddList}
                                className="bg-emerald-500 text-white hover:bg-emerald-600 font-medium uppercase tracking-tight shadow-[0_0_20px_rgba(16,185,129,0.2)] min-w-[140px]"
                            >
                                {isSubmitting ? "Adding..." : "Add Entire List"}
                            </Button>
                        ) : (
                            <Button
                                disabled={selectedIds.length === 0 || isSubmitting}
                                onClick={handleAddIndividual}
                                className="bg-emerald-500 text-white hover:bg-emerald-600 font-medium uppercase tracking-tight shadow-[0_0_20px_rgba(16,185,129,0.2)] min-w-[140px]"
                            >
                                {isSubmitting ? "Adding..." : `Add ${selectedIds.length} Leads`}
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
