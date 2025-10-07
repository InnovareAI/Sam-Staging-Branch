/**
 * Global Toast Notification System
 * Replacement for alert() calls throughout the application
 */

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
  type: ToastType;
  message: string;
  duration?: number; // milliseconds, default 5000
}

// Global toast container - will be managed by React component
let toastQueue: ToastOptions[] = [];
let toastListener: ((toasts: ToastOptions[]) => void) | null = null;

/**
 * Register a listener for toast updates (used by ToastContainer component)
 */
export function registerToastListener(listener: (toasts: ToastOptions[]) => void) {
  toastListener = listener;
  // Immediately notify of any queued toasts
  if (toastQueue.length > 0) {
    listener(toastQueue);
  }
}

/**
 * Unregister the toast listener
 */
export function unregisterToastListener() {
  toastListener = null;
}

/**
 * Show a toast notification
 */
export function toast(message: string, type: ToastType = 'info', duration: number = 5000) {
  const newToast: ToastOptions = { type, message, duration };

  toastQueue.push(newToast);

  // Notify listener if registered
  if (toastListener) {
    toastListener([...toastQueue]);
  }

  // Auto-remove after duration
  setTimeout(() => {
    toastQueue = toastQueue.filter(t => t !== newToast);
    if (toastListener) {
      toastListener([...toastQueue]);
    }
  }, duration);
}

/**
 * Convenience methods for different toast types
 */
export const toastSuccess = (message: string, duration?: number) =>
  toast(message, 'success', duration);

export const toastError = (message: string, duration?: number) =>
  toast(message, 'error', duration);

export const toastWarning = (message: string, duration?: number) =>
  toast(message, 'warning', duration);

export const toastInfo = (message: string, duration?: number) =>
  toast(message, 'info', duration);

/**
 * Remove all toasts
 */
export function clearToasts() {
  toastQueue = [];
  if (toastListener) {
    toastListener([]);
  }
}
