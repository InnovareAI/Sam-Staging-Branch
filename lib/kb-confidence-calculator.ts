/**
 * KB Confidence Score Calculator
 * Assigns confidence scores based on data source and quality
 */

export type ConfidenceSource = 'user_input' | 'website_auto' | 'document_upload' | 'ai_inference' | 'sam_discovery';

export interface ConfidenceMetadata {
  sources?: number; // Number of sources confirming the data
  model_confidence?: number; // AI model's self-assessed confidence
  user_confirmed?: boolean; // User explicitly confirmed this
  extraction_quality?: 'high' | 'medium' | 'low'; // Document extraction quality
}

/**
 * Calculate confidence score based on source type
 */
export function calculateConfidenceScore(
  sourceType: ConfidenceSource,
  metadata?: ConfidenceMetadata
): number {
  switch (sourceType) {
    case 'user_input':
    case 'sam_discovery':
      // Highest confidence - user explicitly provided
      return metadata?.user_confirmed ? 1.0 : 0.95;

    case 'document_upload':
      // High confidence - from official documents
      if (metadata?.extraction_quality === 'high') return 0.95;
      if (metadata?.extraction_quality === 'medium') return 0.85;
      if (metadata?.extraction_quality === 'low') return 0.70;
      return 0.90; // Default for document upload

    case 'website_auto':
      // Medium-high confidence - depends on source count
      const sources = metadata?.sources || 1;
      const baseScore = 0.65;
      const bonusPerSource = 0.10;
      return Math.min(baseScore + (sources * bonusPerSource), 0.95);

    case 'ai_inference':
      // Medium confidence - AI made an educated guess
      return metadata?.model_confidence || 0.60;

    default:
      return 0.50; // Default moderate confidence
  }
}

/**
 * Determine validation status based on confidence and source
 */
export function getInitialValidationStatus(
  confidence: number,
  sourceType: ConfidenceSource
): 'pending' | 'validated' {
  // Auto-validate high-confidence user inputs
  if (sourceType === 'user_input' && confidence >= 0.95) {
    return 'validated';
  }

  // Auto-validate SAM discovery inputs
  if (sourceType === 'sam_discovery' && confidence >= 0.90) {
    return 'validated';
  }

  // Everything else needs validation
  return 'pending';
}

/**
 * Get validation priority (lower = more urgent)
 */
export function getValidationPriority(
  confidence: number,
  sourceType: ConfidenceSource,
  category: string
): number {
  let priority = 50; // Base priority

  // Critical categories get higher priority
  const criticalCategories = ['icp', 'products', 'messaging', 'pricing'];
  if (criticalCategories.includes(category)) {
    priority -= 20;
  }

  // Lower confidence = higher priority
  priority += Math.round((1 - confidence) * 30);

  // AI inference needs more validation
  if (sourceType === 'ai_inference') {
    priority -= 10;
  }

  return Math.max(0, priority);
}

/**
 * Format confidence score for display
 */
export function formatConfidenceForDisplay(confidence: number): {
  percentage: string;
  label: string;
  color: 'green' | 'yellow' | 'orange' | 'red';
} {
  const percentage = `${Math.round(confidence * 100)}%`;

  if (confidence >= 0.9) {
    return { percentage, label: 'Very High', color: 'green' };
  } else if (confidence >= 0.75) {
    return { percentage, label: 'High', color: 'green' };
  } else if (confidence >= 0.60) {
    return { percentage, label: 'Medium', color: 'yellow' };
  } else if (confidence >= 0.40) {
    return { percentage, label: 'Low', color: 'orange' };
  } else {
    return { percentage, label: 'Very Low', color: 'red' };
  }
}

/**
 * Check if item needs validation
 */
export function needsValidation(
  confidence: number,
  validationStatus: string,
  category: string
): boolean {
  // Already validated
  if (validationStatus === 'validated') return false;

  // Critical categories with low confidence need validation
  const criticalCategories = ['icp', 'products', 'messaging', 'pricing'];
  if (criticalCategories.includes(category) && confidence < 0.8) {
    return true;
  }

  // Any item with very low confidence needs validation
  if (confidence < 0.6) {
    return true;
  }

  return false;
}
