'use client';

/**
 * Prospect Validation Badge Component
 * Shows validation status with DARK RED for invalid prospects
 */

import React from 'react';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  severity: 'valid' | 'warning' | 'error';
}

interface ProspectValidationBadgeProps {
  validation?: ValidationResult;
  hasPreviousContact?: boolean;
  previousStatus?: string;
  className?: string;
}

export function ProspectValidationBadge({
  validation,
  hasPreviousContact,
  previousStatus,
  className = ''
}: ProspectValidationBadgeProps) {
  // Determine status
  let status: 'valid' | 'warning' | 'error' | 'blocked' = 'valid';
  let message = 'Valid';
  let description = '';

  if (hasPreviousContact) {
    status = 'blocked';
    message = 'Previously Contacted';
    description = previousStatus ? `Previous status: ${previousStatus}` : 'Already contacted in another campaign';
  } else if (validation) {
    if (!validation.isValid) {
      status = 'error';
      message = 'Invalid';
      description = validation.errors[0] || 'Missing required fields';
    } else if (validation.warnings.length > 0) {
      status = 'warning';
      message = 'Incomplete';
      description = validation.warnings[0] || 'Missing optional data';
    }
  }

  // Style classes
  const styles = {
    valid: {
      badge: 'bg-green-100 text-green-800 border-green-300',
      dot: 'bg-green-500'
    },
    warning: {
      badge: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      dot: 'bg-yellow-500'
    },
    error: {
      badge: 'bg-red-900 text-white border-red-900 font-semibold', // DARK RED
      dot: 'bg-red-500'
    },
    blocked: {
      badge: 'bg-red-900 text-white border-red-900 font-semibold', // DARK RED
      dot: 'bg-red-700'
    }
  };

  const currentStyle = styles[status];

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border ${currentStyle.badge}`}
        title={description}
      >
        <span className={`w-2 h-2 rounded-full ${currentStyle.dot}`} />
        {message}
      </span>
      {description && status !== 'valid' && (
        <span className="text-xs text-gray-600 max-w-xs truncate" title={description}>
          {description}
        </span>
      )}
    </div>
  );
}

/**
 * Prospect Validation Details Panel
 * Shows full validation errors/warnings
 */
interface ProspectValidationDetailsProps {
  validation: ValidationResult;
  hasPreviousContact?: boolean;
  previousCampaign?: string;
  previousStatus?: string;
}

export function ProspectValidationDetails({
  validation,
  hasPreviousContact,
  previousCampaign,
  previousStatus
}: ProspectValidationDetailsProps) {
  return (
    <div className="space-y-3">
      {/* Previous Contact Warning */}
      {hasPreviousContact && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-red-900">Previously Contacted</h4>
              <p className="text-sm text-red-700 mt-1">
                This prospect was already contacted{previousCampaign && ` in campaign: ${previousCampaign}`}.
                {previousStatus && ` Status: ${previousStatus}`}
              </p>
              <p className="text-xs text-red-600 mt-2 font-medium">
                ⚠️ Cannot add to campaign - would violate contact policy
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Validation Errors */}
      {validation.errors.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <h4 className="text-sm font-semibold text-red-900 mb-2">Errors (Must Fix)</h4>
          <ul className="space-y-1">
            {validation.errors.map((error, idx) => (
              <li key={idx} className="text-sm text-red-700 flex items-start gap-2">
                <span className="text-red-500 font-semibold">•</span>
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Validation Warnings */}
      {validation.warnings.length > 0 && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="text-sm font-semibold text-yellow-900 mb-2">Warnings (Optional)</h4>
          <ul className="space-y-1">
            {validation.warnings.map((warning, idx) => (
              <li key={idx} className="text-sm text-yellow-700 flex items-start gap-2">
                <span className="text-yellow-500">•</span>
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Success State */}
      {validation.isValid && validation.warnings.length === 0 && !hasPreviousContact && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-700">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium">All checks passed - ready for campaign</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Prospect Table Row with Validation Highlight
 * Use this to wrap table rows to highlight invalid prospects
 */
interface ProspectRowProps {
  children: React.ReactNode;
  validation?: ValidationResult;
  hasPreviousContact?: boolean;
  className?: string;
}

export function ProspectRow({
  children,
  validation,
  hasPreviousContact,
  className = ''
}: ProspectRowProps) {
  const isInvalid = hasPreviousContact || (validation && !validation.isValid);

  return (
    <tr
      className={`
        ${isInvalid ? 'bg-red-900/10 border-l-4 border-red-900' : ''}
        ${className}
      `}
    >
      {children}
    </tr>
  );
}
