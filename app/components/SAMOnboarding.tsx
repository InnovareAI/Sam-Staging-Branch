'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, User, Building2, Target, FileText, Send, CheckCircle, Upload, ArrowRight } from 'lucide-react';

// Onboarding Flow Data
const ONBOARDING_FLOWS = {
  welcome: [
    "Welcome! I'm Sam. What's your name?",
    "Great to meet you, {name}. Have you ever worked with an AI assistant like me before? If so, how was the experience?",
    "I help B2B companies by building ICPs, managing knowledge, and running campaigns."
  ],
  company_discovery: [
    "Tell me about your company in a sentence or two.",
    "What markets are you serving today?",
    "What products/services do you offer?",
    "Who's your dream customer?"
  ],
  build_icp: [
    "So far, I have {summary}. Does that sound right?",
    "Would you like to add decision-maker titles or company size filters?",
    "Great, I've saved your ICP to the knowledge base."
  ],
  expand_kb: [
    "When do your customers typically make new investments?",
    "Who else is usually involved in decisions?",
    "What are your top priorities and roadblocks?",
    "What solutions are you using today, and what frustrates you about them?",
    "How do your customers usually express their problems?",
    "What makes your solution different from what they've tried before?",
    "What value are customers expecting from a new solution?",
    "What are the typical objections or fears they raise?"
  ],
  upload_prompt: [
    "You can also upload pitch decks, one-pagers, or competitor docs — I'll add them to your knowledge base.",
    "Document uploads make it faster for me to learn your products and markets."
  ]
};

// Inquiry Response Data
const INQUIRY_RESPONSES = {
  saas: {
    CTO: {
      tone: "Technical, concise, credibility-first",
      faqs: [
        { q: "How do you integrate with our stack?", a: "Pre-built connectors and open APIs. Most CTOs integrate in under 2 weeks." },
        { q: "What about SOC 2 & HIPAA compliance?", a: "We're SOC 2 Type II and HIPAA compliant with full audit logs." },
        { q: "How do you handle uptime?", a: "99.99% SLA backed by redundant architecture and 24/7 monitoring." },
        { q: "Do you integrate with Salesforce/HubSpot?", a: "Yes, with native integrations for Salesforce, HubSpot, and Slack." },
        { q: "What security framework do you follow?", a: "Zero-trust, RBAC, encryption at rest and in transit, ISO27001 aligned." }
      ],
      objections: [
        { o: "We already use [Competitor X].", a: "Clients migrated for faster integrations and better compliance support." },
        { o: "Budget frozen this quarter.", a: "Start with a pilot — ROI in 60 days helps unlock budget." },
        { o: "Implementation is risky.", a: "Phased rollout with sandbox validation minimizes risk." }
      ]
    },
    CFO: {
      tone: "Outcome-focused, ROI-driven",
      faqs: [
        { q: "What ROI can we expect?", a: "3x ROI in <12 months via churn reduction and pipeline acceleration." },
        { q: "What's your pricing model?", a: "Subscription or usage-based — most CFOs prefer usage for scalability." },
        { q: "How do you prove ROI quickly?", a: "Pilot programs deliver measurable ROI in 60–90 days." }
      ],
      objections: [
        { o: "We're cutting budgets.", a: "ROI offsets spend — pilots prove payback within the quarter." },
        { o: "Competitors are cheaper.", a: "But lack compliance coverage and scalability." }
      ]
    },
    VP_Sales: {
      tone: "Practical, growth-focused, enablement-first",
      faqs: [
        { q: "How does this help pipeline growth?", a: "Increases pipeline velocity by 25–30% with better outreach personalization." },
        { q: "What about rep adoption?", a: "UX designed for sales reps — adoption >85% within 2 weeks." },
        { q: "Do you integrate with Salesforce/HubSpot?", a: "Yes, with plug-and-play CRM integrations." }
      ],
      objections: [
        { o: "Our reps hate new tools.", a: "Simple UX ensures reps prefer it over generic CRM add-ons." },
        { o: "Too much overlap with CRM.", a: "We enhance CRM by automating manual steps and improving targeting." }
      ]
    }
  }
};

type Message = {
  id: string;
  type: 'sam' | 'user';
  content: string;
  timestamp: Date;
};

type OnboardingStep = 'welcome' | 'company_discovery' | 'build_icp' | 'expand_kb' | 'upload_prompt' | 'completed';

interface SAMOnboardingProps {
  onComplete?: (data: any) => void;
}

const SAMOnboarding: React.FC<SAMOnboardingProps> = ({ onComplete }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [userData, setUserData] = useState({
    name: '',
    company: '',
    markets: '',
    products: '',
    dreamCustomer: '',
    hasExperience: false
  });
  const [isTyping, setIsTyping] = useState(false);

  // Track timeouts for cleanup on unmount
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);
  const isMountedRef = useRef(true);

  // Cleanup timeouts on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
      timeoutRefs.current = [];
    };
  }, []);

  useEffect(() => {
    // Start with welcome message
    addSAMMessage(ONBOARDING_FLOWS.welcome[0]);
  }, []);

  const addSAMMessage = (content: string) => {
    setIsTyping(true);
    const timeout = setTimeout(() => {
      if (!isMountedRef.current) return; // Don't update if unmounted
      const message: Message = {
        id: Date.now().toString(),
        type: 'sam',
        content: content.replace('{name}', userData.name),
        timestamp: new Date()
      };
      setMessages(prev => [...prev, message]);
      setIsTyping(false);
    }, 1000 + Math.random() * 1000); // Simulate typing delay
    timeoutRefs.current.push(timeout);
  };

  const addUserMessage = (content: string) => {
    const message: Message = {
      id: Date.now().toString(),
      type: 'user',
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, message]);
  };

  const handleSendMessage = () => {
    if (!userInput.trim()) return;

    addUserMessage(userInput);
    processUserResponse(userInput);
    setUserInput('');
  };

  const processUserResponse = (response: string) => {
    const flow = ONBOARDING_FLOWS[currentStep];
    
    // Update user data based on current step
    if (currentStep === 'welcome') {
      if (currentQuestion === 0) {
        setUserData(prev => ({ ...prev, name: response }));
      } else if (currentQuestion === 1) {
        setUserData(prev => ({ ...prev, hasExperience: response.toLowerCase().includes('yes') }));
      }
    } else if (currentStep === 'company_discovery') {
      if (currentQuestion === 0) {
        setUserData(prev => ({ ...prev, company: response }));
      } else if (currentQuestion === 1) {
        setUserData(prev => ({ ...prev, markets: response }));
      } else if (currentQuestion === 2) {
        setUserData(prev => ({ ...prev, products: response }));
      } else if (currentQuestion === 3) {
        setUserData(prev => ({ ...prev, dreamCustomer: response }));
      }
    }

    // Move to next question or step
    if (currentQuestion < flow.length - 1) {
      setCurrentQuestion(prev => prev + 1);
      const timeout = setTimeout(() => {
        if (!isMountedRef.current) return;
        addSAMMessage(flow[currentQuestion + 1]);
      }, 500);
      timeoutRefs.current.push(timeout);
    } else {
      // Move to next step
      moveToNextStep();
    }
  };

  const moveToNextStep = () => {
    const stepOrder: OnboardingStep[] = ['welcome', 'company_discovery', 'build_icp', 'expand_kb', 'upload_prompt', 'completed'];
    const currentIndex = stepOrder.indexOf(currentStep);
    
    if (currentIndex < stepOrder.length - 1) {
      const nextStep = stepOrder[currentIndex + 1];
      setCurrentStep(nextStep);
      setCurrentQuestion(0);
      
      if (nextStep === 'build_icp') {
        const summary = `${userData.company} serving ${userData.markets} with ${userData.products}, targeting ${userData.dreamCustomer}`;
        const message = ONBOARDING_FLOWS[nextStep][0].replace('{summary}', summary);
        const timeout = setTimeout(() => {
          if (!isMountedRef.current) return;
          addSAMMessage(message);
        }, 1000);
        timeoutRefs.current.push(timeout);
      } else if (nextStep === 'completed') {
        const timeout = setTimeout(() => {
          if (!isMountedRef.current) return;
          addSAMMessage("Perfect! Your knowledge base is set up. I'm now ready to help you with personalized outreach campaigns.");
          onComplete?.(userData);
        }, 1000);
        timeoutRefs.current.push(timeout);
      } else {
        const timeout = setTimeout(() => {
          if (!isMountedRef.current) return;
          addSAMMessage(ONBOARDING_FLOWS[nextStep][0]);
        }, 1000);
        timeoutRefs.current.push(timeout);
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
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 h-[600px] flex flex-col">
      {/* Header */}
      <div className="flex items-center mb-4 pb-4 border-b border-gray-700">
        <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center mr-3">
          <MessageCircle className="text-white" size={20} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">SAM AI Assistant</h3>
          <p className="text-sm text-gray-400">Let's set up your knowledge base</p>
        </div>
        <div className="ml-auto">
          <div className="flex items-center space-x-2">
            {['welcome', 'company_discovery', 'build_icp', 'expand_kb', 'upload_prompt'].map((step, index) => (
              <div
                key={step}
                className={`w-3 h-3 rounded-full ${
                  ['welcome', 'company_discovery', 'build_icp', 'expand_kb', 'upload_prompt'].indexOf(currentStep) >= index
                    ? 'bg-purple-500'
                    : 'bg-gray-600'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-lg ${
                message.type === 'user'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-100'
              }`}
            >
              <p className="text-sm">{message.content}</p>
              <p className="text-xs opacity-70 mt-1">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-700 text-gray-100 p-3 rounded-lg">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      {currentStep !== 'completed' && (
        <div className="flex space-x-2">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your response..."
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={handleSendMessage}
            disabled={!userInput.trim()}
            className="bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      )}

      {/* Completion Actions */}
      {currentStep === 'completed' && (
        <div className="space-y-3">
          <div className="flex items-center justify-center space-x-4">
            <button className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-lg transition-colors">
              <Upload size={16} />
              <span>Upload Documents</span>
            </button>
            <button className="flex items-center space-x-2 bg-gray-600 hover:bg-gray-500 text-white px-6 py-3 rounded-lg transition-colors">
              <Target size={16} />
              <span>Configure ICP</span>
            </button>
            <button className="flex items-center space-x-2 bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-lg transition-colors">
              <ArrowRight size={16} />
              <span>Start Campaign</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SAMOnboarding;