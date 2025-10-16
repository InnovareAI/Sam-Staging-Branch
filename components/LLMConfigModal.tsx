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
  const [selectedModel, setSelectedModel] = useState('anthropic/claude-haiku-4.5');
  const [customApiKey, setCustomApiKey] = useState('');
  const [customEndpoint, setCustomEndpoint] = useState('');

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
          setSelectedModel(data.preferences.selected_model || 'anthropic/claude-haiku-4.5');

          // Load custom endpoint config if present
          if (data.preferences.custom_endpoint_config) {
            setCustomEndpoint(data.preferences.custom_endpoint_config.endpoint || '');
            setCustomApiKey(data.preferences.custom_endpoint_config.api_key || '');
          }
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

    // Validate custom endpoint config if custom model selected
    if (selectedModel === 'custom/enterprise-llm') {
      if (!customEndpoint || !customApiKey) {
        setError('Please provide both endpoint URL and API key for custom LLM');
        setSaving(false);
        return;
      }
    }

    try {
      const payload: any = {
        selected_model: selectedModel,
        enabled: true
      };

      // Include custom endpoint config if custom model is selected
      if (selectedModel === 'custom/enterprise-llm') {
        payload.use_custom_endpoint = true;
        payload.custom_endpoint_config = {
          endpoint: customEndpoint,
          api_key: customApiKey,
          provider: 'custom'
        };
      } else {
        payload.use_custom_endpoint = false;
        payload.custom_endpoint_config = null;
      }

      const response = await fetch('/api/llm/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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
              <div className="font-medium text-gray-900 dark:text-gray-100 mb-2">{selectedModelInfo.name}</div>
              <div className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                {selectedModelInfo.description}
              </div>
              <div className="flex gap-2 flex-wrap">
                {selectedModelInfo.capabilities.slice(0, 4).map(cap => (
                  <span key={cap} className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded">
                    {cap}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Custom LLM Configuration */}
          {selectedModel === 'custom/enterprise-llm' && (
            <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="text-sm text-blue-900 dark:text-blue-100 font-medium mb-3">
                Configure Your Custom LLM Endpoint
              </div>

              <div>
                <label className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 block">
                  API Endpoint URL
                </label>
                <input
                  type="url"
                  value={customEndpoint}
                  onChange={(e) => setCustomEndpoint(e.target.value)}
                  placeholder="https://your-api.example.com/v1/chat/completions"
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                  disabled={loading || saving}
                />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  OpenAI-compatible endpoint (Azure OpenAI, AWS Bedrock, self-hosted)
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 block">
                  API Key
                </label>
                <input
                  type="password"
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm font-mono"
                  disabled={loading || saving}
                />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Your API key is encrypted and never shared
                </p>
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
