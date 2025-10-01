'use client';

/**
 * LLM Configuration Modal
 * Simple model selection - choose which AI model powers SAM
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApprovedModel } from '@/lib/llm/approved-models';

interface LLMConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
}

export default function LLMConfigModal({ isOpen, onClose, onSave }: LLMConfigModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Simple configuration state
  const [selectedModel, setSelectedModel] = useState('anthropic/claude-sonnet-4.5');
  
  // Available models from API
  const [models, setModels] = useState<ApprovedModel[]>([]);
  const [modelsByProvider, setModelsByProvider] = useState<Record<string, ApprovedModel[]>>({});
  const [providers, setProviders] = useState<any[]>([]);

  // Load current preferences and models on mount
  useEffect(() => {
    if (isOpen) {
      loadPreferences();
      loadModels();
    }
  }, [isOpen]);

  const loadPreferences = async () => {
    try {
      const response = await fetch('/api/llm/preferences');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.preferences) {
          setSelectedModel(data.preferences.selected_model || 'anthropic/claude-sonnet-4.5');
        }
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }
  };

  const loadModels = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/llm/models');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setModels(data.models);
          setModelsByProvider(data.modelsByProvider);
          setProviders(data.providers);
        }
      }
    } catch (error) {
      console.error('Failed to load models:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleSave = async () => {
    setSaving(true);
    setError(null);
    
    try {
      const response = await fetch('/api/llm/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selected_model: selectedModel,
          enabled: true
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        onSave?.();
        onClose();
      } else {
        setError(data.error || 'Failed to save model selection');
      }
    } catch (err) {
      setError('Save failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const selectedModelInfo = models.find(m => m.id === selectedModel);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose AI Model</DialogTitle>
          <DialogDescription>
            Select which AI model powers SAM. All models are included at no extra cost.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Model Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">AI Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full p-3 border rounded-lg text-base"
              disabled={loading}
            >
              {Object.entries(modelsByProvider).map(([provider, providerModels]) => (
                <optgroup key={provider} label={providers.find(p => p.id === provider)?.name || provider}>
                  {providerModels.map(model => (
                    <option key={model.id} value={model.id}>
                      {model.name}{model.euHosted ? ' 🇪🇺' : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          
          {/* Model Info */}
          {selectedModelInfo && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="font-medium mb-2">{selectedModelInfo.name}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {selectedModelInfo.description}
              </div>
              <div className="flex gap-2 flex-wrap">
                {selectedModelInfo.capabilities.slice(0, 4).map(cap => (
                  <span key={cap} className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-xs rounded">
                    {cap}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-md bg-red-50 text-red-800">
              <div className="text-sm">{error}</div>
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50"
            disabled={saving}
          >
            Cancel
          </button>
          
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
