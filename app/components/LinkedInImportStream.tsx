'use client';

import { useState, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, Loader2, Users, TrendingUp } from 'lucide-react';

interface LinkedInImportStreamProps {
  savedSearchUrl: string;
  campaignName?: string;
  targetCount?: number;
  userId: string;
  workspaceId: string;
  onComplete?: (sessionId: string, totalProspects: number) => void;
  onError?: (error: string) => void;
}

interface Prospect {
  id: string;
  name: string;
  title: string;
  company: string;
  location: string;
  profile_url: string;
  profile_picture_url?: string;
  connection_degree?: number;
}

interface ProgressState {
  current: number;
  target: number;
  batches: number;
  percentage: number;
}

export default function LinkedInImportStream({
  savedSearchUrl,
  campaignName,
  targetCount,
  userId,
  workspaceId,
  onComplete,
  onError
}: LinkedInImportStreamProps) {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressState>({
    current: 0,
    target: targetCount || 2500,
    batches: 0,
    percentage: 0
  });
  const [status, setStatus] = useState<'connecting' | 'streaming' | 'complete' | 'error'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    startImport();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [savedSearchUrl]);

  const startImport = async () => {
    try {
      // Create request body
      const body = {
        saved_search_url: savedSearchUrl,
        campaign_name: campaignName,
        target_count: targetCount,
        user_id: userId,
        workspace_id: workspaceId
      };

      // Make POST request to initiate stream
      const response = await fetch('/api/linkedin/import-saved-search-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Get reader from response body
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      // Read stream
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log('Stream complete');
          break;
        }

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // Keep incomplete message in buffer

        for (const line of lines) {
          if (line.trim()) {
            handleSSEMessage(line);
          }
        }
      }

    } catch (error) {
      console.error('Stream error:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to connect to import stream');
      onError?.(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleSSEMessage = (message: string) => {
    const lines = message.split('\n');
    let eventType = 'message';
    let eventData = '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventType = line.substring(7);
      } else if (line.startsWith('data: ')) {
        eventData = line.substring(6);
      }
    }

    if (!eventData) return;

    try {
      const data = JSON.parse(eventData);

      switch (eventType) {
        case 'session':
          console.log('Session created:', data.session_id);
          setSessionId(data.session_id);
          setStatus('streaming');
          break;

        case 'start':
          console.log('Import started:', data);
          setProgress(prev => ({ ...prev, target: data.target }));
          break;

        case 'batch':
          console.log(`Batch ${data.batch} received:`, data.prospects.length, 'prospects');
          setProspects(prev => [...prev, ...data.prospects]);
          setProgress({
            current: data.total,
            target: data.target,
            batches: data.batch,
            percentage: Math.round((data.total / data.target) * 100)
          });

          // Calculate estimated time remaining
          const elapsed = Date.now() - startTimeRef.current;
          const rate = data.total / elapsed; // prospects per ms
          const remaining = data.target - data.total;
          const estimatedMs = remaining / rate;
          setEstimatedTimeRemaining(Math.round(estimatedMs / 1000)); // seconds

          break;

        case 'batch_error':
          console.warn(`Batch ${data.batch} error:`, data.error);
          // Continue streaming despite batch error
          break;

        case 'complete':
          console.log('Import complete:', data);
          setStatus('complete');
          setEstimatedTimeRemaining(0);
          onComplete?.(data.session_id, data.total);
          break;

        case 'error':
          console.error('Import error:', data.error);
          setStatus('error');
          setErrorMessage(data.error);
          onError?.(data.error);
          break;
      }
    } catch (error) {
      console.error('Failed to parse SSE data:', error);
    }
  };

  const formatTimeRemaining = (seconds: number | null): string => {
    if (seconds === null) return 'Calculating...';
    if (seconds < 60) return `${seconds}s remaining`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s remaining`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">LinkedIn Import</h2>
          <p className="text-sm text-gray-600 mt-1">
            {status === 'connecting' && 'Connecting to LinkedIn...'}
            {status === 'streaming' && 'Importing prospects in real-time'}
            {status === 'complete' && 'Import complete!'}
            {status === 'error' && 'Import failed'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {status === 'connecting' && <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />}
          {status === 'streaming' && <TrendingUp className="w-6 h-6 text-blue-500 animate-pulse" />}
          {status === 'complete' && <CheckCircle className="w-6 h-6 text-green-500" />}
          {status === 'error' && <XCircle className="w-6 h-6 text-red-500" />}
        </div>
      </div>

      {/* Progress Bar */}
      {(status === 'streaming' || status === 'complete') && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">
              {progress.current} / {progress.target} prospects
            </span>
            <span className="text-gray-500">{progress.percentage}%</span>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-blue-500 h-full transition-all duration-300 ease-out"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Batch {progress.batches}</span>
            {status === 'streaming' && (
              <span>{formatTimeRemaining(estimatedTimeRemaining)}</span>
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {status === 'error' && errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-900">Import Failed</h3>
              <p className="text-sm text-red-700 mt-1">{errorMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Prospects List Preview */}
      {prospects.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Prospects ({prospects.length})
            </h3>
            {status === 'complete' && sessionId && (
              <a
                href={`/workspace/${workspaceId}/data-approval?session=${sessionId}`}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Review All →
              </a>
            )}
          </div>

          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {prospects.slice(0, 10).map((prospect, idx) => (
              <div key={idx} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3">
                  {prospect.profile_picture_url ? (
                    <img
                      src={prospect.profile_picture_url}
                      alt={prospect.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                      <Users className="w-6 h-6 text-gray-400" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">{prospect.name}</h4>
                    <p className="text-sm text-gray-600 truncate">{prospect.title}</p>
                    <p className="text-xs text-gray-500 truncate">{prospect.company}</p>
                  </div>

                  {prospect.connection_degree && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      {prospect.connection_degree}° connection
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {prospects.length > 10 && (
            <div className="p-4 bg-gray-50 text-center text-sm text-gray-600">
              + {prospects.length - 10} more prospects
            </div>
          )}
        </div>
      )}

      {/* Help Text */}
      {status === 'streaming' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>You can start reviewing prospects now!</strong>
            {sessionId && (
              <span> Head to the{' '}
                <a
                  href={`/workspace/${workspaceId}/data-approval?session=${sessionId}`}
                  className="underline font-medium"
                >
                  Data Approval
                </a>{' '}
                tab to approve or reject prospects while the import continues.
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
