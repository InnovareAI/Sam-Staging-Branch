'use client';

import { CheckCircle, Clock, Eye, MessageSquare, Play, Plus, Search, Users, XCircle } from 'lucide-react';
import { toastError } from '@/lib/toast';
import { createClient } from '@/app/lib/supabase';
import { useState, useEffect } from 'react';

export default function CampaignsPage() {
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  // Step state
  const [currentStep, setCurrentStep] = useState<'search' | 'review' | 'messages' | 'approve' | 'launch'>('search');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [prospects, setProspects] = useState<any[]>([]);
  const [selectedProspects, setSelectedProspects] = useState<Set<string>>(new Set());
  
  // Campaign state
  const [campaignName, setCampaignName] = useState('');
  const [messages, setMessages] = useState<string[]>(['']);
  const [campaign, setCampaign] = useState<any>(null);

  // Check authentication
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (!user) window.location.href = '/signin';
    });
  }, []);

  // Search LinkedIn prospects
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toastError('Please enter a search query');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/unipile/linkedin-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          action: 'search_prospects'
        })
      });

      const data = await response.json();
      if (data.success) {
        setProspects(data.prospects);
        setCurrentStep('review');
      } else {
        alert('Search failed: ' + data.error);
      }
    } catch (error) {
      console.error('Search error:', error);
      toastError('Search failed');
    } finally {
      setLoading(false);
    }
  };

  // Toggle prospect selection
  const toggleProspect = (id: string) => {
    const newSelected = new Set(selectedProspects);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedProspects(newSelected);
  };

  // Select all prospects
  const selectAll = () => {
    if (selectedProspects.size === prospects.length) {
      setSelectedProspects(new Set());
    } else {
      setSelectedProspects(new Set(prospects.map(p => p.id)));
    }
  };

  // Move to message creation
  const proceedToMessages = () => {
    if (selectedProspects.size === 0) {
      toastError('Please select at least one prospect');
      return;
    }
    setCurrentStep('messages');
  };

  // Add message to sequence
  const addMessage = () => {
    setMessages([...messages, '']);
  };

  // Update message
  const updateMessage = (index: number, value: string) => {
    const newMessages = [...messages];
    newMessages[index] = value;
    setMessages(newMessages);
  };

  // Remove message
  const removeMessage = (index: number) => {
    if (messages.length > 1) {
      setMessages(messages.filter((_, i) => i !== index));
    }
  };

  // Create campaign
  const createCampaign = async () => {
    if (!campaignName.trim()) {
      toastError('Please enter a campaign name');
      return;
    }

    const validMessages = messages.filter(m => m.trim());
    if (validMessages.length === 0) {
      toastError('Please add at least one message');
      return;
    }

    setLoading(true);
    try {
      const selectedProspectsList = prospects.filter(p => selectedProspects.has(p.id));
      
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: user?.user_metadata?.workspace_id || user?.id,
          name: campaignName,
          description: `LinkedIn campaign: ${searchQuery}`,
          campaign_type: 'linkedin',
          message_templates: {
            sequence: validMessages.map((msg, i) => ({
              order: i + 1,
              message: msg,
              delay_days: i
            }))
          }
        })
      });

      const data = await response.json();
      if (data.campaign) {
        setCampaign(data.campaign);
        
        // Store prospects for this campaign
        localStorage.setItem(`campaign_${data.campaign.id}_prospects`, JSON.stringify(selectedProspectsList));
        
        setCurrentStep('approve');
      } else {
        toastError('Campaign creation failed');
      }
    } catch (error) {
      console.error('Campaign creation error:', error);
      toastError('Campaign creation failed');
    } finally {
      setLoading(false);
    }
  };

  // Launch campaign
  const launchCampaign = async () => {
    if (!campaign) return;

    setLoading(true);
    try {
      const response = await fetch('/api/campaigns/direct/send-connection-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: campaign.id
        })
      });

      const data = await response.json();
      if (data.success) {
        setCurrentStep('launch');
        toastError(`✅ Campaign launched! Sending messages to ${selectedProspects.size} prospects.`);
      } else {
        alert('Campaign launch failed: ' + data.error);
      }
    } catch (error) {
      console.error('Launch error:', error);
      toastError('Campaign launch failed');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">LinkedIn Campaign Builder</h1>
          <p className="text-gray-400">Build, approve, and launch LinkedIn outreach campaigns</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8 flex items-center justify-center space-x-4">
          {['search', 'review', 'messages', 'approve', 'launch'].map((step, index) => (
            <div key={step} className="flex items-center">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center font-bold
                ${currentStep === step ? 'bg-blue-600' : 
                  ['search', 'review', 'messages', 'approve', 'launch'].indexOf(currentStep) > index ? 'bg-green-600' : 'bg-gray-700'}
              `}>
                {index + 1}
              </div>
              <span className="ml-2 capitalize hidden md:inline">{step}</span>
              {index < 4 && <div className="w-8 h-0.5 bg-gray-700 mx-2" />}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="bg-gray-800 rounded-lg p-6 min-h-[500px]">
          {/* STEP 1: Search */}
          {currentStep === 'search' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-4 flex items-center">
                  <Search className="mr-2" />
                  Search LinkedIn Prospects
                </h2>
                <p className="text-gray-400 mb-4">Enter keywords to find your ideal prospects on LinkedIn</p>
              </div>
              
              <div className="space-y-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="e.g., VP Sales at SaaS companies in San Francisco"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
                >
                  {loading ? (
                    <><Clock className="animate-spin mr-2" size={20} /> Searching...</>
                  ) : (
                    <><Search className="mr-2" size={20} /> Search Prospects</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Review Prospects */}
          {currentStep === 'review' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center">
                  <Users className="mr-2" />
                  Review Prospects ({prospects.length} found)
                </h2>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={selectAll}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                  >
                    {selectedProspects.size === prospects.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <button
                    onClick={proceedToMessages}
                    disabled={selectedProspects.size === 0}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 rounded-lg flex items-center"
                  >
                    Continue ({selectedProspects.size} selected)
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {prospects.map((prospect) => (
                  <div
                    key={prospect.id}
                    onClick={() => toggleProspect(prospect.id)}
                    className={`p-4 rounded-lg cursor-pointer transition-colors ${
                      selectedProspects.has(prospect.id)
                        ? 'bg-blue-900/50 border-2 border-blue-500'
                        : 'bg-gray-700 border-2 border-transparent hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{prospect.name}</h3>
                        <p className="text-sm text-gray-400">{prospect.title} at {prospect.company}</p>
                        <p className="text-xs text-gray-500 mt-1">{prospect.location}</p>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-medium ${
                          prospect.confidence > 0.8 ? 'text-green-400' : 
                          prospect.confidence > 0.6 ? 'text-yellow-400' : 'text-gray-400'
                        }`}>
                          {Math.round(prospect.confidence * 100)}% match
                        </div>
                        {selectedProspects.has(prospect.id) && (
                          <CheckCircle className="text-blue-500 mt-2" size={24} />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: Create Messages */}
          {currentStep === 'messages' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-4 flex items-center">
                  <MessageSquare className="mr-2" />
                  Create Message Sequence
                </h2>
                <p className="text-gray-400 mb-4">Build your outreach message sequence</p>
              </div>

              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Campaign Name"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"
              />

              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-medium">Message {index + 1}</label>
                      {messages.length > 1 && (
                        <button
                          onClick={() => removeMessage(index)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <XCircle size={20} />
                        </button>
                      )}
                    </div>
                    <textarea
                      value={message}
                      onChange={(e) => updateMessage(index, e.target.value)}
                      placeholder="Enter your message... Use {{name}}, {{company}}, {{title}} for personalization"
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg h-32 resize-none"
                    />
                  </div>
                ))}

                <button
                  onClick={addMessage}
                  className="w-full py-2 border-2 border-dashed border-gray-600 hover:border-gray-500 rounded-lg text-gray-400 hover:text-gray-300"
                >
                  <Plus className="inline mr-2" size={20} />
                  Add Follow-up Message
                </button>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={() => setCurrentStep('review')}
                  className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg"
                >
                  Back
                </button>
                <button
                  onClick={createCampaign}
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 rounded-lg"
                >
                  {loading ? 'Creating...' : 'Create Campaign'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Approve */}
          {currentStep === 'approve' && campaign && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-4 flex items-center">
                  <Eye className="mr-2" />
                  Review & Approve Campaign
                </h2>
                <p className="text-gray-400 mb-4">Review your campaign before launching</p>
              </div>

              <div className="bg-gray-700 rounded-lg p-6 space-y-4">
                <div>
                  <h3 className="font-semibold text-lg mb-2">{campaign.name}</h3>
                  <p className="text-gray-400 text-sm">{campaign.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm">Prospects</p>
                    <p className="text-2xl font-bold">{selectedProspects.size}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Messages</p>
                    <p className="text-2xl font-bold">{messages.filter(m => m.trim()).length}</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Message Sequence:</h4>
                  {messages.filter(m => m.trim()).map((msg, i) => (
                    <div key={i} className="mb-2 p-3 bg-gray-800 rounded">
                      <p className="text-xs text-gray-400 mb-1">Message {i + 1}</p>
                      <p className="text-sm">{msg.substring(0, 100)}{msg.length > 100 ? '...' : ''}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={() => setCurrentStep('messages')}
                  className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg"
                >
                  Edit Campaign
                </button>
                <button
                  onClick={launchCampaign}
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-800 rounded-lg flex items-center justify-center"
                >
                  {loading ? (
                    <><Clock className="animate-spin mr-2" size={20} /> Launching...</>
                  ) : (
                    <><Play className="mr-2" size={20} /> Launch Campaign</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Launched */}
          {currentStep === 'launch' && (
            <div className="text-center space-y-6 py-12">
              <div className="flex justify-center">
                <CheckCircle className="text-green-500" size={80} />
              </div>
              <h2 className="text-3xl font-bold">Campaign Launched!</h2>
              <p className="text-gray-400">
                Your campaign is now active and sending messages to {selectedProspects.size} prospects.
              </p>
              <div className="space-x-4">
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  Create Another Campaign
                </button>
                <button
                  onClick={() => window.location.href = '/'}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
