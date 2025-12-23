'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toastError, toastSuccess } from '@/lib/toast';
import { Loader2, FolderPlus } from 'lucide-react';

interface AddToCampaignModalProps {
    open: boolean;
    onClose: () => void;
    workspaceId: string;
    prospectIds: string[];
    onSuccess: () => void;
}

interface Campaign {
    id: string;
    name: string;
    status: string;
    type: string;
}

export function AddToCampaignModal({ open, onClose, workspaceId, prospectIds, onSuccess }: AddToCampaignModalProps) {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);

    useEffect(() => {
        if (open && workspaceId) {
            fetchCampaigns();
        }
    }, [open, workspaceId]);

    const fetchCampaigns = async () => {
        setFetching(true);
        try {
            const response = await fetch(`/api/campaigns?workspace_id=${workspaceId}`);
            if (!response.ok) throw new Error('Failed to fetch campaigns');
            const data = await response.json();
            const fetchedCampaigns = data.data?.campaigns || data.campaigns || [];
            if (data.success) {
                setCampaigns(fetchedCampaigns);
            }
        } catch (error) {
            console.error(error);
            toastError("Failed to load campaigns");
        } finally {
            setFetching(false);
        }
    };

    const handleAdd = async () => {
        if (!selectedCampaignId) return;
        setLoading(true);
        try {
            const response = await fetch('/api/campaigns/add-approved-prospects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspace_id: workspaceId,
                    campaign_id: selectedCampaignId,
                    prospect_ids: prospectIds
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to add prospects to campaign');
            }

            if (data.success) {
                toastSuccess(`Successfully added ${data.added_count} prospects to the campaign.`);
                onSuccess();
                onClose();
            } else {
                if (data.error === 'campaign_conflict') {
                    toastError(data.message || 'Some prospects are already in other campaigns.');
                } else {
                    toastError(data.message || 'Failed to add prospects');
                }
            }

        } catch (error) {
            console.error(error);
            toastError(error instanceof Error ? error.message : "Failed to add prospects to campaign");
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setSelectedCampaignId('');
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[450px] bg-background border-border">
                <DialogHeader>
                    <DialogTitle className="text-white text-lg font-semibold flex items-center gap-2">
                        <FolderPlus className="h-5 w-5 text-blue-400" />
                        Add to Campaign
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Select a campaign to add {prospectIds.length} selected prospect{prospectIds.length !== 1 ? 's' : ''} to.
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-4 space-y-4">
                    {fetching ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        </div>
                    ) : (
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Select Campaign
                            </label>
                            <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                                <SelectTrigger className="bg-surface-muted border-border text-foreground">
                                    <SelectValue placeholder="Choose a campaign..." />
                                </SelectTrigger>
                                <SelectContent className="bg-surface-muted border-border">
                                    {campaigns.length === 0 ? (
                                        <div className="p-4 text-sm text-gray-400 text-center">
                                            No campaigns found. Create one first.
                                        </div>
                                    ) : (
                                        campaigns.map((campaign) => (
                                            <SelectItem
                                                key={campaign.id}
                                                value={campaign.id}
                                                className="text-white hover:bg-gray-700 focus:bg-gray-700"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span>{campaign.name}</span>
                                                    <span className="text-xs text-muted-foreground">({campaign.status})</span>
                                                </div>
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                <div className="flex gap-3 mt-6">
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={loading}
                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white border-gray-600"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleAdd}
                        disabled={!selectedCampaignId || loading}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-foreground"
                    >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Add to Campaign
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
