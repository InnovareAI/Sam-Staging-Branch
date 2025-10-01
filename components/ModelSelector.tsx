'use client';

/**
 * Simple Model Selector
 * Just shows current model with option to change - no usage stats or costs
 */

import React, { useState, useEffect } from 'react';

interface ModelSelectorProps {
  onChangeClick?: () => void;
}

export default function ModelSelector({ onChangeClick }: ModelSelectorProps) {
  const [currentModel, setCurrentModel] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCurrentModel();
  }, []);

  const loadCurrentModel = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/llm/preferences');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.modelInfo) {
          setCurrentModel(data.modelInfo);
        }
      }
    } catch (error) {
      console.error('Failed to load current model:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
        <div className="h-6 bg-gray-200 rounded w-48"></div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-500 mb-1">AI Model</div>
          <div className="text-lg font-semibold">
            {currentModel?.name || 'Claude Sonnet 4.5'}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {currentModel?.provider ? `by ${currentModel.provider}` : 'by Anthropic'}
          </div>
        </div>
        
        {onChangeClick && (
          <button
            onClick={onChangeClick}
            className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Change Model
          </button>
        )}
      </div>
    </div>
  );
}
