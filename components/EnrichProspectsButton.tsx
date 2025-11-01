'use client';

import React, { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toastSuccess, toastError, toastInfo } from '@/lib/toast';

interface EnrichProspectsButtonProps {
  prospectIds: string[];
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
          autoEnrich: true
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Enrichment failed');
      }

      const data = await response.json();

      if (data.success) {
        const { enriched_count, failed_count, skipped_count } = data;

        if (enriched_count > 0) {
          toastSuccess(
            `✅ Successfully enriched ${enriched_count} prospect${enriched_count > 1 ? 's' : ''}!` +
            (failed_count > 0 ? `\n⚠️ ${failed_count} failed` : '') +
            (skipped_count > 0 ? `\nℹ️ ${skipped_count} already had complete data` : '')
          );
        } else if (skipped_count > 0) {
          toastInfo(`All ${skipped_count} prospect${skipped_count > 1 ? 's' : ''} already have complete data`);
        } else if (failed_count > 0) {
          toastError(`Failed to enrich ${failed_count} prospect${failed_count > 1 ? 's' : ''}`);
        }

        // Callback to refresh the prospect list
        if (onEnrichmentComplete) {
          onEnrichmentComplete();
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
