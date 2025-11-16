'use client';

import React, { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toastSuccess, toastError, toastInfo } from '@/lib/toast';

interface EnrichProspectsButtonProps {
  prospectIds: string[];
  workspaceId: string;
  onEnrichmentComplete?: () => void;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

/**
 * EnrichProspectsButton - Manual enrichment trigger for prospects with missing data
 *
 * Triggers BrightData MCP enrichment for prospects with missing company/location/industry.
 * Supports single prospect or multi-select batch enrichment.
 */
export default function EnrichProspectsButton({
  prospectIds,
  workspaceId,
  onEnrichmentComplete,
  variant = 'outline',
  size = 'sm',
  className = ''
}: EnrichProspectsButtonProps) {
  const [isEnriching, setIsEnriching] = useState(false);

  const handleEnrich = async () => {
    if (prospectIds.length === 0) {
      toastError('No prospects selected for enrichment');
      return;
    }

    setIsEnriching(true);

    try {
      toastInfo(`Enriching ${prospectIds.length} prospect${prospectIds.length > 1 ? 's' : ''}...`);

      const response = await fetch('/api/prospects/enrich', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prospectIds,
          workspaceId,
          autoEnrich: true
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Enrichment API Error:', errorData);
        const errorMsg = [
          errorData.error,
          errorData.details,
          errorData.hint,
          errorData.code
        ].filter(Boolean).join(' | ');
        throw new Error(errorMsg || 'Enrichment failed');
      }

      const data = await response.json();

      if (data.success) {
        // Check if enrichment was queued vs completed
        if (data.status === 'queued' || data.queued_count > 0) {
          const queuedCount = data.queued_count || prospectIds.length;
          toastInfo(
            `⏳ Enrichment queued for ${queuedCount} prospect(s).\n\nN8N workflow will process them in the background. Check back in a few minutes.`,
            10000
          );
        } else {
          // Use API-provided message if available, otherwise build default message
          const message = data.message ||
            `✅ Successfully enriched ${data.enriched_count || 0} prospect(s)!\n\nRefresh the page to see updated data.`;

          toastSuccess(message, 8000);
        }

        // Call callback to clear selections
        if (onEnrichmentComplete) {
          onEnrichmentComplete();
        }

        // DO NOT auto-reload - let user control when to refresh
      } else {
        toastError(data.error || 'Enrichment failed');
      }

    } catch (error) {
      console.error('Enrichment error:', error);
      toastError(error instanceof Error ? error.message : 'Failed to enrich prospects');
    } finally {
      setIsEnriching(false);
    }
  };

  if (prospectIds.length === 0) {
    return null;
  }

  return (
    <Button
      onClick={handleEnrich}
      disabled={isEnriching}
      variant={variant}
      size={size}
      className={`flex items-center gap-2 ${className}`}
    >
      {isEnriching ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Enriching...</span>
        </>
      ) : (
        <>
          <Sparkles className="w-4 h-4" />
          <span>
            Enrich {prospectIds.length > 1 ? `${prospectIds.length} prospects` : 'prospect'}
          </span>
        </>
      )}
    </Button>
  );
}
