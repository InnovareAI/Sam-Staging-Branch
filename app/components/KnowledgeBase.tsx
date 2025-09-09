'use client';

import React, { useState, useEffect } from 'react';
import { 
  Book, 
  User, 
  MessageSquare, 
  AlertTriangle, 
  Target,
  Building,
  ChevronRight,
  ChevronDown,
  Search,
  Upload,
  FileText,
  Plus
} from 'lucide-react';

interface KnowledgeItem {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

const KnowledgeBase = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Fetch knowledge base items from API
  useEffect(() => {
    const fetchKnowledge = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (searchTerm) params.append('search', searchTerm);
        if (selectedCategory !== 'all') params.append('category', selectedCategory);
        
        const response = await fetch(`/api/knowledge?${params.toString()}`);
        const data = await response.json();
        
        if (data.success) {
          setKnowledgeItems(data.data);
        }
      } catch (error) {
        console.error('Error fetching knowledge base:', error);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchKnowledge, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, selectedCategory]);

  const categories = [
    { id: 'all', name: 'All Categories' },
    { id: 'core', name: 'Core Identity' },
    { id: 'conversational-design', name: 'Conversation Design' },
    { id: 'strategy', name: 'Sales Strategy' },
    { id: 'verticals', name: 'Industry Verticals' },
    { id: 'uploaded', name: 'Uploaded Documents' }
  ];

  // Items are already filtered by the API based on search and category

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const handleFileUpload = async () => {
    if (!uploadFile) return;
    
    const formData = new FormData();
    formData.append('file', uploadFile);
    
    try {
      const response = await fetch('/api/knowledge/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        setUploadFile(null);
        setShowUpload(false);
        // Refresh knowledge items
        window.location.reload();
      }
    } catch (error) {
      console.error('Upload error:', error);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-700 p-6">
        <h1 className="text-white text-2xl font-bold mb-4">SAM AI Knowledge Base</h1>
        <p className="text-gray-400 text-sm mb-6">
          Comprehensive training data and conversational patterns for SAM AI v4.4
        </p>

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search knowledge base..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
          />
        </div>

        {/* Category Filter & Upload Button */}
        <div className="flex justify-between items-center">
          <div className="flex flex-wrap gap-2">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
          
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Upload size={16} />
            Upload Document
          </button>
        </div>

        {/* Upload Dialog */}
        {showUpload && (
          <div className="mt-4 p-4 bg-gray-800 rounded-lg border border-gray-600">
            <h3 className="text-white font-medium mb-3">Upload Knowledge Document</h3>
            <div className="space-y-3">
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt,.md"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="w-full text-gray-300 bg-gray-700 rounded border border-gray-600 px-3 py-2"
              />
              {uploadFile && (
                <div className="flex items-center gap-2 text-sm text-purple-300">
                  <FileText size={16} />
                  Ready to upload: {uploadFile.name}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleFileUpload}
                  disabled={!uploadFile}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Upload
                </button>
                <button
                  onClick={() => setShowUpload(false)}
                  className="px-4 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Knowledge Items */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading knowledge base...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {knowledgeItems.map(item => {
              const isExpanded = expandedItems.has(item.id);
              
              // Get icon based on category
              const getIcon = (category: string) => {
                switch (category) {
                  case 'core': return User;
                  case 'conversational-design': return MessageSquare;
                  case 'strategy': return Target;
                  case 'verticals': return Building;
                  case 'uploaded': return FileText;
                  default: return Book;
                }
              };
              
              const IconComponent = getIcon(item.category);

              return (
                <div key={item.id} className="bg-gray-800 rounded-lg border border-gray-700">
                  <button
                    onClick={() => toggleExpanded(item.id)}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-750 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <IconComponent size={20} className="text-purple-400" />
                      <div className="text-left">
                        <h3 className="text-white font-medium">{item.title}</h3>
                        <p className="text-gray-400 text-sm capitalize">
                          {item.category.replace('-', ' ')}
                        </p>
                        {item.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.tags.slice(0, 3).map(tag => (
                              <span key={tag} className="text-xs text-purple-300 bg-purple-900/20 px-1 py-0.5 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="text-gray-400" size={20} />
                    ) : (
                      <ChevronRight className="text-gray-400" size={20} />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4">
                      <div className="bg-gray-900 rounded-lg p-4">
                        <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">
                          {item.content}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="text-xs text-purple-400 bg-purple-900/30 px-2 py-1 rounded">
                            {item.category.replace('-', ' ').toUpperCase()}
                          </span>
                          {item.tags.map(tag => (
                            <span key={tag} className="text-xs text-blue-400 bg-blue-900/20 px-2 py-1 rounded">
                              {tag}
                            </span>
                          ))}
                          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
                            Updated: {new Date(item.updated_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {knowledgeItems.length === 0 && !loading && (
              <div className="text-center py-12">
                <Book className="mx-auto mb-4 text-gray-600" size={48} />
                <h3 className="text-white text-lg mb-2">No knowledge found</h3>
                <p className="text-gray-400">
                  Try adjusting your search terms or category filter.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowledgeBase;