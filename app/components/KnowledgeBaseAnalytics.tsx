'use client';

import React, { useState, useEffect } from 'react';
import { BarChart, TrendingUp, TrendingDown, AlertCircle, Clock, FileText, Activity, Download } from 'lucide-react';

type DocumentAnalytics = {
  document_id: string;
  document_title: string;
  section: string;
  total_uses: number;
  unique_threads: number;
  avg_relevance: number;
  last_used_at: string | null;
  days_since_last_use: number | null;
  usage_trend: 'increasing' | 'decreasing' | 'stable';
};

type SectionAnalytics = {
  section: string;
  total_documents: number;
  documents_used: number;
  total_uses: number;
  avg_uses_per_doc: number;
  usage_rate: number;
};

type AnalyticsData = {
  summary: {
    totalDocuments: number;
    documentsUsed: number;
    totalUses: number;
    avgUsesPerDoc: string;
    usageRate: string;
  };
  categorized: {
    mostUsed: DocumentAnalytics[];
    leastUsed: DocumentAnalytics[];
    neverUsed: DocumentAnalytics[];
    stale: DocumentAnalytics[];
    trending: DocumentAnalytics[];
  };
};

export default function KnowledgeBaseAnalytics() {
  const [days, setDays] = useState(30);
  const [view, setView] = useState<'documents' | 'sections'>('documents');
  const [loading, setLoading] = useState(false);
  const [documentData, setDocumentData] = useState<AnalyticsData | null>(null);
  const [sectionData, setSectionData] = useState<SectionAnalytics[]>([]);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    fetchAnalytics();
  }, [days, view]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/knowledge-base/analytics?days=${days}&type=${view}`);

      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const data = await response.json();

      if (view === 'documents') {
        setDocumentData(data);
      } else {
        setSectionData(data.data || []);
      }
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const exportData = async (format: 'json' | 'csv' | 'markdown') => {
    try {
      const response = await fetch(`/api/knowledge-base/export?format=${format}`);

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kb-export-${Date.now()}.${format === 'markdown' ? 'md' : format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert('Export failed. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        <AlertCircle className="mr-2" size={20} />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center">
          <Activity className="mr-2" size={24} />
          Knowledge Base Analytics
        </h2>

        <div className="flex items-center space-x-3">
          {/* Time Range Selector */}
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="bg-gray-700 text-white px-3 py-2 rounded text-sm border border-gray-600"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="180">Last 6 months</option>
            <option value="365">Last year</option>
          </select>

          {/* View Toggle */}
          <div className="flex bg-gray-700 rounded overflow-hidden">
            <button
              onClick={() => setView('documents')}
              className={`px-4 py-2 text-sm transition-colors ${
                view === 'documents'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-600'
              }`}
            >
              Documents
            </button>
            <button
              onClick={() => setView('sections')}
              className={`px-4 py-2 text-sm transition-colors ${
                view === 'sections'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-600'
              }`}
            >
              Sections
            </button>
          </div>

          {/* Export Dropdown */}
          <div className="relative group">
            <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm flex items-center transition-colors">
              <Download className="mr-2" size={16} />
              Export
            </button>
            <div className="absolute right-0 mt-2 w-40 bg-gray-700 border border-gray-600 rounded shadow-lg hidden group-hover:block z-10">
              <button
                onClick={() => exportData('json')}
                className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-600 transition-colors"
              >
                Export as JSON
              </button>
              <button
                onClick={() => exportData('csv')}
                className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-600 transition-colors"
              >
                Export as CSV
              </button>
              <button
                onClick={() => exportData('markdown')}
                className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-600 transition-colors"
              >
                Export as Markdown
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Document View */}
      {view === 'documents' && documentData && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total Documents</p>
                  <p className="text-2xl font-bold text-white">{documentData.summary.totalDocuments}</p>
                </div>
                <FileText className="text-blue-500" size={32} />
              </div>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Documents Used</p>
                  <p className="text-2xl font-bold text-white">{documentData.summary.documentsUsed}</p>
                  <p className="text-xs text-gray-500">{documentData.summary.usageRate} usage rate</p>
                </div>
                <BarChart className="text-green-500" size={32} />
              </div>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total Uses</p>
                  <p className="text-2xl font-bold text-white">{documentData.summary.totalUses}</p>
                </div>
                <Activity className="text-purple-500" size={32} />
              </div>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Avg Uses/Doc</p>
                  <p className="text-2xl font-bold text-white">{documentData.summary.avgUsesPerDoc}</p>
                </div>
                <TrendingUp className="text-yellow-500" size={32} />
              </div>
            </div>
          </div>

          {/* Most Used Documents */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
              <TrendingUp className="mr-2 text-green-500" size={20} />
              Most Used Documents
            </h3>
            {documentData.categorized.mostUsed.length === 0 ? (
              <p className="text-gray-400">No usage data yet</p>
            ) : (
              <div className="space-y-2">
                {documentData.categorized.mostUsed.map((doc) => (
                  <div key={doc.document_id} className="flex items-center justify-between bg-gray-700 p-3 rounded">
                    <div className="flex-1">
                      <p className="text-white font-medium">{doc.document_title}</p>
                      <p className="text-xs text-gray-400">{doc.section}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-bold">{doc.total_uses} uses</p>
                      <p className="text-xs text-gray-400">{doc.unique_threads} conversations</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Trending Documents */}
          {documentData.categorized.trending.length > 0 && (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                <TrendingUp className="mr-2 text-blue-500" size={20} />
                Trending Up
              </h3>
              <div className="space-y-2">
                {documentData.categorized.trending.map((doc) => (
                  <div key={doc.document_id} className="flex items-center justify-between bg-gray-700 p-3 rounded">
                    <div className="flex-1">
                      <p className="text-white font-medium">{doc.document_title}</p>
                      <p className="text-xs text-gray-400">{doc.section}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-green-500 text-sm">↑</span>
                      <span className="text-white">{doc.total_uses} uses</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stale Documents */}
          {documentData.categorized.stale.length > 0 && (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                <Clock className="mr-2 text-yellow-500" size={20} />
                Stale Documents (90+ days)
              </h3>
              <div className="space-y-2">
                {documentData.categorized.stale.slice(0, 10).map((doc) => (
                  <div key={doc.document_id} className="flex items-center justify-between bg-gray-700 p-3 rounded">
                    <div className="flex-1">
                      <p className="text-white font-medium">{doc.document_title}</p>
                      <p className="text-xs text-gray-400">{doc.section}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-yellow-500 text-sm">
                        {doc.days_since_last_use ? `${doc.days_since_last_use} days ago` : 'Never used'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Never Used Documents */}
          {documentData.categorized.neverUsed.length > 0 && (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                <AlertCircle className="mr-2 text-red-500" size={20} />
                Never Used Documents ({documentData.categorized.neverUsed.length})
              </h3>
              <p className="text-gray-400 text-sm mb-4">
                These documents haven't been used by SAM yet. Consider reviewing or removing them.
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {documentData.categorized.neverUsed.slice(0, 20).map((doc) => (
                  <div key={doc.document_id} className="flex items-center justify-between bg-gray-700 p-3 rounded">
                    <div className="flex-1">
                      <p className="text-white font-medium">{doc.document_title}</p>
                      <p className="text-xs text-gray-400">{doc.section}</p>
                    </div>
                    <span className="text-red-500 text-sm">0 uses</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Section View */}
      {view === 'sections' && sectionData.length > 0 && (
        <div className="space-y-4">
          {sectionData.map((section) => (
            <div key={section.section} className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-4">{section.section}</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-gray-400 text-sm">Total Docs</p>
                  <p className="text-2xl font-bold text-white">{section.total_documents}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Docs Used</p>
                  <p className="text-2xl font-bold text-white">{section.documents_used}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Total Uses</p>
                  <p className="text-2xl font-bold text-white">{section.total_uses}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Avg Uses/Doc</p>
                  <p className="text-2xl font-bold text-white">{section.avg_uses_per_doc.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Usage Rate</p>
                  <p className="text-2xl font-bold text-white">{section.usage_rate.toFixed(0)}%</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-4">
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${section.usage_rate}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
