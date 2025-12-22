'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toastError, toastSuccess } from '@/lib/toast';
import { Loader2 } from 'lucide-react';

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
            if (data.success && data.campaigns) {
                // Filter for active/draft campaigns generally, depending on business logic
                setCampaigns(data.campaigns);
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
                // Handle conflicts warning
                if (data.error === 'campaign_conflict') {
                    // For now just error, later could show specific conflict UI
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

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add to Campaign</DialogTitle>
                    <DialogDescription>
                        Select a campaign to add {prospectIds.length} selected prospect{prospectIds.length !== 1 ? 's' : ''} to.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {fetching ? (
                        <div className="flex justify-center p-4">
                            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                        </div>
                    ) : (
                        <div className="grid gap-2">
                            <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a campaign" />
                                </SelectTrigger>
                                <SelectContent>
                                    {campaigns.length === 0 ? (
                                        <div className="p-2 text-sm text-gray-500 text-center">No campaigns found</div>
                                    ) : (
                                        campaigns.map((campaign) => (
                                            <SelectItem key={campaign.id} value={campaign.id}>
                                                {campaign.name} ({campaign.status})
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleAdd} disabled={!selectedCampaignId || loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Add to Campaign
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
