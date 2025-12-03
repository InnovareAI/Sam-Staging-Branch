'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function EditReplyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const draftId = searchParams.get('id');
  const token = searchParams.get('token');

  const [draft, setDraft] = useState<any>(null);
  const [editedText, setEditedText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Ask Sam state
  const [showAskSam, setShowAskSam] = useState(false);
  const [question, setQuestion] = useState('');
  const [samResponse, setSamResponse] = useState('');
  const [askingSam, setAskingSam] = useState(false);

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
      setEditedText(data.draft.draft_text);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveAndSend() {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/reply-agent/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action: 'approve',
          editedText: editedText,
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

  async function handleAskSam() {
    if (!question.trim()) return;

    setAskingSam(true);
    setSamResponse('');
    try {
      const res = await fetch('/api/reply-agent/ask-sam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId,
          token,
          question: question.trim(),
          currentDraft: editedText,
        }),
      });
      if (!res.ok) throw new Error('Failed to get response');
      const data = await res.json();
      setSamResponse(data.response);
    } catch (err: any) {
      setSamResponse(`Error: ${err.message}`);
    } finally {
      setAskingSam(false);
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
          <h1 className="text-xl font-bold text-red-600 mb-2">Error</h1>
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
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4">
            <h1 className="text-xl font-bold text-white">Edit Reply</h1>
            <p className="text-indigo-100 text-sm">
              Reply to {draft?.prospect_name || 'Unknown'}
            </p>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Prospect Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-700 mb-2">Prospect</h3>
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

            {/* Editable Reply */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block font-medium text-gray-700">
                  Your Reply
                </label>
                <button
                  onClick={() => setShowAskSam(!showAskSam)}
                  className="text-sm bg-purple-100 text-purple-700 px-3 py-1 rounded-full hover:bg-purple-200 font-medium"
                >
                  🤖 Ask Sam
                </button>
              </div>
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="w-full h-48 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none font-mono text-sm"
                placeholder="Edit your reply..."
              />
              <p className="text-gray-400 text-sm mt-1">
                {editedText.length} characters
              </p>
            </div>

            {/* Ask Sam Panel */}
            {showAskSam && (
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <h4 className="font-medium text-purple-800 mb-3">🤖 Ask Sam for Help</h4>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  className="w-full h-20 p-3 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm"
                  placeholder="e.g., How should I handle their pricing objection? Should I mention our case studies?"
                />
                <button
                  onClick={handleAskSam}
                  disabled={askingSam || !question.trim()}
                  className="mt-2 bg-purple-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {askingSam ? 'Thinking...' : 'Get Advice'}
                </button>

                {samResponse && (
                  <div className="mt-4 bg-white rounded-lg p-4 border border-purple-200">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{samResponse}</p>
                  </div>
                )}
              </div>
            )}

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
                onClick={handleSaveAndSend}
                disabled={submitting || !editedText.trim()}
                className="flex-1 bg-green-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Sending...' : 'Save & Send'}
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

export default function EditReplyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    }>
      <EditReplyContent />
    </Suspense>
  );
}
