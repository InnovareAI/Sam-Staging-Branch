'use client';

import { useEffect, useState } from 'react';
import { registerToastListener, unregisterToastListener } from '@/lib/toast';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

interface Toast {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    // Register listener for toast updates
    registerToastListener(setToasts);

    return () => {
      unregisterToastListener();
    };
  }, []);

  const removeToast = (index: number) => {
    setToasts(prev => prev.filter((_, i) => i !== index));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {toasts.map((toast, index) => (
        <div
          key={index}
          className={`
            flex items-start gap-3 p-4 rounded-lg shadow-lg backdrop-blur-sm
            animate-in slide-in-from-right duration-300
            ${toast.type === 'success' ? 'bg-green-500/90 text-white' : ''}
            ${toast.type === 'error' ? 'bg-red-500/90 text-white' : ''}
            ${toast.type === 'warning' ? 'bg-yellow-500/90 text-gray-900' : ''}
            ${toast.type === 'info' ? 'bg-blue-500/90 text-white' : ''}
          `}
        >
          {/* Icon */}
          <div className="flex-shrink-0 mt-0.5">
            {toast.type === 'success' && <CheckCircle className="w-5 h-5" />}
            {toast.type === 'error' && <XCircle className="w-5 h-5" />}
            {toast.type === 'warning' && <AlertTriangle className="w-5 h-5" />}
            {toast.type === 'info' && <Info className="w-5 h-5" />}
          </div>

          {/* Message */}
          <div className="flex-1 text-sm font-medium">
            {toast.message}
          </div>

          {/* Close button */}
          <button
            onClick={() => removeToast(index)}
            className="flex-shrink-0 hover:opacity-70 transition-opacity"
            aria-label="Close notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
