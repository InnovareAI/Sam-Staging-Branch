'use client';

import React, { useState } from 'react';
import { FormPopup, SamInput, SamSelect } from './SamPopup';
import { Mail, User, Building2 } from 'lucide-react';

interface InviteUserPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: InviteFormData) => Promise<void>;
  workspaces?: Array<{ id: string; name: string; company: string }>;
}

export interface InviteFormData {
  email: string;
  firstName: string;
  lastName: string;
  company: 'InnovareAI' | '3cubedai';
  role: 'member' | 'admin' | 'owner';
  workspaceId?: string;
}

export default function InviteUserPopup({ 
  isOpen, 
  onClose, 
  onSubmit,
  workspaces = []
}: InviteUserPopupProps) {
  const [formData, setFormData] = useState<InviteFormData>({
    email: '',
    firstName: '',
    lastName: '',
    company: 'InnovareAI',
    role: 'member',
    workspaceId: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<InviteFormData>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<InviteFormData> = {};
    
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email format';
    
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.workspaceId) newErrors.workspaceId = 'Workspace selection is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      setFormData({
        email: '',
        firstName: '',
        lastName: '',
        company: 'InnovareAI',
        role: 'member',
        workspaceId: ''
      });
      setErrors({});
      onClose();
    } catch (error) {
      console.error('Invitation failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setFormData({
        email: '',
        firstName: '',
        lastName: '',
        company: 'InnovareAI',
        role: 'member',
        workspaceId: ''
      });
      setErrors({});
      onClose();
    }
  };

  const companyOptions = [
    { value: 'InnovareAI', label: 'InnovareAI' },
    { value: '3cubedai', label: '3CubedAI' }
  ];

  const roleOptions = [
    { value: 'member', label: 'Member' },
    { value: 'admin', label: 'Admin' },
    { value: 'owner', label: 'Owner' }
  ];

  const workspaceOptions = [
    { value: '', label: 'Select a workspace...' },
    ...workspaces.map(ws => ({ 
      value: ws.id, 
      label: `${ws.name}${ws.company ? ` (${ws.company})` : ws.slug ? ` (${ws.slug})` : ''}`
    }))
  ];

  // Debug logging
  console.log('InviteUserPopup workspaces:', workspaces);
  console.log('Workspace options:', workspaceOptions);

  return (
    <FormPopup
      isOpen={isOpen}
      onClose={handleClose}
      title="Invite User to SAM AI"
      onSubmit={handleSubmit}
      submitText={isSubmitting ? 'Sending Invitation...' : 'Send Invitation'}
      submitDisabled={isSubmitting}
      size="md"
    >
      {/* Header with icon */}
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
          <Mail className="text-white" size={24} />
        </div>
        <div>
          <h3 className="text-lg font-medium text-white">Send Invitation</h3>
          <p className="text-gray-400 text-sm">Invite a new user to join your SAM AI workspace</p>
        </div>
      </div>

      {/* Personal Information */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SamInput
            label="First Name"
            value={formData.firstName}
            onChange={(value) => setFormData({ ...formData, firstName: value })}
            placeholder="John"
            required
            disabled={isSubmitting}
            error={errors.firstName}
          />
          
          <SamInput
            label="Last Name"
            value={formData.lastName}
            onChange={(value) => setFormData({ ...formData, lastName: value })}
            placeholder="Doe"
            required
            disabled={isSubmitting}
            error={errors.lastName}
          />
        </div>

        <SamInput
          label="Email Address"
          type="email"
          value={formData.email}
          onChange={(value) => setFormData({ ...formData, email: value })}
          placeholder="john.doe@company.com"
          required
          disabled={isSubmitting}
          error={errors.email}
        />

        {/* Company and Role */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SamSelect
            label="Company"
            value={formData.company}
            onChange={(value) => setFormData({ ...formData, company: value as 'InnovareAI' | '3cubedai' })}
            options={companyOptions}
            required
            disabled={isSubmitting}
          />
          
          <SamSelect
            label="Role"
            value={formData.role}
            onChange={(value) => setFormData({ ...formData, role: value as 'member' | 'admin' | 'owner' })}
            options={roleOptions}
            required
            disabled={isSubmitting}
          />
        </div>

        {/* Workspace Selection - REQUIRED */}
        <SamSelect
          label="Target Workspace"
          value={formData.workspaceId || ''}
          onChange={(value) => setFormData({ ...formData, workspaceId: value })}
          options={workspaceOptions}
          required
          disabled={isSubmitting}
          error={errors.workspaceId}
        />

        {/* Company Badge */}
        <div className="flex items-center space-x-2 p-3 bg-gray-700 rounded-lg">
          <Building2 size={16} className="text-gray-400" />
          <span className="text-sm text-gray-300">
            Email will be sent from:{' '}
            <span className={`font-medium ${
              formData.company === 'InnovareAI' ? 'text-blue-400' : 'text-green-400'
            }`}>
              {formData.company === 'InnovareAI' ? 'sp@innovareai.com (Sarah Powell)' : 'sophia@3cubed.ai (Sophia)'}
            </span>
          </span>
        </div>
      </div>
    </FormPopup>
  );
}