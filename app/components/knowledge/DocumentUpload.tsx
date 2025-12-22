'use client';

import React, { useState } from 'react';
import { Upload, Globe, FileText, Brain, Cpu, Activity, AlertCircle } from 'lucide-react';

export function DocumentUpload({ section, onComplete, icpId }: { section: string; onComplete?: () => void; icpId?: string | null }) {
    const [file, setFile] = useState<File | null>(null);
    const [url, setUrl] = useState<string>('');
    const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
    const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'extracting' | 'tagging' | 'vectorizing' | 'done' | 'error'>('idle');
    const [progress, setProgress] = useState(0);
    const [aiTags, setAiTags] = useState<string[]>([]);
    const [error, setError] = useState<string>('');

    const handleFileUpload = async () => {
        if (!file && !url) {
            setError('Please select a file or enter a URL');
            setStatus('error');
            return;
        }

        console.log('[KB Upload] Starting upload...', { section, uploadMode, file: file?.name, url });

        setStatus('uploading');
        setProgress(10);
        setError('');

        try {
            const formData = new FormData();
            if (file) {
                formData.append('file', file);
                console.log('[KB Upload] File attached:', file.name, file.size, 'bytes');
            }
            formData.append('section', section);
            formData.append('uploadMode', uploadMode);
            if (url) {
                formData.append('url', url);
            }
            // Include ICP ID for ICP-specific content (null = global content)
            if (icpId) {
                formData.append('icp_id', icpId);
                console.log('[KB Upload] ICP assigned:', icpId);
            }

            // Step 1: Upload and extract content
            setStatus('extracting');
            setProgress(30);

            console.log('[KB Upload] Calling upload API...');
            const uploadResponse = await fetch('/api/knowledge-base/upload-document', {
                method: 'POST',
                body: formData
            });

            console.log('[KB Upload] Upload response status:', uploadResponse.status);

            if (!uploadResponse.ok) {
                const errorData = await uploadResponse.json().catch(() => ({ error: 'Upload failed' }));
                console.error('[KB Upload] Upload failed:', errorData);
                throw new Error(errorData.error || `Upload failed with status ${uploadResponse.status}`);
            }

            const uploadResult = await uploadResponse.json();
            console.log('[KB Upload] Upload successful:', uploadResult.documentId);
            setProgress(50);

            // Step 2: AI Processing and Tagging
            setStatus('tagging');
            setProgress(70);

            console.log('[KB Upload] Starting AI processing...');
            const processingResponse = await fetch('/api/knowledge-base/process-document', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    documentId: uploadResult.documentId,
                    content: uploadResult.content,
                    section: section,
                    filename: file?.name || url
                })
            });

            console.log('[KB Upload] Processing response status:', processingResponse.status);

            if (!processingResponse.ok) {
                const errorData = await processingResponse.json().catch(() => ({ error: 'AI processing failed' }));
                console.error('[KB Upload] Processing failed:', errorData);
                throw new Error(errorData.error || 'AI processing failed');
            }

            const processingResult = await processingResponse.json();
            console.log('[KB Upload] Processing successful, tags:', processingResult.tags);
            setAiTags(processingResult.tags);
            setProgress(85);

            // Step 3: Vectorization and RAG Integration
            setStatus('vectorizing');
            setProgress(95);

            console.log('[KB Upload] Starting vectorization...');
            const vectorResponse = await fetch('/api/knowledge-base/vectorize-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    documentId: uploadResult.documentId,
                    content: uploadResult.content,
                    tags: processingResult.tags,
                    section: section,
                    metadata: processingResult.metadata
                })
            });

            console.log('[KB Upload] Vectorization response status:', vectorResponse.status);

            if (!vectorResponse.ok) {
                const errorData = await vectorResponse.json().catch(() => ({ error: 'Vectorization failed' }));
                console.error('[KB Upload] Vectorization failed:', errorData);
                throw new Error(errorData.error || 'Vectorization failed');
            }

            console.log('[KB Upload] All steps completed successfully!');
            setProgress(100);
            setStatus('done');

            // Reset form after success
            setTimeout(() => {
                setFile(null);
                setUrl('');
                setStatus('idle');
                setProgress(0);
                setAiTags([]);
            }, 3000);

        } catch (error) {
            console.error('[KB Upload] ERROR:', error);
            const errorMessage = error instanceof Error ? error.message : 'Processing failed';
            console.error('[KB Upload] Error message:', errorMessage);
            setError(errorMessage);
            setStatus('error');
        } finally {
            console.log('[KB Upload] Refreshing document list...');
            // ALWAYS refresh the document list, even if there was an error
            // This ensures documents that were uploaded (step 1) show up even if processing failed
            if (typeof onComplete === 'function') {
                onComplete();
            }
        }
    };

    return (
        <div className="bg-surface-card border border-border/40 rounded-xl p-5 backdrop-blur-sm">
            {/* Upload Mode Toggle */}
            <div className="flex mb-4 gap-2 p-1 bg-surface-muted/50 rounded-lg">
                <button
                    onClick={() => setUploadMode('file')}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${uploadMode === 'file'
                            ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20'
                            : 'text-muted-foreground hover:text-foreground hover:bg-surface-hover'
                        }`}
                >
                    <span className="flex items-center justify-center gap-2">
                        <Upload size={16} />
                        File Upload
                    </span>
                </button>
                <button
                    onClick={() => setUploadMode('url')}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${uploadMode === 'url'
                            ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20'
                            : 'text-muted-foreground hover:text-foreground hover:bg-surface-hover'
                        }`}
                >
                    <span className="flex items-center justify-center gap-2">
                        <Globe size={16} />
                        URL/Link
                    </span>
                </button>
            </div>

            {/* File Upload Mode */}
            {uploadMode === 'file' && (
                <div className="border-2 border-dashed border-border/60 rounded-lg p-6 text-center bg-surface-muted/20 hover:border-brand-primary/50 transition-colors">
                    <Upload className="mx-auto mb-3 text-brand-primary/60" size={32} />
                    <input
                        type="file"
                        accept=".pdf,.txt,.md,.png,.jpg,.jpeg,.gif,.webp"
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                        className="text-muted-foreground text-sm w-full file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-brand-primary file:text-white hover:file:bg-brand-primary/90 file:cursor-pointer cursor-pointer"
                    />
                    <p className="text-xs text-muted-foreground/60 mt-3">
                        Supported: PDF, TXT, MD, PNG, JPG, GIF, WEBP (max 25MB)
                    </p>
                </div>
            )}

            {/* URL Upload Mode */}
            {uploadMode === 'url' && (
                <div className="border-2 border-dashed border-border/60 rounded-lg p-6 bg-surface-muted/20 hover:border-brand-primary/50 transition-colors">
                    <Globe className="mx-auto mb-3 text-brand-primary/60" size={32} />
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://example.com/document-or-page"
                        className="w-full bg-surface-input text-foreground text-sm rounded-lg px-4 py-3 border border-border focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent placeholder-muted-foreground"
                    />
                    <p className="text-xs text-muted-foreground/60 mt-3">
                        Web pages, Google Docs, presentations, PDFs, articles
                    </p>
                </div>
            )}

            {/* Upload Status and Actions */}
            {(file || url) && (
                <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between bg-surface-muted/40 rounded-lg p-3 border border-border/40">
                        <span className="text-sm text-foreground truncate mr-3">
                            {file ? file.name : url}
                        </span>
                        <button
                            onClick={handleFileUpload}
                            disabled={status !== 'idle' && status !== 'error'}
                            className="px-4 py-2 bg-brand-primary hover:bg-brand-primary/90 text-white text-sm font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/30 whitespace-nowrap"
                        >
                            {status === 'idle' && 'Process with AI'}
                            {status === 'uploading' && 'Uploading...'}
                            {status === 'extracting' && 'Extracting...'}
                            {status === 'processing' && 'Processing...'}
                            {status === 'tagging' && 'AI Tagging...'}
                            {status === 'vectorizing' && 'Vectorizing...'}
                            {status === 'done' && '✓ Complete'}
                            {status === 'error' && 'Retry'}
                        </button>
                    </div>

                    {/* Progress Bar */}
                    {(status !== 'idle' && status !== 'error') && (
                        <div className="w-full bg-surface-muted rounded-full h-2.5 overflow-hidden shadow-inner">
                            <div
                                className="bg-brand-primary h-2.5 rounded-full transition-all duration-500 shadow-lg"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    )}

                    {/* Status Messages */}
                    {status === 'extracting' && (
                        <div className="flex items-center gap-2 text-xs text-blue-400 bg-blue-950/30 border border-blue-800/30 rounded-lg p-3">
                            <FileText size={14} />
                            <span>Extracting text content and metadata...</span>
                        </div>
                    )}
                    {status === 'tagging' && (
                        <div className="flex items-center gap-2 text-xs text-brand-secondary bg-purple-950/30 border border-purple-800/30 rounded-lg p-3">
                            <Brain size={14} />
                            <span>AI analyzing content for smart categorization...</span>
                        </div>
                    )}
                    {status === 'vectorizing' && (
                        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-800/30 rounded-lg p-3">
                            <Cpu size={14} />
                            <span>Creating embeddings for SAM AI knowledge access...</span>
                        </div>
                    )}
                    {status === 'done' && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-800/30 rounded-lg p-3">
                                <Activity size={14} />
                                <span>Document processed and integrated into Knowledgebase</span>
                            </div>
                            {aiTags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {aiTags.slice(0, 4).map((tag, i) => (
                                        <span key={i} className="text-xs bg-brand-primary text-white px-3 py-1.5 rounded-full font-medium shadow-sm">
                                            {tag}
                                        </span>
                                    ))}
                                    {aiTags.length > 4 && (
                                        <span className="text-xs text-muted-foreground bg-surface-muted px-3 py-1.5 rounded-full">+{aiTags.length - 4} more</span>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    {status === 'error' && error && (
                        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/30 border border-red-800/30 rounded-lg p-3">
                            <AlertCircle size={14} />
                            <span>{error}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
