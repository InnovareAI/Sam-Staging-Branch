'use client';

/**
 * KB Validation Panel
 * Displays KB items needing validation with validate/correct/reject actions
 */

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { InfoModal, PromptModal } from '@/components/ui/CustomModal';

interface KBItemToValidate {
  kb_item_id: string;
  title: string;
  content: any;
  category: string;
  confidence_score: number;
  source_type: string;
  validation_status: string;
  created_at: string;
  priority_score: number;
}

interface ValidationPanelProps {
  workspaceId: string;
  threshold?: number;
  onValidationComplete?: () => void;
}

export default function KBValidationPanel({
  workspaceId,
  threshold = 0.8,
  onValidationComplete
}: ValidationPanelProps) {
  const [items, setItems] = useState<KBItemToValidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [correctionMode, setCorrectionMode] = useState<string | null>(null);
  const [correctionValue, setCorrectionValue] = useState<any>({});
  const [correctionReason, setCorrectionReason] = useState('');

  // Info modal state (replaces native browser alert)
  const [infoModal, setInfoModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({ isOpen: false, title: '', message: '' });

  const showInfo = (title: string, message: string) => {
    setInfoModal({ isOpen: true, title, message });
  };

  // Prompt modal state for rejection reason (replaces native browser prompt)
  const [rejectingItemId, setRejectingItemId] = useState<string | null>(null);

  const supabase = createClientComponentClient();

  // Fetch items needing validation
  useEffect(() => {
    fetchValidationItems();
  }, [workspaceId, threshold]);

  async function fetchValidationItems() {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/kb/validate?workspace_id=${workspaceId}&threshold=${threshold}`
      );
      const data = await response.json();

      if (data.success) {
        setItems(data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch validation items:', error);
    } finally {
      setLoading(false);
    }
  }

  // Validate item (mark as confirmed)
  async function handleValidate(kbItemId: string) {
    setValidating(kbItemId);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const response = await fetch('/api/kb/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kb_item_id: kbItemId,
          action: 'validate',
          workspace_id: workspaceId,
          user_id: user?.id
        })
      });

      const result = await response.json();

      if (result.success) {
        setItems(items.filter(item => item.kb_item_id !== kbItemId));
        onValidationComplete?.();
      } else {
        showInfo('Validation Failed', result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Validation error:', error);
      showInfo('Error', 'Failed to validate item');
    } finally {
      setValidating(null);
    }
  }

  // Reject item (deactivate)
  async function handleReject(kbItemId: string, reason: string) {
    setValidating(kbItemId);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const response = await fetch('/api/kb/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kb_item_id: kbItemId,
          action: 'reject',
          reason,
          workspace_id: workspaceId,
          user_id: user?.id
        })
      });

      const result = await response.json();

      if (result.success) {
        setItems(items.filter(item => item.kb_item_id !== kbItemId));
        onValidationComplete?.();
      } else {
        showInfo('Rejection Failed', result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Rejection error:', error);
      showInfo('Error', 'Failed to reject item');
    } finally {
      setValidating(null);
    }
  }

  // Correct item (update with corrected value)
  async function handleCorrect(kbItemId: string) {
    setValidating(kbItemId);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const response = await fetch('/api/kb/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kb_item_id: kbItemId,
          action: 'correct',
          corrected_value: correctionValue,
          reason: correctionReason,
          workspace_id: workspaceId,
          user_id: user?.id
        })
      });

      const result = await response.json();

      if (result.success) {
        setItems(items.filter(item => item.kb_item_id !== kbItemId));
        setCorrectionMode(null);
        setCorrectionValue({});
        setCorrectionReason('');
        onValidationComplete?.();
      } else {
        showInfo('Correction Failed', result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Correction error:', error);
      showInfo('Error', 'Failed to correct item');
    } finally {
      setValidating(null);
    }
  }

  // Get priority badge color
  function getPriorityColor(priority: number): string {
    if (priority >= 0.8) return 'bg-red-100 text-red-800 border-red-300';
    if (priority >= 0.5) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-blue-100 text-blue-800 border-blue-300';
  }

  // Get priority label
  function getPriorityLabel(priority: number): string {
    if (priority >= 0.8) return 'Critical';
    if (priority >= 0.5) return 'High';
    return 'Medium';
  }

  // Get confidence badge color
  function getConfidenceColor(confidence: number): string {
    if (confidence >= 0.8) return 'bg-green-100 text-green-800';
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading validation items...</span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center p-8 bg-green-50 border border-green-200 rounded-lg">
        <p className="text-green-800 font-medium">All KB items validated!</p>
        <p className="text-green-600 text-sm mt-1">No items need validation at this time.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Items Needing Validation ({items.length})
        </h3>
        <button
          onClick={fetchValidationItems}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          Refresh
        </button>
      </div>

      {items.map((item) => (
        <div
          key={item.kb_item_id}
          className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-1 text-xs font-medium rounded border ${getPriorityColor(item.priority_score)}`}>
                  {getPriorityLabel(item.priority_score)}
                </span>
                <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                  {item.category}
                </span>
                <span className={`px-2 py-1 text-xs font-medium rounded ${getConfidenceColor(item.confidence_score)}`}>
                  {Math.round(item.confidence_score * 100)}% confidence
                </span>
              </div>
              <h4 className="font-medium text-gray-900">{item.title || 'Untitled'}</h4>
              <p className="text-sm text-gray-500">Source: {item.source_type}</p>
            </div>
          </div>

          {/* Content */}
          <div className="mb-3 p-3 bg-gray-50 rounded border border-gray-200">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
              {typeof item.content === 'string'
                ? item.content
                : JSON.stringify(item.content, null, 2)}
            </pre>
          </div>

          {/* Correction Mode */}
          {correctionMode === item.kb_item_id ? (
            <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Corrected Content
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={4}
                value={correctionValue.content || ''}
                onChange={(e) => setCorrectionValue({ ...correctionValue, content: e.target.value })}
                placeholder="Enter corrected content..."
              />
              <label className="block text-sm font-medium text-gray-700 mt-3 mb-2">
                Reason for Correction
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                placeholder="Why is this correction needed?"
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleCorrect(item.kb_item_id)}
                  disabled={!correctionValue.content || validating === item.kb_item_id}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {validating === item.kb_item_id ? 'Saving...' : 'Save Correction'}
                </button>
                <button
                  onClick={() => {
                    setCorrectionMode(null);
                    setCorrectionValue({});
                    setCorrectionReason('');
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {/* Actions */}
          {correctionMode !== item.kb_item_id && (
            <div className="flex gap-2">
              <button
                onClick={() => handleValidate(item.kb_item_id)}
                disabled={validating === item.kb_item_id}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
              >
                {validating === item.kb_item_id ? 'Validating...' : 'Validate'}
              </button>
              <button
                onClick={() => {
                  setCorrectionMode(item.kb_item_id);
                  setCorrectionValue({ content: typeof item.content === 'string' ? item.content : JSON.stringify(item.content, null, 2) });
                }}
                disabled={validating === item.kb_item_id}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
              >
                Correct
              </button>
              <button
                onClick={() => setRejectingItemId(item.kb_item_id)}
                disabled={validating === item.kb_item_id}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
              >
                Reject
              </button>
              <button
                onClick={() => setShowHistory(showHistory === item.kb_item_id ? null : item.kb_item_id)}
                className="ml-auto px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
              >
                {showHistory === item.kb_item_id ? 'Hide' : 'Show'} History
              </button>
            </div>
          )}

          {/* Version History */}
          {showHistory === item.kb_item_id && (
            <div className="mt-4 border-t border-gray-200 pt-4">
              <KBVersionHistory kbItemId={item.kb_item_id} />
            </div>
          )}
        </div>
      ))}

      {/* Info Modal - replaces native browser alert() */}
      <InfoModal
        isOpen={infoModal.isOpen}
        onClose={() => setInfoModal(prev => ({ ...prev, isOpen: false }))}
        title={infoModal.title}
        message={infoModal.message}
      />

      {/* Prompt Modal - replaces native browser prompt() for rejection reason */}
      <PromptModal
        isOpen={rejectingItemId !== null}
        onClose={() => setRejectingItemId(null)}
        onSubmit={(reason) => {
          if (rejectingItemId && reason.trim()) {
            handleReject(rejectingItemId, reason);
          }
          setRejectingItemId(null);
        }}
        title="Reject KB Item"
        message="Please provide a reason for rejecting this item:"
        placeholder="Enter rejection reason..."
        submitText="Reject"
        required
      />
    </div>
  );
}

/**
 * KB Version History Component
 */
interface KBVersionHistoryProps {
  kbItemId: string;
}

function KBVersionHistory({ kbItemId }: KBVersionHistoryProps) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [kbItemId]);

  async function fetchHistory() {
    setLoading(true);
    try {
      const response = await fetch(`/api/kb/versions?kb_item_id=${kbItemId}&limit=10`);
      const data = await response.json();

      if (data.success) {
        setHistory(data.versions || []);
      }
    } catch (error) {
      console.error('Failed to fetch version history:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Loading version history...</div>;
  }

  if (history.length === 0) {
    return <div className="text-sm text-gray-500">No version history available</div>;
  }

  return (
    <div className="space-y-3">
      <h5 className="text-sm font-semibold text-gray-900">Version History</h5>
      {history.map((version, idx) => (
        <div key={idx} className="text-sm border-l-2 border-gray-300 pl-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-gray-900">v{version.version_number}</span>
            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
              {version.change_type}
            </span>
            <span className="text-gray-500 text-xs">
              {new Date(version.created_at).toLocaleString()}
            </span>
          </div>
          {version.created_by_name && (
            <p className="text-gray-600 text-xs">by {version.created_by_name}</p>
          )}
          {version.changed_fields && version.changed_fields.length > 0 && (
            <p className="text-gray-600 text-xs mt-1">
              Changed: {version.changed_fields.join(', ')}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
