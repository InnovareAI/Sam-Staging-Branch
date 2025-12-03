'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Plus, Trash2, Edit2, Save, Loader2, Search, Ban, FileSpreadsheet, Check } from 'lucide-react';
import { createClient } from '@/app/lib/supabase';

interface BlacklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
}

interface BlacklistEntry {
  id: string;
  blacklist_type: 'company_name' | 'first_name' | 'last_name' | 'job_title' | 'profile_link';
  comparison_type: 'contains' | 'equals' | 'starts_with' | 'ends_with';
  keyword: string;
  linkedin_account_id?: string;
  notes?: string;
  created_at: string;
}

const BLACKLIST_TYPES = [
  { value: 'company_name', label: 'Company Name' },
  { value: 'first_name', label: 'First Name' },
  { value: 'last_name', label: 'Last Name' },
  { value: 'job_title', label: 'Job Title' },
  { value: 'profile_link', label: 'Profile Link' },
];

const COMPARISON_TYPES = [
  { value: 'contains', label: 'Contains' },
  { value: 'equals', label: 'Equals' },
  { value: 'starts_with', label: 'Starts With' },
  { value: 'ends_with', label: 'Ends With' },
];

export default function BlacklistModal({ isOpen, onClose, workspaceId }: BlacklistModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [entries, setEntries] = useState<BlacklistEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New entry form state
  const [newEntry, setNewEntry] = useState({
    blacklist_type: 'company_name' as BlacklistEntry['blacklist_type'],
    comparison_type: 'contains' as BlacklistEntry['comparison_type'],
    keyword: '',
    notes: '',
  });

  // CSV upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: number; failed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadEntries();
    }
  }, [isOpen, workspaceId]);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('workspace_blacklists')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error('Failed to load blacklist entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEntry = async () => {
    if (!newEntry.keyword.trim()) return;

    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('workspace_blacklists')
        .insert({
          workspace_id: workspaceId,
          blacklist_type: newEntry.blacklist_type,
          comparison_type: newEntry.comparison_type,
          keyword: newEntry.keyword.trim(),
          notes: newEntry.notes.trim() || null,
        });

      if (error) throw error;

      setNewEntry({
        blacklist_type: 'company_name',
        comparison_type: 'contains',
        keyword: '',
        notes: '',
      });
      setShowAddForm(false);
      await loadEntries();
    } catch (error) {
      console.error('Failed to add blacklist entry:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateEntry = async (id: string, updates: Partial<BlacklistEntry>) => {
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('workspace_blacklists')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      setEditingId(null);
      await loadEntries();
    } catch (error) {
      console.error('Failed to update blacklist entry:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!confirm('Are you sure you want to delete this blacklist entry?')) return;

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('workspace_blacklists')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadEntries();
    } catch (error) {
      console.error('Failed to delete blacklist entry:', error);
    }
  };

  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadResult(null);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());

      // Skip header row if present
      const hasHeader = lines[0]?.toLowerCase().includes('keyword') ||
                       lines[0]?.toLowerCase().includes('type') ||
                       lines[0]?.toLowerCase().includes('company');
      const dataLines = hasHeader ? lines.slice(1) : lines;

      const supabase = createClient();
      let success = 0;
      let failed = 0;

      for (const line of dataLines) {
        const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));

        // Support different CSV formats:
        // Format 1: keyword only (defaults to company_name, contains)
        // Format 2: keyword, type
        // Format 3: keyword, type, comparison
        // Format 4: keyword, type, comparison, notes
        const keyword = values[0];
        const type = values[1] || 'company_name';
        const comparison = values[2] || 'contains';
        const notes = values[3] || '';

        if (!keyword) {
          failed++;
          continue;
        }

        // Validate type and comparison
        const validTypes = ['company_name', 'first_name', 'last_name', 'job_title', 'profile_link'];
        const validComparisons = ['contains', 'equals', 'starts_with', 'ends_with'];

        const normalizedType = validTypes.includes(type.toLowerCase().replace(/ /g, '_'))
          ? type.toLowerCase().replace(/ /g, '_')
          : 'company_name';
        const normalizedComparison = validComparisons.includes(comparison.toLowerCase().replace(/ /g, '_'))
          ? comparison.toLowerCase().replace(/ /g, '_')
          : 'contains';

        try {
          const { error } = await supabase
            .from('workspace_blacklists')
            .insert({
              workspace_id: workspaceId,
              blacklist_type: normalizedType,
              comparison_type: normalizedComparison,
              keyword: keyword,
              notes: notes || null,
            });

          if (error) {
            failed++;
          } else {
            success++;
          }
        } catch {
          failed++;
        }
      }

      setUploadResult({ success, failed });
      await loadEntries();
    } catch (error) {
      console.error('Failed to process CSV:', error);
      setUploadResult({ success: 0, failed: 1 });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Filter entries
  const filteredEntries = entries.filter(entry => {
    const matchesSearch = entry.keyword.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         entry.notes?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || entry.blacklist_type === filterType;
    return matchesSearch && matchesType;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600/20 rounded-lg flex items-center justify-center">
              <Ban className="text-red-400 h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Blacklists</h2>
              <p className="text-sm text-gray-400">
                Block companies, people, or profiles from outreach
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="px-6 py-3 bg-blue-900/20 border-b border-blue-800/30">
          <p className="text-sm text-blue-200">
            When prospects match blacklist rules, they'll be blocked from campaigns and outreach.
            Supports: <span className="font-medium">company_name, first_name, last_name, job_title, profile_link</span>
          </p>
        </div>

        {/* Actions Bar */}
        <div className="p-4 border-b border-gray-700 bg-gray-800/50">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="flex-1 min-w-[200px] relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>

            {/* Filter by Type */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-pink-500"
            >
              <option value="all">All Types</option>
              {BLACKLIST_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>

            {/* Upload CSV */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-lg text-white text-sm transition-colors"
            >
              {isUploading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <FileSpreadsheet size={16} />
              )}
              Upload CSV
            </button>

            {/* Add Entry */}
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 px-4 py-2 bg-pink-600 hover:bg-pink-700 rounded-lg text-white text-sm transition-colors"
            >
              <Plus size={16} />
              Add Entry
            </button>
          </div>

          {/* Upload Result */}
          {uploadResult && (
            <div className="mt-3 p-3 bg-gray-700/50 rounded-lg flex items-center gap-2">
              <Check size={16} className="text-green-400" />
              <span className="text-sm text-gray-200">
                Uploaded: {uploadResult.success} entries
                {uploadResult.failed > 0 && (
                  <span className="text-red-400 ml-2">({uploadResult.failed} failed)</span>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Add Entry Form */}
        {showAddForm && (
          <div className="p-4 border-b border-gray-700 bg-gray-700/30">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Keyword..."
                value={newEntry.keyword}
                onChange={(e) => setNewEntry({ ...newEntry, keyword: e.target.value })}
                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-pink-500"
              />
              <select
                value={newEntry.blacklist_type}
                onChange={(e) => setNewEntry({ ...newEntry, blacklist_type: e.target.value as BlacklistEntry['blacklist_type'] })}
                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-pink-500"
              >
                {BLACKLIST_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              <select
                value={newEntry.comparison_type}
                onChange={(e) => setNewEntry({ ...newEntry, comparison_type: e.target.value as BlacklistEntry['comparison_type'] })}
                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-pink-500"
              >
                {COMPARISON_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={handleAddEntry}
                  disabled={saving || !newEntry.keyword.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg text-white text-sm transition-colors"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Add
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-white text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Entries Table */}
        <div className="overflow-y-auto max-h-[calc(90vh-320px)]">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={32} className="animate-spin text-pink-500" />
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Ban size={48} className="mb-4 opacity-50" />
              <p className="text-lg mb-2">No blacklist entries</p>
              <p className="text-sm">Add entries to block specific companies or people</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-700/50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Keyword</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Comparison</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-700/30">
                    <td className="px-4 py-3">
                      {editingId === entry.id ? (
                        <input
                          type="text"
                          defaultValue={entry.keyword}
                          className="px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm w-full"
                          onBlur={(e) => handleUpdateEntry(entry.id, { keyword: e.target.value })}
                          autoFocus
                        />
                      ) : (
                        <span className="text-white font-medium">{entry.keyword}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300">
                        {BLACKLIST_TYPES.find(t => t.value === entry.blacklist_type)?.label || entry.blacklist_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-400 text-sm">
                        {COMPARISON_TYPES.find(t => t.value === entry.comparison_type)?.label || entry.comparison_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingId(editingId === entry.id ? null : entry.id)}
                          className="p-1.5 hover:bg-gray-600 rounded transition-colors"
                        >
                          <Edit2 size={14} className="text-gray-400" />
                        </button>
                        <button
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="p-1.5 hover:bg-red-600/20 rounded transition-colors"
                        >
                          <Trash2 size={14} className="text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-700 bg-gray-800/50">
          <div className="text-sm text-gray-400">
            {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
            {entries.length !== filteredEntries.length && ` (${entries.length} total)`}
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
