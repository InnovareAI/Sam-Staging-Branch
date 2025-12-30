'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

function ResultContent() {
  const searchParams = useSearchParams();
  const type = searchParams.get('type') || 'info';
  const message = searchParams.get('message') || 'Action completed';

  const icons = {
    success: <CheckCircle className="w-16 h-16 text-green-500" />,
    error: <XCircle className="w-16 h-16 text-red-500" />,
    info: <AlertCircle className="w-16 h-16 text-blue-500" />
  };

  const colors = {
    success: 'bg-green-900/20 border-green-500/50',
    error: 'bg-red-900/20 border-red-500/50',
    info: 'bg-blue-900/20 border-blue-500/50'
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className={`max-w-md w-full p-8 rounded-xl border ${colors[type as keyof typeof colors]} text-center`}>
        <div className="flex justify-center mb-6">
          {icons[type as keyof typeof icons]}
        </div>
        <h1 className="text-2xl font-semibold text-white mb-4">
          {type === 'success' ? 'Success!' : type === 'error' ? 'Error' : 'Notice'}
        </h1>
        <p className="text-gray-300 mb-8">{decodeURIComponent(message)}</p>
        <a
          href="https://app.meet-sam.com"
          className="inline-block px-6 py-3 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-lg font-medium hover:from-pink-500 hover:to-purple-500 transition-all"
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}

export default function ReplyAgentResultPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
      </div>
    }>
      <ResultContent />
    </Suspense>
  );
}
