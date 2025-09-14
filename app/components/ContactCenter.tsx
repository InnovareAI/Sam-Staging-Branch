'use client';

import React, { useState } from 'react';
import { 
  Mail, 
  Calendar, 
  DollarSign, 
  HelpCircle,
  Clock,
  ArrowRight,
  Users
} from 'lucide-react';

interface InboundRequest {
  id: string;
  type: 'demo' | 'pricing' | 'support';
  subject: string;
  from: string;
  time: string;
  company: string;
  details: string;
}

// Mock inbound requests data
const MOCK_REQUESTS = [
  { 
    id: '1', 
    type: 'demo' as const, 
    subject: 'Demo request from Acme Corp', 
    from: 'kevin@acme.com', 
    time: 'now',
    company: 'Acme Corp',
    details: 'Interested in our enterprise solution for 500+ employees' 
  },
  { 
    id: '2', 
    type: 'pricing' as const, 
    subject: 'Pricing for 10k leads', 
    from: 'mara@beta.com', 
    time: '5m',
    company: 'Beta Systems',
    details: 'Need pricing information for processing 10,000 leads monthly' 
  },
  { 
    id: '3', 
    type: 'support' as const, 
    subject: 'Login issue', 
    from: 'ops@charlie.com', 
    time: '10m',
    company: 'Charlie Solutions',
    details: 'Users unable to access dashboard since this morning' 
  },
  { 
    id: '4', 
    type: 'demo' as const, 
    subject: 'Product walkthrough request', 
    from: 'sarah@deltatech.com', 
    time: '1h',
    company: 'Delta Tech',
    details: 'Technical team wants to see API integration capabilities' 
  }
] satisfies InboundRequest[];

// Inbound Inbox Component from Contact Center v1
function InboundInbox() {
  const [activeRequest, setActiveRequest] = useState<InboundRequest>(MOCK_REQUESTS[0]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'demo': return Calendar;
      case 'pricing': return DollarSign;
      case 'support': return HelpCircle;
      default: return Mail;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'demo': return 'text-green-400 bg-green-900/20';
      case 'pricing': return 'text-blue-400 bg-blue-900/20';
      case 'support': return 'text-orange-400 bg-orange-900/20';
      default: return 'text-muted-foreground bg-muted/20';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      {/* Requests List */}
      <div className="lg:col-span-1 bg-gray-800 border border-gray-700 rounded-lg">
        <div className="border-b border-gray-700 p-4">
          <h3 className="text-white font-semibold">Inbound Requests</h3>
          <p className="text-gray-400 text-sm">Recent inquiries and requests</p>
        </div>
        <div className="divide-y divide-gray-700 max-h-96 overflow-y-auto">
          {MOCK_REQUESTS.map(request => {
            const IconComponent = getTypeIcon(request.type);
            const isActive = request.id === activeRequest.id;
            
            return (
              <div 
                key={request.id} 
                onClick={() => setActiveRequest(request)} 
                className={`p-4 cursor-pointer transition-colors ${
                  isActive ? 'bg-purple-900/30 border-l-4 border-l-purple-500' : 'hover:bg-gray-700'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className={`p-2 rounded-lg ${getTypeColor(request.type)}`}>
                    <IconComponent size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs uppercase font-medium ${getTypeColor(request.type).split(' ')[0]}`}>
                        {request.type}
                      </span>
                      <div className="flex items-center text-xs text-gray-400">
                        <Clock size={12} className="mr-1" />
                        {request.time}
                      </div>
                    </div>
                    <h4 className="text-sm text-white font-medium truncate mb-1">
                      {request.subject}
                    </h4>
                    <p className="text-xs text-gray-400 truncate">
                      {request.from} • {request.company}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Request Details */}
      <div className="lg:col-span-2 bg-gray-800 border border-gray-700 rounded-lg">
        <div className="border-b border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${getTypeColor(activeRequest.type)}`}>
                {React.createElement(getTypeIcon(activeRequest.type), { size: 20 })}
              </div>
              <div>
                <span className={`text-xs uppercase font-medium ${getTypeColor(activeRequest.type).split(' ')[0]}`}>
                  {activeRequest.type}
                </span>
                <h2 className="text-white font-semibold">{activeRequest.subject}</h2>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Contact Info */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">From:</span>
              <span className="text-white">{activeRequest.from}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Company:</span>
              <span className="text-white">{activeRequest.company}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Time:</span>
              <span className="text-white">{activeRequest.time}</span>
            </div>
          </div>

          {/* Request Details */}
          <div>
            <h4 className="text-white font-medium mb-2">Details</h4>
            <div className="bg-gray-700 rounded-lg p-4">
              <p className="text-gray-300 text-sm">{activeRequest.details}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-700">
            {activeRequest.type === 'demo' && (
              <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">
                <Calendar size={16} />
                Send Calendar Link
              </button>
            )}
            {activeRequest.type === 'pricing' && (
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                <DollarSign size={16} />
                Send Pricing Sheet
              </button>
            )}
            {activeRequest.type === 'support' && (
              <button className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors">
                <HelpCircle size={16} />
                Route to Support
              </button>
            )}
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-600 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors">
              <Users size={16} />
              Create Callback
            </button>
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-600 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors">
              <ArrowRight size={16} />
              Escalate to AE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const ContactCenter: React.FC = () => {
  return (
    <div className="flex-1 bg-background p-6 overflow-y-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Contact Center</h1>
        <p className="text-gray-400">Manage inbound requests and customer communications</p>
      </div>

      {/* Inbound Inbox */}
      <div className="h-[calc(100vh-200px)]">
        <InboundInbox />
      </div>
    </div>
  );
};

export default ContactCenter;