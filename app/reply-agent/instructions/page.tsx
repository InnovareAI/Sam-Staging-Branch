'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function AddInstructionsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const draftId = searchParams.get('id');
  const token = searchParams.get('token');

  const [draft, setDraft] = useState<any>(null);
  const [instructions, setInstructions] = useState('');
  const [newDraft, setNewDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (draftId && token) {
      fetchDraft();
    }
  }, [draftId, token]);

  async function fetchDraft() {
    try {
      const res = await fetch(`/api/reply-agent/draft?id=${draftId}&token=${token}`);
      if (!res.ok) throw new Error('Failed to fetch draft');
      const data = await res.json();
      setDraft(data.draft);
      setNewDraft(data.draft.draft_text);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegenerate() {
    if (!instructions.trim()) {
      setError('Please provide instructions');
      return;
    }

    setRegenerating(true);
    setError('');
    try {
      const res = await fetch('/api/reply-agent/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId,
          token,
          instructions: instructions.trim(),
        }),
      });
      if (!res.ok) throw new Error('Failed to regenerate');
      const data = await res.json();
      setNewDraft(data.newDraftText);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRegenerating(false);
    }
  }

  async function handleApproveAndSend() {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/reply-agent/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action: 'approve',
          editedText: newDraft,
        }),
      });
      if (!res.ok) throw new Error('Failed to send reply');
      setSuccess('Reply sent successfully!');
      setTimeout(() => router.push('/reply-agent-result?status=success'), 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading draft...</div>
      </div>
    );
  }

  if (error && !draft) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md">
          <h1 className="text-xl font-semibold text-red-600 mb-2">Error</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-500 to-indigo-600 px-6 py-4">
            <h1 className="text-xl font-semibold text-white">Add Instructions</h1>
            <p className="text-purple-100 text-sm">
              Tell SAM how to improve the reply
            </p>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Prospect Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-700 mb-2">Replying to</h3>
              <p className="text-gray-900">{draft?.prospect_name}</p>
              <p className="text-gray-500 text-sm">
                {draft?.prospect_title} at {draft?.prospect_company}
              </p>
            </div>

            {/* Their Message */}
            <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-500">
              <h3 className="font-medium text-gray-700 mb-2">Their Message</h3>
              <p className="text-gray-800">{draft?.inbound_message_text}</p>
            </div>

            {/* Instructions Input */}
            <div>
              <label className="block font-medium text-gray-700 mb-2">
                Your Instructions to SAM
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full h-32 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                placeholder="e.g., Make it shorter, mention our pricing, ask about their current solution, be more casual..."
              />
              <button
                onClick={handleRegenerate}
                disabled={regenerating || !instructions.trim()}
                className="mt-3 bg-purple-600 text-white py-2 px-6 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {regenerating ? 'Regenerating...' : 'Regenerate Reply'}
              </button>
            </div>

            {/* Current/New Draft */}
            <div>
              <label className="block font-medium text-gray-700 mb-2">
                {regenerating ? 'Generating new reply...' : 'SAM\'s Reply'}
              </label>
              <div className="bg-green-50 rounded-lg p-4 border-l-4 border-green-500">
                <p className="text-gray-800 whitespace-pre-wrap">
                  {regenerating ? '...' : newDraft}
                </p>
              </div>
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="bg-red-50 text-red-700 p-4 rounded-lg">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-50 text-green-700 p-4 rounded-lg">
                {success}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={handleApproveAndSend}
                disabled={submitting || regenerating}
                className="flex-1 bg-green-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Sending...' : 'Approve & Send'}
              </button>
              <button
                onClick={() => router.back()}
                className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AddInstructionsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    }>
      <AddInstructionsContent />
    </Suspense>
  );
}
