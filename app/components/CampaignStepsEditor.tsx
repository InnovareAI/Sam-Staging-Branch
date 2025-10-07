import { toastSuccess, toastError, toastWarning, toastInfo } from '@/lib/toast';

'use client';


// Helper to determine if campaign is LinkedIn-based
function isLinkedInCampaign(type: string): boolean {
  return ['connector', 'messenger', 'open_inmail', 'builder', 'group', 'event_invite', 'inbound', 'event_participants', 'recovery', 'company_follow'].includes(type);
}

// Helper to get campaign type label
function getCampaignTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'connector': 'LinkedIn Connector',
    'messenger': 'LinkedIn Messenger',
    'open_inmail': 'LinkedIn Open InMail',
    'builder': 'LinkedIn Builder',
    'group': 'LinkedIn Group',
    'event_invite': 'LinkedIn Event Invite',
    'inbound': 'LinkedIn Inbound',
    'event_participants': 'LinkedIn Event Participants',
    'recovery': 'LinkedIn Recovery',
    'company_follow': 'LinkedIn Company Follow',
    'email': 'Email'
  };
  return labels[type] || type;
}

interface CampaignStep {
  id: string;
  stepNumber: number;
  stepType: 'connection_request' | 'follow_up' | 'final_message';
  messageText: string;
  delayDays: number;
  characterCount: number;
}

interface CampaignStepsEditorProps {
  campaignId: string;
  campaignName: string;
  campaignType: 'connector' | 'messenger' | 'open_inmail' | 'builder' | 'group' | 'event_invite' | 'inbound' | 'event_participants' | 'recovery' | 'company_follow' | 'email';
  onClose: () => void;
  onSave: (steps: CampaignStep[]) => void;
}

export default function CampaignStepsEditor({
  campaignId,
  campaignName,
  campaignType,
  onClose,
  onSave
}: CampaignStepsEditorProps) {
  const [steps, setSteps] = useState<CampaignStep[]>([
    {
      id: '1',
      stepNumber: 1,
      stepType: 'connection_request',
      messageText: 'Hi {{first_name}}, I noticed your work in {{industry}}. Would love to connect!',
      delayDays: 0,
      characterCount: 78
    },
    {
      id: '2',
      stepNumber: 2,
      stepType: 'follow_up',
      messageText: 'Following up on my connection request. I help {{job_title}}s solve {{pain_point}}.',
      delayDays: 3,
      characterCount: 85
    },
    {
      id: '3',
      stepNumber: 3,
      stepType: 'follow_up',
      messageText: 'Quick case study: {{company_name}} increased conversions by 40% using our approach.',
      delayDays: 7,
      characterCount: 87
    }
  ]);

  const [selectedStepId, setSelectedStepId] = useState<string>('1');
  const [showSAMChat, setShowSAMChat] = useState(false);
  const [samMessages, setSamMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    { role: 'assistant', content: 'Hi! I can help you craft compelling campaign messages. What would you like to work on?' }
  ]);
  const [samInput, setSamInput] = useState('');
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const selectedStep = steps.find(s => s.id === selectedStepId);

  const personalizationTags = [
    { tag: '{{first_name}}', description: 'Prospect first name' },
    { tag: '{{last_name}}', description: 'Prospect last name' },
    { tag: '{{company_name}}', description: 'Company name' },
    { tag: '{{job_title}}', description: 'Job title' },
    { tag: '{{industry}}', description: 'Industry' },
    { tag: '{{pain_point}}', description: 'Custom pain point' },
    { tag: '{{value_prop}}', description: 'Custom value proposition' }
  ];

  const addStep = () => {
    const newStep: CampaignStep = {
      id: String(steps.length + 1),
      stepNumber: steps.length + 1,
      stepType: 'follow_up',
      messageText: '',
      delayDays: steps[steps.length - 1].delayDays + 3,
      characterCount: 0
    };
    setSteps([...steps, newStep]);
    setSelectedStepId(newStep.id);
  };

  const deleteStep = (stepId: string) => {
    if (steps.length <= 1) {
      toastError('You must have at least one message step');
      return;
    }
    const newSteps = steps.filter(s => s.id !== stepId).map((s, idx) => ({
      ...s,
      stepNumber: idx + 1
    }));
    setSteps(newSteps);
    if (selectedStepId === stepId) {
      setSelectedStepId(newSteps[0].id);
    }
  };

  const updateStepMessage = (stepId: string, message: string) => {
    setSteps(steps.map(s => s.id === stepId ? {
      ...s,
      messageText: message,
      characterCount: message.length
    } : s));
  };

  const updateStepDelay = (stepId: string, days: number) => {
    setSteps(steps.map(s => s.id === stepId ? { ...s, delayDays: days } : s));
  };

  const insertTag = (tag: string) => {
    if (!selectedStep) return;
    const newMessage = selectedStep.messageText + tag;
    updateStepMessage(selectedStepId, newMessage);
  };

  const handleSAMChat = () => {
    if (!samInput.trim()) return;

    // Add user message
    setSamMessages([...samMessages, { role: 'user', content: samInput }]);

    // Simulate SAM response (in production, this would call the SAM API)
    setTimeout(() => {
      setSamMessages(prev => [...prev, {
        role: 'assistant',
        content: `Great question! For ${getCampaignTypeLabel(campaignType)} campaigns, I'd recommend focusing on personalization and value. Here's a message template:\n\n"Hi {{first_name}}, noticed ${isLinkedInCampaign(campaignType) ? 'your recent post about' : 'that'} {{industry}}. We help companies like {{company_name}} achieve {{value_prop}}. Worth a quick chat?"\n\nWould you like me to refine this further?`
      }]);
    }, 1000);

    setSamInput('');
  };

  const handleSave = () => {
    onSave(steps);
    onClose();
  };

  const handleAskSAMToDraft = () => {
    if (!selectedStep) return;

    const stepType = selectedStep.stepType === 'connection_request' ? 'connection request' : `follow-up message ${selectedStep.stepNumber - 1}`;
    const prompt = `Can you help me draft a ${stepType} for my ${getCampaignTypeLabel(campaignType)} campaign? The message should be professional, engaging, and include personalization tags.`;

    setSamMessages(prev => [...prev, { role: 'user', content: prompt }]);
    setShowSAMChat(true);

    // Simulate SAM response
    setTimeout(() => {
      const draftMessage = selectedStep.stepType === 'connection_request'
        ? `Hi {{first_name}}, I noticed your work in {{industry}} at {{company_name}}. I help ${isLinkedInCampaign(campaignType) ? 'professionals like you' : 'companies'} achieve {{value_prop}}. Would love to connect!`
        : `Hi {{first_name}}, following up on my previous message. I wanted to share a quick insight about {{pain_point}} that might be relevant to {{company_name}}. Would you be open to a brief chat?`;

      setSamMessages(prev => [...prev, {
        role: 'assistant',
        content: `Here's a draft ${stepType} for you:\n\n"${draftMessage}"\n\nThis message:\n✓ Uses personalization (${isLinkedInCampaign(campaignType) && selectedStep.stepType === 'connection_request' ? '275' : '1000'} chars max)\n✓ Clearly states value proposition\n✓ Includes a gentle call-to-action\n\nWould you like me to adjust the tone or add anything specific?`
      }]);

      // Auto-fill the message
      updateStepMessage(selectedStepId, draftMessage);
    }, 1500);
  };

  const handleUploadTemplate = () => {
    // Simulate file upload
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.doc,.docx';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        setUploadingTemplate(true);
        // Simulate processing
        setTimeout(() => {
          const mockTemplateContent = `Hi {{first_name}},\n\nI came across your profile and was impressed by your work at {{company_name}}.\n\nWe help {{job_title}}s like yourself solve {{pain_point}} and achieve {{value_prop}}.\n\nWould you be open to a quick conversation?\n\nBest,\n[Your Name]`;

          if (selectedStep) {
            updateStepMessage(selectedStepId, mockTemplateContent);
          }
          setUploadingTemplate(false);
          toastError(`Template "${file.name}" uploaded and applied to current step!`);
        }, 1000);
      }
    };
    input.click();
  };

  const handleLoadFromLibrary = () => {
    setShowTemplateLibrary(true);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg w-full h-full max-w-full max-h-full flex flex-col">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white flex items-center gap-2 transition-colors"
                title="Back to campaigns"
              >
                <ArrowLeft size={20} />
                <span className="text-sm">Back</span>
              </button>
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Campaign Steps Editor</h2>
                <p className="text-gray-400">{campaignName} • {getCampaignTypeLabel(campaignType)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSettings(true)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-2 transition-colors"
                title="Campaign settings"
              >
                <Settings size={18} />
                Settings
              </button>
              <button
                onClick={() => setShowSAMChat(!showSAMChat)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2"
              >
                <MessageSquare size={18} />
                {showSAMChat ? 'Hide SAM' : 'Ask SAM'}
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
              >
                Save Changes
              </button>
              <button onClick={onClose} className="text-gray-400 hover:text-white" title="Close">
                <X size={24} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar - Steps List */}
          <div className="w-80 bg-gray-800 border-r border-gray-700 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Message Steps ({steps.length})</h3>
              <button
                onClick={addStep}
                className="text-purple-400 hover:text-purple-300"
              >
                <Plus size={20} />
              </button>
            </div>

            <div className="space-y-2">
              {steps.map((step) => (
                <div
                  key={step.id}
                  onClick={() => setSelectedStepId(step.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedStepId === step.id
                      ? 'bg-purple-600'
                      : 'bg-gray-700 hover:bg-gray-650'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <GripVertical size={16} className="text-gray-400" />
                      <span className="text-white font-medium">Step {step.stepNumber}</span>
                    </div>
                    {step.stepNumber > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteStep(step.id);
                        }}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-gray-300 mb-1">
                    {step.stepType === 'connection_request' ? 'Connection Request' : `Follow-up • Day ${step.delayDays}`}
                  </div>
                  <div className="text-xs text-gray-400 line-clamp-2">
                    {step.messageText || 'No message yet...'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {step.characterCount} characters
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Main Editor Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 p-6 overflow-y-auto">
              {selectedStep && (
                <div className="max-w-4xl mx-auto">
                  <div className="bg-gray-800 rounded-lg p-6 mb-6">
                    <h3 className="text-xl font-semibold text-white mb-4">
                      Step {selectedStep.stepNumber}: {selectedStep.stepType === 'connection_request' ? 'Connection Request' : 'Follow-up Message'}
                    </h3>

                    {/* Delay Days */}
                    <div className="mb-6">
                      <label className="text-white font-medium mb-2 flex items-center gap-2">
                        <Calendar size={18} />
                        Days after previous step
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={selectedStep.delayDays}
                        onChange={(e) => updateStepDelay(selectedStep.id, parseInt(e.target.value))}
                        className="w-32 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                        disabled={selectedStep.stepNumber === 1}
                      />
                      {selectedStep.stepNumber === 1 && (
                        <p className="text-gray-400 text-sm mt-1">First message sends immediately</p>
                      )}
                    </div>

                    {/* Message Text */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-white font-medium">Message Text</label>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleAskSAMToDraft}
                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded flex items-center gap-1.5"
                          >
                            <MessageSquare size={14} />
                            Ask SAM to Draft
                          </button>
                          <button
                            onClick={handleUploadTemplate}
                            disabled={uploadingTemplate}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <Upload size={14} />
                            {uploadingTemplate ? 'Uploading...' : 'Upload Template'}
                          </button>
                          <button
                            onClick={handleLoadFromLibrary}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded flex items-center gap-1.5"
                          >
                            <FileText size={14} />
                            Template Library
                          </button>
                        </div>
                      </div>
                      <textarea
                        value={selectedStep.messageText}
                        onChange={(e) => updateStepMessage(selectedStep.id, e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-3 text-white min-h-[200px] focus:border-purple-500 focus:outline-none"
                        placeholder="Enter your message here..."
                        maxLength={isLinkedInCampaign(campaignType) && selectedStep.stepType === 'connection_request' ? 275 : 1000}
                      />
                      <div className="flex items-center justify-between mt-2">
                        <span className={`text-sm ${
                          (isLinkedInCampaign(campaignType) && selectedStep.stepType === 'connection_request' && selectedStep.characterCount > 275) ||
                          (selectedStep.characterCount > 1000)
                            ? 'text-red-400 font-semibold'
                            : 'text-gray-400'
                        }`}>
                          Characters: {selectedStep.characterCount}
                          {isLinkedInCampaign(campaignType) && selectedStep.stepType === 'connection_request' && (
                            <span className={selectedStep.characterCount > 275 ? 'text-red-400 ml-2' : 'text-yellow-400 ml-2'}>
                              / 275 (LinkedIn connection request limit)
                            </span>
                          )}
                          {isLinkedInCampaign(campaignType) && selectedStep.stepType !== 'connection_request' && (
                            <span className={selectedStep.characterCount > 1000 ? 'text-red-400 ml-2' : 'text-gray-500 ml-2'}>
                              / 1000 (LinkedIn message limit)
                            </span>
                          )}
                          {campaignType === 'email' && (
                            <span className="text-gray-500 ml-2">
                              / 1000 (recommended)
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Personalization Tags */}
                    <div className="bg-gray-700 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Tag size={18} className="text-purple-400" />
                        <h4 className="text-white font-medium">Personalization Tags</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {personalizationTags.map((item) => (
                          <button
                            key={item.tag}
                            onClick={() => insertTag(item.tag)}
                            className="text-left p-2 bg-gray-600 hover:bg-gray-550 rounded text-sm transition-colors"
                          >
                            <div className="text-purple-300 font-mono">{item.tag}</div>
                            <div className="text-gray-400 text-xs">{item.description}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar - SAM Chat */}
          {showSAMChat && (
            <div className="w-96 bg-gray-800 border-l border-gray-700 flex flex-col">
              <div className="p-4 border-b border-gray-700">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <MessageSquare size={20} className="text-purple-400" />
                  Ask SAM for Help
                </h3>
                <p className="text-gray-400 text-sm mt-1">Get messaging suggestions and best practices</p>
              </div>

              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {samMessages.map((msg, idx) => (
                  <div key={idx} className={`${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                    <div
                      className={`inline-block p-3 rounded-lg max-w-[85%] ${
                        msg.role === 'user'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-700 text-gray-200'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-gray-700">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={samInput}
                    onChange={(e) => setSamInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSAMChat()}
                    placeholder="Ask SAM about your messaging..."
                    className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none"
                  />
                  <button
                    onClick={handleSAMChat}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Template Library Modal */}
        {showTemplateLibrary && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg w-full max-w-4xl mx-4 max-h-[80vh] overflow-hidden border border-gray-600">
              <div className="p-6 border-b border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-white">Template Library</h3>
                  <button onClick={() => setShowTemplateLibrary(false)} className="text-gray-400 hover:text-white">
                    <X size={24} />
                  </button>
                </div>
                <p className="text-gray-400 text-sm mt-2">Select a pre-built template to apply to this step</p>
              </div>

              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Template 1 */}
                  <div className="bg-gray-700 rounded-lg p-4 hover:bg-gray-650 cursor-pointer border border-gray-600 hover:border-purple-500 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-white font-semibold">Professional Connection</h4>
                      <span className="text-xs px-2 py-1 bg-purple-600 text-white rounded">LinkedIn</span>
                    </div>
                    <p className="text-gray-400 text-sm mb-3">
                      Hi {'{{first_name}}'}, I noticed your work in {'{{industry}}'} at {'{{company_name}}'}. I'd love to connect and exchange insights.
                    </p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">275 characters</span>
                      <button
                        onClick={() => {
                          if (selectedStep) {
                            updateStepMessage(selectedStepId, `Hi {{first_name}}, I noticed your work in {{industry}} at {{company_name}}. I'd love to connect and exchange insights.`);
                          }
                          setShowTemplateLibrary(false);
                        }}
                        className="text-purple-400 hover:text-purple-300"
                      >
                        Use Template
                      </button>
                    </div>
                  </div>

                  {/* Template 2 */}
                  <div className="bg-gray-700 rounded-lg p-4 hover:bg-gray-650 cursor-pointer border border-gray-600 hover:border-purple-500 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-white font-semibold">Value-First Approach</h4>
                      <span className="text-xs px-2 py-1 bg-blue-600 text-white rounded">Both</span>
                    </div>
                    <p className="text-gray-400 text-sm mb-3">
                      Hi {'{{first_name}}'}, saw that {'{{company_name}}'} is growing fast. We help {'{{job_title}}'}s solve {'{{pain_point}}'} - would love to share some insights.
                    </p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">187 characters</span>
                      <button
                        onClick={() => {
                          if (selectedStep) {
                            updateStepMessage(selectedStepId, `Hi {{first_name}}, saw that {{company_name}} is growing fast. We help {{job_title}}s solve {{pain_point}} - would love to share some insights.`);
                          }
                          setShowTemplateLibrary(false);
                        }}
                        className="text-purple-400 hover:text-purple-300"
                      >
                        Use Template
                      </button>
                    </div>
                  </div>

                  {/* Template 3 */}
                  <div className="bg-gray-700 rounded-lg p-4 hover:bg-gray-650 cursor-pointer border border-gray-600 hover:border-purple-500 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-white font-semibold">Follow-up: Case Study</h4>
                      <span className="text-xs px-2 py-1 bg-green-600 text-white rounded">Follow-up</span>
                    </div>
                    <p className="text-gray-400 text-sm mb-3">
                      Hi {'{{first_name}}'}, wanted to share a quick case study. We helped a {'{{industry}}'} company achieve {'{{value_prop}}'} in 90 days. Worth a quick chat?
                    </p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">178 characters</span>
                      <button
                        onClick={() => {
                          if (selectedStep) {
                            updateStepMessage(selectedStepId, `Hi {{first_name}}, wanted to share a quick case study. We helped a {{industry}} company achieve {{value_prop}} in 90 days. Worth a quick chat?`);
                          }
                          setShowTemplateLibrary(false);
                        }}
                        className="text-purple-400 hover:text-purple-300"
                      >
                        Use Template
                      </button>
                    </div>
                  </div>

                  {/* Template 4 */}
                  <div className="bg-gray-700 rounded-lg p-4 hover:bg-gray-650 cursor-pointer border border-gray-600 hover:border-purple-500 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-white font-semibold">Follow-up: Resource Offer</h4>
                      <span className="text-xs px-2 py-1 bg-green-600 text-white rounded">Follow-up</span>
                    </div>
                    <p className="text-gray-400 text-sm mb-3">
                      Hey {'{{first_name}}'}, I put together a resource on solving {'{{pain_point}}'} that might be helpful for {'{{company_name}}'}. No strings attached - happy to share if interested.
                    </p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">203 characters</span>
                      <button
                        onClick={() => {
                          if (selectedStep) {
                            updateStepMessage(selectedStepId, `Hey {{first_name}}, I put together a resource on solving {{pain_point}} that might be helpful for {{company_name}}. No strings attached - happy to share if interested.`);
                          }
                          setShowTemplateLibrary(false);
                        }}
                        className="text-purple-400 hover:text-purple-300"
                      >
                        Use Template
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto border border-gray-600">
              <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings size={24} className="text-white" />
                    <h3 className="text-xl font-semibold text-white">Campaign Settings</h3>
                    <span className="text-xs px-2 py-1 bg-blue-600 text-white rounded ml-2">
                      {getCampaignTypeLabel(campaignType)}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Campaign Name */}
                <div className="border-b border-gray-700 pb-6">
                  <h4 className="text-white font-medium mb-2">Campaign name</h4>
                  <p className="text-gray-400 text-sm mb-3">Rename your campaign here for easier campaign management.</p>
                  <input
                    type="text"
                    defaultValue={campaignName}
                    maxLength={100}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none"
                  />
                  <div className="text-right text-gray-400 text-xs mt-1">Characters: {campaignName.length}/100</div>
                </div>

                {/* Campaign Limits */}
                <div className="border-b border-gray-700 pb-6">
                  <h4 className="text-white font-medium mb-2">Campaign limits</h4>
                  <p className="text-gray-400 text-sm mb-4">
                    Specify the daily limit for this campaign. These limits will be applied to reach out to your leads.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="text-gray-300 text-sm mb-2 block">
                        {isLinkedInCampaign(campaignType)
                          ? 'Set the number of new connection requests to send daily:'
                          : 'Set the number of new emails to send daily:'}
                      </label>
                      <input type="range" min="0" max="100" defaultValue="15" className="w-full" />
                      <div className="flex justify-between text-gray-400 text-xs mt-1">
                        <span>0</span>
                        <span className="text-white font-medium">15</span>
                        <span>100</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-gray-300 text-sm mb-2 block">
                        {isLinkedInCampaign(campaignType)
                          ? 'Set the number of LinkedIn follow-up messages to send daily:'
                          : 'Set the number of follow-up emails to send daily:'}
                      </label>
                      <input type="range" min="0" max="100" defaultValue="20" className="w-full" />
                      <div className="flex justify-between text-gray-400 text-xs mt-1">
                        <span>0</span>
                        <span className="text-white font-medium">20</span>
                        <span>100</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Campaign Priority */}
                <div className="border-b border-gray-700 pb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-white font-medium">Campaign Priority</h4>
                    <label className="flex items-center gap-2">
                      <span className="text-gray-300 text-sm">Use priority</span>
                      <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                    </label>
                  </div>
                  <p className="text-gray-400 text-sm mb-3">If enabled, each campaign will have a default priority value "Medium". If a campaign priority is changed to "High" more actions will be scheduled to be sent from it in comparison to campaigns with lower priority.</p>
                  <select className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm">
                    <option>Medium</option>
                    <option>High</option>
                    <option>Low</option>
                  </select>
                </div>

                {/* Schedule Campaign */}
                <div className="border-b border-gray-700 pb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-white font-medium">Schedule campaign</h4>
                    <label className="flex items-center gap-2">
                      <span className="text-gray-300 text-sm">Start immediately</span>
                      <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                    </label>
                  </div>
                  <p className="text-gray-400 text-sm mb-3">
                    {isLinkedInCampaign(campaignType)
                      ? 'You can schedule when campaign will be active. Once set to active, LinkedIn messages will start being sent during your account\'s active hours.'
                      : 'You can schedule when campaign will be active. Once set to active, emails will start being sent immediately.'}
                  </p>
                  <input
                    type="datetime-local"
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  />
                  <p className="text-gray-400 text-xs mt-2">Times are set according to the time zone US/Mountain (GMT -0600), which can also be set from the <span className="text-purple-400">account settings</span>.</p>
                </div>

                {/* Prospects */}
                <div className="border-b border-gray-700 pb-6">
                  <h4 className="text-white font-medium mb-2">Prospects</h4>
                  {isLinkedInCampaign(campaignType) ? (
                    <>
                      <p className="text-gray-400 text-sm mb-3">Override and allow outreaching to LinkedIn profiles from the same company</p>
                      <label className="flex items-center gap-3">
                        <input type="checkbox" className="w-4 h-4 rounded" />
                        <span className="text-white text-sm">Override LinkedIn profiles</span>
                      </label>
                      <p className="text-gray-400 text-xs mt-2">Enable duplicating leads between company campaigns</p>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-400 text-sm mb-3">Email campaign prospect settings</p>
                      <label className="flex items-center gap-3 mb-2">
                        <input type="checkbox" className="w-4 h-4 rounded" />
                        <span className="text-white text-sm">Allow duplicate email addresses</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input type="checkbox" className="w-4 h-4 rounded" defaultChecked />
                        <span className="text-white text-sm">Skip bounced emails</span>
                      </label>
                      <p className="text-gray-400 text-xs mt-2">Automatically skip previously bounced email addresses</p>
                    </>
                  )}
                </div>

                {/* Campaign Status */}
                <div className="border-b border-gray-700 pb-6">
                  <h4 className="text-white font-medium mb-2">Campaign status</h4>
                  <p className="text-gray-400 text-sm mb-3">
                    {isLinkedInCampaign(campaignType)
                      ? 'You can turn this campaign on and off. An active campaign will send LinkedIn connection requests and messages according to your settings.'
                      : 'You can turn this campaign on and off. An active campaign will send emails according to your settings.'}
                  </p>
                  <div className="space-y-2">
                    <select className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm">
                      <option value="active">Active - Campaign is running</option>
                      <option value="paused">Paused - Campaign is temporarily stopped</option>
                      <option value="inactive">Inactive - Campaign draft</option>
                      <option value="completed">Completed - Campaign finished</option>
                      <option value="archived">Archived - Campaign archived</option>
                    </select>
                  </div>
                </div>

                {/* Delete Campaign */}
                <div>
                  <h4 className="text-white font-medium mb-2">Delete campaign</h4>
                  <p className="text-gray-400 text-sm mb-3">Deleting a campaign will stop all the campaign's activity. Contacts from the campaign will remain in 'My Network' and in your 'Inbox', however, they will no longer receive messages from the deleted campaign. You will be able to continue manual communication with these contacts.</p>
                  <button className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">
                    <Trash2 size={16} />
                    Delete campaign
                  </button>
                </div>
              </div>

              <div className="sticky bottom-0 bg-gray-800 border-t border-gray-700 p-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    // TODO: Save settings to backend
                    toastError('Settings saved! (Backend integration pending)');
                    setShowSettings(false);
                  }}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
