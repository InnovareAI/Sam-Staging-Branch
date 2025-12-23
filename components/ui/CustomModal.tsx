'use client';

import React from 'react';
import { X } from 'lucide-react';

interface CustomModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  className?: string;
}

export default function CustomModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  className = ''
}: CustomModalProps) {
  // Don't render if not open
  if (!isOpen) return null;

  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Size classes
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md', 
    lg: 'max-w-lg',
    xl: 'max-w-2xl'
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && closeOnOverlayClick) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={handleOverlayClick}
    >
      <div 
        className={`
          bg-surface-muted rounded-2xl shadow-2xl w-full ${sizeClasses[size]} max-h-[90vh] overflow-hidden
          transform transition-all duration-200 ease-out
          ${className}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || description || showCloseButton) && (
          <div className="relative p-6 pb-4 border-b border-gray-700">
            {showCloseButton && (
              <button
                onClick={onClose}
                className="absolute right-4 top-4 text-gray-400 hover:text-gray-200 transition-colors p-1 rounded-lg hover:bg-gray-700"
              >
                <X size={20} />
              </button>
            )}
            
            {title && (
              <h2 className="text-xl font-bold text-white mb-2 pr-8">
                {title}
              </h2>
            )}
            
            {description && (
              <p className="text-gray-400 text-sm">
                {description}
              </p>
            )}
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-8rem)]">
          {children}
        </div>
      </div>
    </div>
  );
}

// Convenience components for common modal patterns
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to continue?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'danger'
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'primary' | 'success';
}) {
  const variantClasses = {
    danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    primary: 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500',
    success: 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
  };

  return (
    <CustomModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
    >
      <div className="p-6">
        <p className="text-gray-300 mb-6">{message}</p>
        
        <div className="flex space-x-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors font-medium"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 text-white rounded-lg transition-colors font-medium focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 ${variantClasses[confirmVariant]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </CustomModal>
  );
}

export function InfoModal({
  isOpen,
  onClose,
  title = 'Information',
  message,
  buttonText = 'OK'
}: {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  buttonText?: string;
}) {
  return (
    <CustomModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
    >
      <div className="p-6">
        <p className="text-gray-300 mb-6">{message}</p>
        
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors font-medium focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800"
          >
            {buttonText}
          </button>
        </div>
      </div>
    </CustomModal>
  );
}

export function LoadingModal({
  isOpen,
  title = 'Loading...',
  message = 'Please wait while we process your request.'
}: {
  isOpen: boolean;
  title?: string;
  message?: string;
}) {
  return (
    <CustomModal
      isOpen={isOpen}
      onClose={() => {}} // Cannot be closed
      title={title}
      size="sm"
      showCloseButton={false}
      closeOnOverlayClick={false}
    >
      <div className="p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-500 border-t-transparent"></div>
          <p className="text-gray-300">{message}</p>
        </div>
      </div>
    </CustomModal>
  );
}

export function PromptModal({
  isOpen,
  onClose,
  onSubmit,
  title = 'Enter Value',
  message,
  placeholder = '',
  defaultValue = '',
  submitText = 'Submit',
  cancelText = 'Cancel',
  inputType = 'text',
  required = false
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title?: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  submitText?: string;
  cancelText?: string;
  inputType?: 'text' | 'textarea';
  required?: boolean;
}) {
  const [value, setValue] = React.useState(defaultValue);

  // Reset value when modal opens with new defaultValue
  React.useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
    }
  }, [isOpen, defaultValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (required && !value.trim()) return;
    onSubmit(value);
    onClose();
  };

  return (
    <CustomModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="p-6">
        {message && (
          <p className="text-gray-300 mb-4">{message}</p>
        )}

        {inputType === 'textarea' ? (
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            rows={4}
            autoFocus
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            autoFocus
          />
        )}

        <div className="flex space-x-3 justify-end mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors font-medium"
          >
            {cancelText}
          </button>
          <button
            type="submit"
            disabled={required && !value.trim()}
            className="px-4 py-2 text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors font-medium focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitText}
          </button>
        </div>
      </form>
    </CustomModal>
  );
}