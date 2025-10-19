'use client';

import React from 'react';
import { AlertTriangle, CheckCircle, Info, XCircle, X } from 'lucide-react';

export type ConfirmType = 'danger' | 'warning' | 'info' | 'success';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: ConfirmType;
}

const typeConfig = {
  danger: {
    icon: XCircle,
    iconColor: 'text-red-400',
    bgGradient: 'from-red-900/20 to-red-800/10',
    borderColor: 'border-red-800/30',
    confirmButton: 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-red-500/20 hover:shadow-red-500/30',
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-yellow-400',
    bgGradient: 'from-yellow-900/20 to-yellow-800/10',
    borderColor: 'border-yellow-800/30',
    confirmButton: 'bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 shadow-yellow-500/20 hover:shadow-yellow-500/30',
  },
  info: {
    icon: Info,
    iconColor: 'text-blue-400',
    bgGradient: 'from-blue-900/20 to-blue-800/10',
    borderColor: 'border-blue-800/30',
    confirmButton: 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-purple-500/20 hover:shadow-purple-500/30',
  },
  success: {
    icon: CheckCircle,
    iconColor: 'text-green-400',
    bgGradient: 'from-green-900/20 to-green-800/10',
    borderColor: 'border-green-800/30',
    confirmButton: 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-green-500/20 hover:shadow-green-500/30',
  },
};

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning',
}: ConfirmModalProps) {
  const config = typeConfig[type];
  const IconComponent = config.icon;

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 max-w-md w-full transform transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with Icon */}
          <div className={`bg-gradient-to-br ${config.bgGradient} border-b ${config.borderColor} p-6`}>
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-12 h-12 rounded-xl bg-gray-800/50 flex items-center justify-center ${config.borderColor} border`}>
                <IconComponent className={config.iconColor} size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-white mb-1">{title}</h3>
              </div>
              <button
                onClick={onClose}
                className="flex-shrink-0 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800/50 p-1"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">
              {message}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 p-6 pt-0">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium transition-all duration-200 border border-gray-700 hover:border-gray-600"
            >
              {cancelText}
            </button>
            <button
              onClick={handleConfirm}
              className={`flex-1 px-4 py-3 text-white rounded-lg font-medium transition-all duration-200 shadow-lg ${config.confirmButton}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
