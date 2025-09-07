import React, { useState, useEffect } from 'react';
import { 
  MessageCircle, 
  Book, 
  GraduationCap, 
  Users, 
  Megaphone, 
  TrendingUp,
  Settings,
  X,
  Send,
  Paperclip
} from 'lucide-react';

interface Message {
  id: number;
  sender: 'sam' | 'user';
  content: string;
}

function App() {
  const [messages] = useState<Message[]>([]);
  const [showStarterScreen, setShowStarterScreen] = useState(true);

  const [inputMessage, setInputMessage] = useState('');
  const [activeMenuItem, setActiveMenuItem] = useState('chat');
  const [dots, setDots] = useState('');

  // Animated dots for status bar
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '●●●') return '';
        return prev + '●';
      });
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const menuItems = [
    { id: 'chat', label: 'Chat with Sam', icon: MessageCircle, active: true },
    { id: 'knowledge', label: 'Knowledge Base', icon: Book, active: false },
    { id: 'training', label: 'Sam Training Room', icon: GraduationCap, active: false },
    { id: 'contact', label: 'Contact Center', icon: Users, active: false },
    { id: 'campaign', label: 'Campaign Hub', icon: Megaphone, active: false },
    { id: 'pipeline', label: 'Lead Pipeline', icon: TrendingUp, active: false }
  ];

  const handleSendMessage = () => {
    if (inputMessage.trim()) {
      console.log('Sending message:', inputMessage);
      setInputMessage('');
      
      // Hide starter screen when user sends first message
      if (showStarterScreen) {
        setShowStarterScreen(false);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex h-screen bg-gray-800">
      {/* Left Sidebar */}
      <div className="w-64 bg-gray-700 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-600">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <img 
                src="/SAM.jpg" 
                alt="Sam AI" 
                className="w-10 h-10 rounded-full object-cover"
                style={{ objectPosition: 'center 30%' }}
              />
              <div>
                <h2 className="text-white font-bold text-base">SAM AI ✨</h2>
                <p className="text-gray-400 text-sm">Sales Assistant</p>
              </div>
            </div>
            <button className="text-gray-400 hover:text-gray-300 transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 py-2">
          <nav className="space-y-1 px-3">
            {menuItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = item.id === activeMenuItem;
              
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveMenuItem(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                     ? 'bg-purple-600 text-white'
                      : 'text-gray-400 hover:bg-gray-600 hover:text-gray-300'
                  }`}
                >
                  <IconComponent size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Bottom */}
        <div className="border-t border-gray-600">
          <button className="w-full flex items-center space-x-3 px-6 py-3 text-gray-400 hover:bg-gray-600 hover:text-gray-300 transition-colors">
            <Settings size={18} />
            <span className="text-sm font-medium">Settings</span>
          </button>
          
          <div className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-medium text-sm">
                TL
              </div>
              <div>
                <p className="text-white text-sm font-medium">Thorsten Linz</p>
                <p className="text-purple-400 text-xs">Active</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-900 relative">
        {/* Conditional Rendering */}
        {showStarterScreen ? (
          /* STARTER SCREEN */
          <div className="flex-1 flex flex-col items-center justify-start pt-24 p-6">
            {/* Large Sam Image */}
            <div className="mb-12">
              <img 
                src="/SAM.jpg" 
                alt="Sam AI" 
                className="w-48 h-48 rounded-full object-cover shadow-lg"
                style={{ objectPosition: 'center 30%' }}
              />
            </div>
            
            {/* CTA Text */}
            <div className="text-center">
              <h2 className="text-white text-2xl font-medium">
                What do you want to get done today?
              </h2>
            </div>
          </div>
        ) : (
          /* CHAT MESSAGES - Existing chat area */
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] ${message.sender === 'user' ? 'order-2' : 'order-1'}`}>
                  {message.sender === 'sam' && (
                    <div className="flex items-start space-x-3">
                      <img 
                        src="/SAM.jpg" 
                        alt="Sam AI" 
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-1"
                        style={{ objectPosition: 'center 30%' }}
                      />
                      <div className="bg-gray-700 text-white px-4 py-3 rounded-2xl">
                        <p className="text-sm leading-relaxed">{message.content}</p>
                      </div>
                    </div>
                  )}
                  {message.sender === 'user' && (
                    <div className="flex items-center justify-end space-x-2 mb-1">
                      <span className="text-gray-400 text-sm font-medium">You</span>
                    </div>
                  )}
                  {message.sender === 'user' && (
                    <div className="bg-gray-800 text-white px-4 py-3 rounded-2xl">
                      <p className="text-sm leading-relaxed">{message.content}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CENTERED INPUT CONTAINER */}
        <div className="absolute inset-x-6 bottom-6 max-w-4xl mx-auto">
          {/* Status Bar - BLACK background */}
          <div className="bg-black text-white px-4 py-3 rounded-t-lg">
            <div className="flex items-center space-x-3">
              <span className="text-sm">Setting up...</span>
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
              </div>
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Sam is starting up...
            </div>
          </div>
          
          {/* Input Area - GRAY background, attached below */}
          <div className="bg-gray-700 p-4 rounded-b-lg">
            <div className="flex items-end bg-gray-600 rounded-lg px-4 py-2">
              <button className="text-gray-400 hover:text-gray-200 transition-colors p-1 mr-2">
                <Paperclip size={18} />
              </button>
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="What do you want to get done?"
                className="flex-1 bg-transparent text-white placeholder-gray-400 text-base pl-3 pr-3 py-2 outline-none resize-vertical min-h-[96px] max-h-48"
                style={{ textAlign: 'left' }}
                rows={4}
              />
              <button
                onClick={handleSendMessage}
                className="text-gray-400 hover:text-gray-200 transition-colors ml-2 px-3 py-1 flex items-center space-x-1"
              >
                <span className="text-sm font-medium">Send</span>
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;