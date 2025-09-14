'use client'

import React, { useState, useEffect } from 'react'
import { Check, Mail, MessageSquare, Settings, AlertTriangle, Users, Clock, Target, Zap } from 'lucide-react'

interface ChannelSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (selection: ChannelSelection) => void
  connectedAccounts: ConnectedAccount[]
}

interface ConnectedAccount {
  id: string
  platform: 'gmail' | 'outlook' | 'smtp' | 'linkedin'
  email?: string
  name: string
  status: 'active' | 'expired' | 'error'
}

interface ChannelSelection {
  strategy: 'email_only' | 'linkedin_only' | 'email_first' | 'linkedin_first' | 'simultaneous'
  selectedAccounts: {
    email?: string[]
    linkedin?: string[]
  }
  preferences: {
    delayBetweenChannels: number // hours
    maxDailyOutreach: number
    followUpSequence: boolean
    personalizeByChannel: boolean
  }
}

const CHANNEL_STRATEGIES = [
  {
    id: 'email_only',
    name: 'Email Only',
    icon: Mail,
    description: 'Focus on email outreach with personalized sequences',
    pros: ['Higher volume capacity', 'Professional approach', 'Easy tracking'],
    cons: ['Lower initial response rates', 'Spam risk if not careful'],
    color: 'bg-blue-500',
    borderColor: 'border-blue-500',
    reachPotential: '800-1200 prospects/month',
    responseRate: '2-5%'
  },
  {
    id: 'linkedin_only', 
    name: 'LinkedIn Only',
    icon: Users,
    description: 'Professional networking approach via LinkedIn',
    pros: ['Higher response rates', 'Professional context', 'Relationship building'],
    cons: ['Volume limitations', 'Requires premium accounts', 'Platform restrictions'],
    color: 'bg-blue-600',
    borderColor: 'border-blue-600', 
    reachPotential: '200-400 prospects/month',
    responseRate: '8-15%'
  },
  {
    id: 'email_first',
    name: 'Email First, LinkedIn Follow-up',
    icon: MessageSquare,
    description: 'Start with email, follow up via LinkedIn for non-responders',
    pros: ['Best of both worlds', 'Higher overall response', 'Professional sequence'],
    cons: ['More complex setup', 'Requires both integrations', 'Longer sequences'],
    color: 'bg-purple-500',
    borderColor: 'border-purple-500',
    reachPotential: '600-800 prospects/month', 
    responseRate: '6-12%'
  },
  {
    id: 'linkedin_first',
    name: 'LinkedIn First, Email Follow-up', 
    icon: Target,
    description: 'Start with LinkedIn connection, follow up via email',
    pros: ['Personal touch first', 'High-value approach', 'Strong relationship building'],
    cons: ['Slower start', 'LinkedIn limits', 'More manual work'],
    color: 'bg-green-500',
    borderColor: 'border-green-500',
    reachPotential: '400-600 prospects/month',
    responseRate: '10-18%'
  },
  {
    id: 'simultaneous',
    name: 'Multi-Channel Blitz',
    icon: Zap,
    description: 'Simultaneous outreach across all available channels',
    pros: ['Maximum visibility', 'Fast results', 'Multi-touchpoint approach'],
    cons: ['Risk of seeming pushy', 'Higher costs', 'Coordination complexity'],
    color: 'bg-orange-500',
    borderColor: 'border-orange-500',
    reachPotential: '300-500 prospects/month',
    responseRate: '12-20%'
  }
]

export function ChannelSelectionModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  connectedAccounts 
}: ChannelSelectionModalProps) {
  const [selectedStrategy, setSelectedStrategy] = useState<string>('')
  const [selectedAccounts, setSelectedAccounts] = useState<{email: string[], linkedin: string[]}>({
    email: [],
    linkedin: []
  })
  const [preferences, setPreferences] = useState({
    delayBetweenChannels: 24,
    maxDailyOutreach: 50,
    followUpSequence: true,
    personalizeByChannel: true
  })
  const [currentStep, setCurrentStep] = useState<'strategy' | 'accounts' | 'preferences' | 'review'>('strategy')

  // Filter connected accounts by type
  const emailAccounts = connectedAccounts.filter(acc => ['gmail', 'outlook', 'smtp'].includes(acc.platform))
  const linkedinAccounts = connectedAccounts.filter(acc => acc.platform === 'linkedin')

  // Check if strategy is available based on connected accounts
  const isStrategyAvailable = (strategyId: string) => {
    switch (strategyId) {
      case 'email_only':
        return emailAccounts.length > 0
      case 'linkedin_only':
        return linkedinAccounts.length > 0
      case 'email_first':
      case 'linkedin_first': 
      case 'simultaneous':
        return emailAccounts.length > 0 && linkedinAccounts.length > 0
      default:
        return false
    }
  }

  const handleConfirm = () => {
    if (!selectedStrategy) return

    const selection: ChannelSelection = {
      strategy: selectedStrategy as ChannelSelection['strategy'],
      selectedAccounts,
      preferences
    }

    onConfirm(selection)
  }

  const getRequiredChannels = (strategyId: string) => {
    switch (strategyId) {
      case 'email_only':
        return ['email']
      case 'linkedin_only': 
        return ['linkedin']
      case 'email_first':
      case 'linkedin_first':
      case 'simultaneous':
        return ['email', 'linkedin']
      default:
        return []
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
          <h2 className="text-2xl font-bold mb-2">🎯 Campaign Channel Selection</h2>
          <p className="opacity-90">
            Choose your outreach strategy to maximize prospect engagement
          </p>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {/* Step Indicator */}
          <div className="flex items-center mb-8">
            {['strategy', 'accounts', 'preferences', 'review'].map((step, index) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep === step 
                    ? 'bg-blue-500 text-white'
                    : ['strategy', 'accounts', 'preferences', 'review'].indexOf(currentStep) > index
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {['strategy', 'accounts', 'preferences', 'review'].indexOf(currentStep) > index ? <Check className="h-4 w-4" /> : index + 1}
                </div>
                {index < 3 && (
                  <div className={`w-16 h-0.5 mx-2 ${
                    ['strategy', 'accounts', 'preferences', 'review'].indexOf(currentStep) > index ? 'bg-green-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Strategy Selection */}
          {currentStep === 'strategy' && (
            <div>
              <h3 className="text-xl font-semibold mb-6">Select Your Outreach Strategy</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {CHANNEL_STRATEGIES.map((strategy) => {
                  const isAvailable = isStrategyAvailable(strategy.id)
                  const IconComponent = strategy.icon
                  
                  return (
                    <div
                      key={strategy.id}
                      onClick={() => isAvailable && setSelectedStrategy(strategy.id)}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        !isAvailable 
                          ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                          : selectedStrategy === strategy.id
                          ? `${strategy.borderColor} bg-blue-50`
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-lg ${strategy.color} text-white`}>
                          <IconComponent className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 mb-1">
                            {strategy.name}
                            {!isAvailable && (
                              <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">
                                Missing Accounts
                              </span>
                            )}
                          </h4>
                          <p className="text-sm text-gray-600 mb-3">{strategy.description}</p>
                          
                          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                            <div>
                              <span className="font-medium text-green-600">Reach: </span>
                              <span>{strategy.reachPotential}</span>
                            </div>
                            <div>
                              <span className="font-medium text-blue-600">Response: </span>
                              <span>{strategy.responseRate}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-2">
                            <div>
                              <span className="text-xs font-medium text-green-600">✓ Pros:</span>
                              <ul className="text-xs text-gray-600 ml-3">
                                {strategy.pros.map((pro, idx) => (
                                  <li key={idx}>• {pro}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <span className="text-xs font-medium text-orange-600">! Cons:</span>
                              <ul className="text-xs text-gray-600 ml-3">
                                {strategy.cons.map((con, idx) => (
                                  <li key={idx}>• {con}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Missing Accounts Warning */}
              {connectedAccounts.length === 0 && (
                <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
                    <div>
                      <h4 className="font-medium text-yellow-800">No Connected Accounts</h4>
                      <p className="text-sm text-yellow-700">
                        Please connect at least one email or LinkedIn account to proceed with campaign setup.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Account Selection */}
          {currentStep === 'accounts' && selectedStrategy && (
            <div>
              <h3 className="text-xl font-semibold mb-6">Select Accounts for Campaign</h3>
              
              {getRequiredChannels(selectedStrategy).includes('email') && emailAccounts.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-medium mb-3 flex items-center">
                    <Mail className="h-4 w-4 mr-2" />
                    Email Accounts
                  </h4>
                  <div className="space-y-2">
                    {emailAccounts.map((account) => (
                      <label key={account.id} className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={selectedAccounts.email.includes(account.id)}
                          onChange={(e) => {
                            const newSelected = e.target.checked
                              ? [...selectedAccounts.email, account.id]
                              : selectedAccounts.email.filter(id => id !== account.id)
                            setSelectedAccounts(prev => ({ ...prev, email: newSelected }))
                          }}
                          className="mr-3"
                        />
                        <div className="flex-1">
                          <div className="font-medium">{account.name}</div>
                          <div className="text-sm text-gray-600">{account.email}</div>
                          <div className={`text-xs ${account.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                            {account.status === 'active' ? '● Active' : '● Needs Reconnection'}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {getRequiredChannels(selectedStrategy).includes('linkedin') && linkedinAccounts.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center">
                    <Users className="h-4 w-4 mr-2" />
                    LinkedIn Accounts
                  </h4>
                  <div className="space-y-2">
                    {linkedinAccounts.map((account) => (
                      <label key={account.id} className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={selectedAccounts.linkedin.includes(account.id)}
                          onChange={(e) => {
                            const newSelected = e.target.checked
                              ? [...selectedAccounts.linkedin, account.id]
                              : selectedAccounts.linkedin.filter(id => id !== account.id)
                            setSelectedAccounts(prev => ({ ...prev, linkedin: newSelected }))
                          }}
                          className="mr-3"
                        />
                        <div className="flex-1">
                          <div className="font-medium">{account.name}</div>
                          <div className={`text-xs ${account.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                            {account.status === 'active' ? '● Active' : '● Needs Reconnection'}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Preferences */}
          {currentStep === 'preferences' && (
            <div>
              <h3 className="text-xl font-semibold mb-6">Campaign Preferences</h3>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    <Clock className="h-4 w-4 inline mr-1" />
                    Delay Between Channels (hours)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="168"
                    value={preferences.delayBetweenChannels}
                    onChange={(e) => setPreferences(prev => ({ ...prev, delayBetweenChannels: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <p className="text-xs text-gray-600 mt-1">Recommended: 24-48 hours for professional approach</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    <Target className="h-4 w-4 inline mr-1" />
                    Maximum Daily Outreach
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="200"
                    value={preferences.maxDailyOutreach}
                    onChange={(e) => setPreferences(prev => ({ ...prev, maxDailyOutreach: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <p className="text-xs text-gray-600 mt-1">Higher volumes may impact deliverability</p>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={preferences.followUpSequence}
                      onChange={(e) => setPreferences(prev => ({ ...prev, followUpSequence: e.target.checked }))}
                      className="mr-3"
                    />
                    <span className="text-sm">Enable automatic follow-up sequences</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={preferences.personalizeByChannel}
                      onChange={(e) => setPreferences(prev => ({ ...prev, personalizeByChannel: e.target.checked }))}
                      className="mr-3"
                    />
                    <span className="text-sm">Personalize messaging for each channel</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {currentStep === 'review' && selectedStrategy && (
            <div>
              <h3 className="text-xl font-semibold mb-6">Review Your Campaign Setup</h3>
              
              <div className="space-y-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Selected Strategy</h4>
                  <p className="text-sm">
                    {CHANNEL_STRATEGIES.find(s => s.id === selectedStrategy)?.name} - 
                    {CHANNEL_STRATEGIES.find(s => s.id === selectedStrategy)?.description}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Selected Accounts</h4>
                  <div className="text-sm space-y-1">
                    {selectedAccounts.email.length > 0 && (
                      <div>Email: {selectedAccounts.email.length} account(s)</div>
                    )}
                    {selectedAccounts.linkedin.length > 0 && (
                      <div>LinkedIn: {selectedAccounts.linkedin.length} account(s)</div>
                    )}
                  </div>
                </div>

                <div className="bg-green-50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Campaign Preferences</h4>
                  <div className="text-sm space-y-1">
                    <div>Delay between channels: {preferences.delayBetweenChannels} hours</div>
                    <div>Maximum daily outreach: {preferences.maxDailyOutreach}</div>
                    <div>Follow-up sequences: {preferences.followUpSequence ? 'Enabled' : 'Disabled'}</div>
                    <div>Channel personalization: {preferences.personalizeByChannel ? 'Enabled' : 'Disabled'}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>

          <div className="flex space-x-3">
            {currentStep !== 'strategy' && (
              <button
                onClick={() => {
                  const steps = ['strategy', 'accounts', 'preferences', 'review']
                  const currentIndex = steps.indexOf(currentStep)
                  if (currentIndex > 0) {
                    setCurrentStep(steps[currentIndex - 1] as any)
                  }
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
            )}

            {currentStep === 'review' ? (
              <button
                onClick={handleConfirm}
                disabled={!selectedStrategy}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Start Campaign
              </button>
            ) : (
              <button
                onClick={() => {
                  const steps = ['strategy', 'accounts', 'preferences', 'review']
                  const currentIndex = steps.indexOf(currentStep)
                  if (currentIndex < steps.length - 1) {
                    setCurrentStep(steps[currentIndex + 1] as any)
                  }
                }}
                disabled={currentStep === 'strategy' && !selectedStrategy}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Continue
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}