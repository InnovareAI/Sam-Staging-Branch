'use client';

import React, { useState } from 'react';
import {
  Target, ArrowLeft, Plus, Edit2, Save, X,
  Building2, Globe, TrendingUp, Users, Shield,
  MessageSquare, DollarSign, BarChart, Zap
} from 'lucide-react';

interface ICPProfile {
  id: string;
  name: string;
  icp_name?: string;
  company_demographics?: {
    employee_count?: string[];
    revenue_range?: string[];
    growth_stage?: string[];
  };
  geographic_focus?: {
    primary_markets?: string[];
    regional_preferences?: string[];
    expansion_markets?: string[];
  };
  industry_segmentation?: {
    primary_industries?: string[];
    secondary_industries?: string[];
  };
  technology_infrastructure?: {
    required_tech_stack?: string[];
    preferred_platforms?: string[];
    security_requirements?: string[];
  };
  decision_makers?: any;
  pain_points?: any;
  buying_process?: any;
  messaging_strategy?: any;
  success_metrics?: any;
  advanced_classification?: any;
}

interface EditableFieldProps {
  label: string;
  values: string[];
  onUpdate: (newValues: string[]) => void;
  colorClass?: string;
}

function EditableTagField({ label, values, onUpdate, colorClass = 'bg-gray-600' }: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const handleAdd = () => {
    if (editValue.trim()) {
      onUpdate([...values, editValue.trim()]);
      setEditValue('');
    }
  };

  const handleRemove = (index: number) => {
    onUpdate(values.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-gray-300 text-sm font-medium">{label}</label>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1"
        >
          {isEditing ? <X size={12} /> : <Edit2 size={12} />}
          {isEditing ? 'Done' : 'Edit'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-2">
        {values.length === 0 ? (
          <span className="text-gray-500 text-sm italic">No data - click Edit to add</span>
        ) : (
          values.map((value, index) => (
            <span
              key={index}
              className={`${colorClass} text-white px-3 py-1 rounded-full text-xs flex items-center gap-1`}
            >
              {value}
              {isEditing && (
                <button
                  onClick={() => handleRemove(index)}
                  className="hover:text-red-300 ml-1"
                >
                  <X size={12} />
                </button>
              )}
            </span>
          ))
        )}
      </div>

      {isEditing && (
        <div className="flex gap-2">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Type and press Enter"
            className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-1 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleAdd}
            disabled={!editValue.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white px-3 py-1 rounded text-sm transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function ICPConfigEditable({
  profile,
  onUpdate,
  onBack
}: {
  profile: ICPProfile;
  onUpdate: (updates: Partial<ICPProfile>) => Promise<void>;
  onBack: () => void;
}) {
  const [activeCategory, setActiveCategory] = useState('target_profile');
  const [saving, setSaving] = useState(false);

  const handleFieldUpdate = async (section: string, field: string, value: any) => {
    setSaving(true);
    try {
      await onUpdate({
        [section]: {
          ...profile[section as keyof ICPProfile],
          [field]: value
        }
      });
    } finally {
      setSaving(false);
    }
  };

  const categories = [
    { id: 'target_profile', label: 'Target Profile', icon: Building2 },
    { id: 'decision_makers', label: 'Decision Makers', icon: Users },
    { id: 'pain_points', label: 'Pain Points', icon: TrendingUp },
    { id: 'buying_process', label: 'Buying Process', icon: BarChart },
    { id: 'messaging', label: 'Messaging Strategy', icon: MessageSquare },
    { id: 'success_metrics', label: 'Success Metrics', icon: DollarSign },
    { id: 'advanced', label: 'Advanced', icon: Zap },
  ];

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg">
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <h2 className="text-2xl font-semibold text-white flex items-center">
              <Target className="mr-2" size={24} />
              {profile.name || profile.icp_name || 'ICP Configuration'}
            </h2>
          </div>
          {saving && (
            <span className="text-sm text-gray-400">Saving...</span>
          )}
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeCategory === cat.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <cat.icon size={16} />
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeCategory === 'target_profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Company Demographics */}
            <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
              <h3 className="text-white font-medium mb-4 flex items-center">
                <Building2 className="mr-2" size={16} />
                Company Demographics
              </h3>
              <div className="space-y-4">
                <EditableTagField
                  label="Employee Count"
                  values={profile.company_demographics?.employee_count || []}
                  onUpdate={(values) => handleFieldUpdate('company_demographics', 'employee_count', values)}
                  colorClass="bg-gray-600"
                />
                <EditableTagField
                  label="Revenue Range"
                  values={profile.company_demographics?.revenue_range || []}
                  onUpdate={(values) => handleFieldUpdate('company_demographics', 'revenue_range', values)}
                  colorClass="bg-gray-600"
                />
                <EditableTagField
                  label="Growth Stage"
                  values={profile.company_demographics?.growth_stage || []}
                  onUpdate={(values) => handleFieldUpdate('company_demographics', 'growth_stage', values)}
                  colorClass="bg-blue-600"
                />
              </div>
            </div>

            {/* Geographic Focus */}
            <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
              <h3 className="text-white font-medium mb-4 flex items-center">
                <Globe className="mr-2" size={16} />
                Geographic Focus
              </h3>
              <div className="space-y-4">
                <EditableTagField
                  label="Primary Markets"
                  values={profile.geographic_focus?.primary_markets || []}
                  onUpdate={(values) => handleFieldUpdate('geographic_focus', 'primary_markets', values)}
                  colorClass="bg-green-600"
                />
                <EditableTagField
                  label="Regional Preferences"
                  values={profile.geographic_focus?.regional_preferences || []}
                  onUpdate={(values) => handleFieldUpdate('geographic_focus', 'regional_preferences', values)}
                  colorClass="bg-green-600"
                />
                <EditableTagField
                  label="Expansion Markets"
                  values={profile.geographic_focus?.expansion_markets || []}
                  onUpdate={(values) => handleFieldUpdate('geographic_focus', 'expansion_markets', values)}
                  colorClass="bg-purple-600"
                />
              </div>
            </div>

            {/* Industry Segmentation */}
            <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
              <h3 className="text-white font-medium mb-4 flex items-center">
                <TrendingUp className="mr-2" size={16} />
                Industry & Market Segmentation
              </h3>
              <div className="space-y-4">
                <EditableTagField
                  label="Primary Industries"
                  values={profile.industry_segmentation?.primary_industries || []}
                  onUpdate={(values) => handleFieldUpdate('industry_segmentation', 'primary_industries', values)}
                  colorClass="bg-orange-600"
                />
                <EditableTagField
                  label="Secondary Industries"
                  values={profile.industry_segmentation?.secondary_industries || []}
                  onUpdate={(values) => handleFieldUpdate('industry_segmentation', 'secondary_industries', values)}
                  colorClass="bg-orange-500"
                />
              </div>
            </div>

            {/* Technology & Infrastructure */}
            <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
              <h3 className="text-white font-medium mb-4 flex items-center">
                <Shield className="mr-2" size={16} />
                Technology & Infrastructure
              </h3>
              <div className="space-y-4">
                <EditableTagField
                  label="Required Tech Stack"
                  values={profile.technology_infrastructure?.required_tech_stack || []}
                  onUpdate={(values) => handleFieldUpdate('technology_infrastructure', 'required_tech_stack', values)}
                  colorClass="bg-indigo-600"
                />
                <EditableTagField
                  label="Preferred Platforms"
                  values={profile.technology_infrastructure?.preferred_platforms || []}
                  onUpdate={(values) => handleFieldUpdate('technology_infrastructure', 'preferred_platforms', values)}
                  colorClass="bg-indigo-500"
                />
                <EditableTagField
                  label="Security Requirements"
                  values={profile.technology_infrastructure?.security_requirements || []}
                  onUpdate={(values) => handleFieldUpdate('technology_infrastructure', 'security_requirements', values)}
                  colorClass="bg-red-600"
                />
              </div>
            </div>
          </div>
        )}

        {activeCategory !== 'target_profile' && (
          <div className="text-center py-12">
            <p className="text-gray-400">
              Section "{categories.find(c => c.id === activeCategory)?.label}" coming soon
            </p>
            <p className="text-gray-500 text-sm mt-2">
              Focus on Target Profile fields for now
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
