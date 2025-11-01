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

      const response = await fetch('/api/prospects/enrich-async', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prospectIds,
          workspaceId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Enrichment failed');
      }

      const data = await response.json();

      if (data.success) {
        toastSuccess(
          `✅ Enrichment job created! Processing ${data.total_prospects} prospect${data.total_prospects > 1 ? 's' : ''} in background...`
        );

        // Callback to refresh the prospect list after a delay
        if (onEnrichmentComplete) {
          setTimeout(() => {
            onEnrichmentComplete();
          }, 60000); // Refresh after 60 seconds
        }
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
