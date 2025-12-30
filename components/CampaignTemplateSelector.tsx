'use client';

import React, { useState, useEffect } from 'react';
import { CampaignTemplate } from '@/lib/campaign-templates';

interface CampaignTemplateSelectorProps {
  onTemplateSelect: (template: CampaignTemplate) => void;
  onCustomCreate: () => void;
  isVisible: boolean;
  onClose: () => void;
}

const CampaignTemplateSelector: React.FC<CampaignTemplateSelectorProps> = ({
  onTemplateSelect,
  onCustomCreate,
  isVisible,
  onClose
}) => {
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<CampaignTemplate | null>(null);

  useEffect(() => {
    if (isVisible) {
      fetchTemplates();
    }
  }, [isVisible]);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/campaigns/templates');
      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = selectedType === 'all' 
    ? templates 
    : templates.filter(t => t.type === selectedType);

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'linkedin_connection': return 'Connection + Follow-ups';
      case 'linkedin_dm': return 'Direct Messages';
      case 'group_message': return 'Group Messages';
      case 'company_follow': return 'Company Follow';
      default: return type;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'linkedin_connection': return '🤝';
      case 'linkedin_dm': return '💬';
      case 'group_message': return '👥';
      case 'company_follow': return '🏢';
      default: return '📋';
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Choose Campaign Template</h2>
            <p className="text-gray-600 mt-1">Select a proven template or create custom campaign</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="border-b bg-gray-50">
          <div className="flex space-x-1 p-2">
            <button
              onClick={() => setSelectedType('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedType === 'all' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All Templates ({templates.length})
            </button>
            {['linkedin_connection', 'linkedin_dm', 'group_message', 'company_follow'].map(type => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedType === type 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {getTypeIcon(type)} {getTypeLabel(type)}
              </button>
            ))}
          </div>
        </div>

        {/* Templates Grid */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Custom Template Option */}
              <div 
                onClick={onCustomCreate}
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-all"
              >
                <div className="text-center">
                  <div className="text-4xl mb-3">🤖</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Create with SAM AI</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    Let SAM create a custom campaign based on your specific needs and goals
                  </p>
                  <div className="inline-flex items-center text-blue-600 text-sm font-medium">
                    <span>Create Custom Campaign</span>
                    <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Template Cards */}
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => setSelectedTemplate(template)}
                  className={`border rounded-lg p-6 cursor-pointer transition-all hover:shadow-lg ${
                    selectedTemplate?.id === template.id 
                      ? 'border-blue-500 bg-blue-50 shadow-md' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">{getTypeIcon(template.type)}</span>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
                        <p className="text-blue-600 text-sm font-medium">{getTypeLabel(template.type)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Response Rate</div>
                      <div className="text-lg font-semibold text-green-600">{template.expected_response_rate}</div>
                    </div>
                  </div>

                  <p className="text-gray-600 text-sm mb-4">{template.description}</p>

                  <div className="space-y-3">
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-1">Campaign Flow:</div>
                      <div className="flex flex-wrap gap-1">
                        {template.steps.map((step, index) => (
                          <span 
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-700"
                          >
                            {index + 1}. {step.type.replace('_', ' ')}
                            {step.delay_days > 0 && <span className="ml-1 text-gray-500">(+{step.delay_days}d)</span>}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-1">Best For:</div>
                      <div className="flex flex-wrap gap-1">
                        {template.use_cases.map((useCase, index) => (
                          <span 
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-700"
                          >
                            {useCase}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <div className="text-sm text-gray-500">
                        {template.steps.length} steps • {template.settings.daily_limit} daily limit
                      </div>
                      {selectedTemplate?.id === template.id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onTemplateSelect(template);
                          }}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                        >
                          Use This Template
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Template Preview (if selected) */}
        {selectedTemplate && (
          <div className="border-t bg-gray-50 p-6">
            <div className="max-w-4xl">
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Template Preview</h4>
              <div className="space-y-3">
                {selectedTemplate.steps.slice(0, 2).map((step, index) => (
                  <div key={index} className="bg-white rounded-lg p-4 border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        Step {step.step_number}: {step.type.replace('_', ' ')}
                      </span>
                      {step.delay_days > 0 && (
                        <span className="text-xs text-gray-500">After {step.delay_days} days</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 bg-gray-50 rounded p-3">
                      {step.message_template}
                    </div>
                  </div>
                ))}
                {selectedTemplate.steps.length > 2 && (
                  <div className="text-center text-sm text-gray-500">
                    ... and {selectedTemplate.steps.length - 2} more steps
                  </div>
                )}
              </div>
              
              <div className="flex justify-end mt-4 space-x-3">
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Back to Templates
                </button>
                <button
                  onClick={() => onTemplateSelect(selectedTemplate)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Use This Template
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignTemplateSelector;