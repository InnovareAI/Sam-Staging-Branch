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

  // Regenerate state
  const [regenerating, setRegenerating] = useState(false);
  const [regeneratedText, setRegeneratedText] = useState('');

  // Research state
  const [researching, setResearching] = useState(false);
  const [researchData, setResearchData] = useState<any>(null);
  const [showResearch, setShowResearch] = useState(false);

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
    setRegeneratedText('');
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

  async function handleRegenerate() {
    if (!question.trim()) return;

    setRegenerating(true);
    setSamResponse('');
    setRegeneratedText('');
    try {
      const res = await fetch('/api/reply-agent/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId,
          token,
          instructions: question.trim(),
        }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to regenerate');
      }
      const data = await res.json();
      setRegeneratedText(data.newDraftText);
    } catch (err: any) {
      setSamResponse(`Error: ${err.message}`);
    } finally {
      setRegenerating(false);
    }
  }

  function applyRegeneratedText() {
    setEditedText(regeneratedText);
    setRegeneratedText('');
    setQuestion('');
    setShowAskSam(false);
  }

  async function handleResearchProspect() {
    setResearching(true);
    setResearchData(null);
    try {
      const res = await fetch('/api/reply-agent/research-prospect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId,
          token,
          prospectId: draft?.prospect_id,
          linkedinUrl: draft?.prospect_linkedin_url,
        }),
      });
      if (!res.ok) throw new Error('Failed to research prospect');
      const data = await res.json();
      setResearchData(data.research);
      setShowResearch(true);
    } catch (err: any) {
      setError(`Research failed: ${err.message}`);
    } finally {
      setResearching(false);
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
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-gray-700 mb-2">Prospect</h3>
                  <p className="text-gray-900">{draft?.prospect_name}</p>
                  <p className="text-gray-500 text-sm">
                    {draft?.prospect_title} at {draft?.prospect_company}
                  </p>
                  {draft?.prospect_linkedin_url && (
                    <a
                      href={draft.prospect_linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 text-sm hover:underline"
                    >
                      View LinkedIn Profile →
                    </a>
                  )}
                </div>
                <button
                  onClick={handleResearchProspect}
                  disabled={researching}
                  className="bg-blue-100 text-blue-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-200 disabled:opacity-50"
                >
                  {researching ? '🔍 Researching...' : '🔍 Research Prospect'}
                </button>
              </div>

              {/* Research Results */}
              {showResearch && researchData && (
                <div className="mt-4 bg-white rounded-lg p-4 border border-blue-200">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-medium text-blue-800">📊 Research Results</h4>
                    <button
                      onClick={() => setShowResearch(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </div>

                  {researchData.linkedin && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-gray-500 uppercase mb-1">LinkedIn Profile</p>
                      <div className="text-sm text-gray-700 space-y-1">
                        {researchData.linkedin.headline && (
                          <p><span className="font-medium">Headline:</span> {researchData.linkedin.headline}</p>
                        )}
                        {researchData.linkedin.location && (
                          <p><span className="font-medium">Location:</span> {researchData.linkedin.location}</p>
                        )}
                        {researchData.linkedin.summary && (
                          <p><span className="font-medium">About:</span> {researchData.linkedin.summary.slice(0, 200)}...</p>
                        )}
                        {researchData.linkedin.recentPosts && researchData.linkedin.recentPosts.length > 0 && (
                          <div>
                            <p className="font-medium">Recent Activity:</p>
                            <ul className="list-disc list-inside text-xs text-gray-600">
                              {researchData.linkedin.recentPosts.slice(0, 3).map((post: string, i: number) => (
                                <li key={i}>{post.slice(0, 100)}...</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {researchData.company && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-gray-500 uppercase mb-1">Company Info</p>
                      <div className="text-sm text-gray-700 space-y-1">
                        {researchData.company.description && (
                          <p>{researchData.company.description.slice(0, 200)}...</p>
                        )}
                        {researchData.company.industry && (
                          <p><span className="font-medium">Industry:</span> {researchData.company.industry}</p>
                        )}
                        {researchData.company.size && (
                          <p><span className="font-medium">Size:</span> {researchData.company.size}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {researchData.insights && (
                    <div className="bg-yellow-50 rounded p-3 mt-2">
                      <p className="text-xs font-medium text-yellow-800 mb-1">💡 AI Insights</p>
                      <p className="text-sm text-yellow-900">{researchData.insights}</p>
                    </div>
                  )}
                </div>
              )}
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
                className="w-full h-48 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none font-mono text-sm text-gray-900"
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
                  className="w-full h-20 p-3 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm text-gray-900"
                  placeholder="e.g., Add the demo link, make it shorter, include a holiday greeting, mention case studies..."
                />
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={handleAskSam}
                    disabled={askingSam || regenerating || !question.trim()}
                    className="bg-purple-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {askingSam ? 'Thinking...' : '💡 Get Advice'}
                  </button>
                  <button
                    onClick={handleRegenerate}
                    disabled={askingSam || regenerating || !question.trim()}
                    className="bg-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {regenerating ? 'Regenerating...' : '✨ Rewrite Message'}
                  </button>
                </div>

                {/* Sam's advice response */}
                {samResponse && (
                  <div className="mt-4 bg-white rounded-lg p-4 border border-purple-200">
                    <p className="text-xs font-medium text-purple-600 mb-2">Sam's Advice:</p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{samResponse}</p>
                  </div>
                )}

                {/* Regenerated text for approval */}
                {regeneratedText && (
                  <div className="mt-4 bg-green-50 rounded-lg p-4 border border-green-300">
                    <p className="text-xs font-medium text-green-700 mb-2">✨ New Version:</p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap mb-4">{regeneratedText}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={applyRegeneratedText}
                        className="bg-green-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-700 text-sm"
                      >
                        ✅ Use This Version
                      </button>
                      <button
                        onClick={() => setRegeneratedText('')}
                        className="bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 text-sm"
                      >
                        Keep Original
                      </button>
                    </div>
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
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex gap-4 items-center">
                <button
                  onClick={handleSaveAndSend}
                  disabled={submitting || !editedText.trim()}
                  className="flex-1 bg-green-600 text-white py-4 px-8 rounded-lg font-bold text-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Sending...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      ✉️ Send Reply Now
                    </span>
                  )}
                </button>
                <button
                  onClick={() => router.back()}
                  className="px-6 py-4 border-2 border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 font-medium"
                >
                  Cancel
                </button>
              </div>
              <p className="text-center text-gray-500 text-sm mt-3">
                This will send the email immediately to {draft?.prospect_name}
              </p>
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
