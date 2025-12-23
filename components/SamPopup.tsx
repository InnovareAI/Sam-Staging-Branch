'use client';

import React from 'react';
import { X } from 'lucide-react';

interface SamPopupProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
  className?: string;
}

export default function SamPopup({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md',
  showCloseButton = true,
  className = ''
}: SamPopupProps) {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop - More subtle, workspace-style */}
      <div 
        className="absolute inset-0 bg-background/90 backdrop-blur-md"
        onClick={onClose}
      />
      
      {/* Popup - Workspace panel styling */}
      <div className={`
        relative w-full ${sizeClasses[size]} mx-4 
        bg-surface-muted rounded-lg border border-gray-600
        shadow-xl shadow-black/30
        transform transition-all duration-300 ease-out
        ${className}
      `}>
        {/* Header - Workspace panel style */}
        <div className="flex items-center justify-between p-6 border-b border-gray-600 bg-gray-700/50">
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          {showCloseButton && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 transition-colors p-2 rounded-md hover:bg-gray-700"
            >
              <X size={18} />
            </button>
          )}
        </div>
        
        {/* Content */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

// Reusable popup variants for common use cases
interface ConfirmPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'primary' | 'success';
}

export function ConfirmPopup({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'primary'
}: ConfirmPopupProps) {
  const confirmClasses = {
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    primary: 'bg-purple-600 hover:bg-purple-700 text-white',
    success: 'bg-green-600 hover:bg-green-700 text-white'
  };

  return (
    <SamPopup isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-6">
        <p className="text-gray-300">{message}</p>
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-6 py-2 text-gray-300 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors font-medium"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-6 py-2 rounded-lg transition-colors font-medium ${confirmClasses[confirmVariant]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </SamPopup>
  );
}

// Form popup wrapper
interface FormPopupProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  onSubmit: (e: React.FormEvent) => void;
  submitText?: string;
  submitDisabled?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function FormPopup({
  isOpen,
  onClose,
  title,
  children,
  onSubmit,
  submitText = 'Submit',
  submitDisabled = false,
  size = 'md'
}: FormPopupProps) {
  return (
    <SamPopup isOpen={isOpen} onClose={onClose} title={title} size={size}>
      <form onSubmit={onSubmit} className="space-y-6">
        {children}
        
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-600">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 text-gray-300 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitDisabled}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
          >
            {submitText}
          </button>
        </div>
      </form>
    </SamPopup>
  );
}

// Input field component for forms
interface SamInputProps {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
}

export function SamInput({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  error
}: SamInputProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className={`
          w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600
          focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
          disabled:bg-surface-muted disabled:cursor-not-allowed
          ${error ? 'border-red-500 focus:ring-red-500' : ''}
        `}
      />
      {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
    </div>
  );
}

// Select field component
interface SamSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  disabled?: boolean;
  error?: string;
}

export function SamSelect({
  label,
  value,
  onChange,
  options,
  required = false,
  disabled = false,
  error
}: SamSelectProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        className={`
          w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600
          focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
          disabled:bg-surface-muted disabled:cursor-not-allowed
          ${error ? 'border-red-500 focus:ring-red-500' : ''}
        `}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
    </div>
  );
}