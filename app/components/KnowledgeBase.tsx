'use client';

import React, { useState } from 'react';

// Upload Area Component from VisualMock v1
function UploadArea() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done'>('idle');
  
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <h3 className="font-semibold mb-2 text-white">Upload Document</h3>
      <div className="border-2 border-dashed border-gray-600 rounded p-6 text-center">
        <input 
          type="file" 
          onChange={(e) => setFile(e.target.files?.[0] ?? null)} 
          className="text-gray-300"
        />
        <p className="text-sm text-gray-400 mt-2">PDF, DOCX, MD, URL exports</p>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <button
          className="px-3 py-2 rounded bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 transition-colors"
          disabled={!file || status === 'uploading'}
          onClick={() => setStatus('done')}
        >
          {status === 'uploading' ? 'Uploading…' : 'Upload (mock)'}
        </button>
        {file && <span className="text-sm text-gray-400">Selected: {file.name}</span>}
      </div>
    </div>
  );
}

// Vector Test Component from VisualMock v1
function VectorTest() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Array<{ score: number; text: string; labels: string[] }>>([]);

  const run = () => {
    // mock results
    setResults([
      { score: 0.89, text: 'Our ICP are B2B SaaS startups…', labels: ['icp', 'saas'] },
      { score: 0.74, text: 'Competitors include HubSpot and Apollo…', labels: ['competitive'] },
      { score: 0.66, text: 'Success metrics: reply %, meetings/mo, ROI…', labels: ['metrics'] },
    ]);
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <h3 className="font-semibold mb-2 text-white">Test Knowledge Retrieval</h3>
      <div className="flex gap-2">
        <input 
          className="bg-gray-700 border border-gray-600 px-3 py-2 rounded text-white placeholder-gray-400 w-full focus:border-purple-500 focus:outline-none" 
          placeholder="Ask a question…" 
          value={q} 
          onChange={e => setQ(e.target.value)} 
        />
        <button 
          className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors" 
          onClick={run}
        >
          Run
        </button>
      </div>
      <div className="space-y-2 mt-3 max-h-72 overflow-auto">
        {results.map((r, i) => (
          <div key={i} className="p-3 bg-gray-700 border border-gray-600 rounded">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-800 text-white text-[10px]">
                {(r.score * 100).toFixed(0)}
              </span>
              <span>score</span>
            </div>
            <div className="text-sm mt-1 text-gray-300">{r.text}</div>
            <div className="flex gap-2 mt-2 flex-wrap">
              {r.labels.map(l => (
                <span key={l} className="px-2 py-0.5 text-xs rounded bg-gray-600 text-gray-200">
                  {l}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Documents Table Component from VisualMock v1
type Doc = { name: string; status: 'Ready' | 'Processing' | 'Error'; uploaded: string; labels: string[] };
const MOCK_DOCS: Doc[] = [
  { name: 'ICP_SaaS.pdf', status: 'Ready', uploaded: '10m ago', labels: ['icp', 'saas'] },
  { name: 'Competitors_2025.md', status: 'Processing', uploaded: '2m ago', labels: ['competitive'] },
  { name: 'CaseStudy_Acme.pdf', status: 'Error', uploaded: '1h ago', labels: [] },
];

function DocumentsTable() {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-700 font-semibold text-white">Documents</div>
      <table className="w-full text-sm">
        <thead className="bg-gray-750 text-gray-400">
          <tr>
            <th className="text-left px-4 py-2">File Name</th>
            <th className="text-left px-4 py-2">Status</th>
            <th className="text-left px-4 py-2">Uploaded</th>
            <th className="text-left px-4 py-2">Labels</th>
            <th className="text-right px-4 py-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {MOCK_DOCS.map((d) => (
            <tr key={d.name} className="border-t border-gray-700">
              <td className="px-4 py-2 text-gray-300">{d.name}</td>
              <td className="px-4 py-2">
                {d.status === 'Ready' && (
                  <span className="inline-flex items-center gap-1 text-green-400">
                    <span className="w-2 h-2 rounded-full bg-green-500" />Ready
                  </span>
                )}
                {d.status === 'Processing' && (
                  <span className="inline-flex items-center gap-1 text-yellow-400">
                    <span className="w-2 h-2 rounded-full bg-yellow-500" />Processing
                  </span>
                )}
                {d.status === 'Error' && (
                  <span className="inline-flex items-center gap-1 text-red-400">
                    <span className="w-2 h-2 rounded-full bg-red-500" />Error
                  </span>
                )}
              </td>
              <td className="px-4 py-2 text-gray-400">{d.uploaded}</td>
              <td className="px-4 py-2">
                <div className="flex gap-2 flex-wrap">
                  {d.labels.length ? (
                    d.labels.map(l => (
                      <span key={l} className="px-2 py-0.5 text-xs rounded bg-gray-600 text-gray-200">
                        {l}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-500">—</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-2 text-right">
                <button className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors">
                  View Chunks
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Chunk Drawer Component from VisualMock v1
const MOCK_CHUNKS = [
  { text: 'Our ICP: B2B SaaS, 50–200 employees, NA/EU, VP Sales/CRO…', labels: ['icp', 'saas', 'vp_sales'], confidence: 0.92 },
  { text: 'Competitors: HubSpot, Apollo; we win on personalization at scale…', labels: ['competitive'], confidence: 0.81 },
];

function ChunkDrawer() {
  const [open, setOpen] = useState(false);
  
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="font-semibold text-white">Chunks</div>
        <button 
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors" 
          onClick={() => setOpen(!open)}
        >
          {open ? 'Close' : 'Open'}
        </button>
      </div>
      {open && (
        <div className="p-4 space-y-3 max-h-72 overflow-auto">
          {MOCK_CHUNKS.map((c, i) => (
            <div key={i} className="p-3 bg-gray-700 border border-gray-600 rounded">
              <div className="text-sm text-gray-300">{c.text}</div>
              <div className="flex gap-2 mt-2 flex-wrap">
                {c.labels.map(l => (
                  <span key={l} className="px-2 py-0.5 text-xs rounded bg-gray-600 text-gray-200">
                    {l}
                  </span>
                ))}
                <span className="ml-auto text-xs text-gray-400">conf: {Math.round(c.confidence * 100)}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const KnowledgeBase: React.FC = () => {
  return (
    <div className="flex-1 bg-gray-900 p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Knowledge Base</h1>
          <p className="text-gray-400">Manage and search your knowledge documents</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl space-y-6">
        {/* Upload and Test Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <UploadArea />
          <VectorTest />
        </div>

        {/* Documents Table */}
        <DocumentsTable />
        
        {/* Chunk Drawer */}
        <ChunkDrawer />
      </div>
    </div>
  );
};

export default KnowledgeBase;