'use client';

import React, { useState, useEffect } from 'react';
import { Info, Users, MessageSquare, Crown, Shield, Star, Globe, Lightbulb } from 'lucide-react';
import { getCharacterLimitSummary } from '@/utils/linkedin-limits';
import { 
  detectLanguageFromContent, 
  getPersonalizationGuidelines, 
  getLanguageSpecificRecommendations 
} from '@/utils/linkedin-personalization-languages';

interface LinkedInAccount {
  id: string;
  name: string;
  type: 'LINKEDIN';
  connection_params: {
    im: {
      id: string;
      username: string;
      premiumId?: string | null;
      premiumFeatures: string[];
      premiumContractId?: string | null;
    };
  };
}

interface LinkedInLimitsInfoboxProps {
  messageLength: number;
  isTemplateContext: boolean;
  messageContent: string;
  className?: string;
}

export function LinkedInLimitsInfobox({ 
  messageLength, 
  isTemplateContext, 
  messageContent,
  className = '' 
}: LinkedInLimitsInfoboxProps) {
  const [accounts, setAccounts] = useState<LinkedInAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPersonalizationTips, setShowPersonalizationTips] = useState(false);

  useEffect(() => {
    fetchLinkedInAccounts();
  }, []);

  const fetchLinkedInAccounts = async () => {
    try {
      const response = await fetch('/api/unipile/accounts');
      if (response.ok) {
        const data = await response.json();
        const linkedinAccounts = data.accounts?.filter((acc: any) => acc.type === 'LINKEDIN') || [];
        setAccounts(linkedinAccounts);
      } else {
        setError('Failed to fetch LinkedIn accounts');
      }
    } catch (err) {
      setError('Error loading LinkedIn account limits');
      console.error('LinkedIn accounts fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Don't show if not in template context or no accounts
  if (!isTemplateContext || loading || accounts.length === 0) {
    return null;
  }

  const summary = getCharacterLimitSummary(accounts);
  const isOverLimit = messageLength > summary.maxLimit;
  const isNearLimit = messageLength > summary.maxLimit * 0.8;

  // Language detection and personalization
  const detectedLanguage = detectLanguageFromContent(messageContent);
  const guidelines = getPersonalizationGuidelines(detectedLanguage);
  const languageRecommendations = getLanguageSpecificRecommendations(messageContent, detectedLanguage);

  const getAccountTypeIcon = (features: string[]) => {
    if (features.includes('sales_navigator')) return <Shield className="h-3 w-3" />;
    if (features.includes('recruiter')) return <Star className="h-3 w-3" />;
    if (features.length > 0) return <Crown className="h-3 w-3" />;
    return <Users className="h-3 w-3" />;
  };

  const getStatusColor = () => {
    if (isOverLimit) return 'border-red-400 bg-red-50 text-red-700';
    if (isNearLimit) return 'border-yellow-400 bg-yellow-50 text-yellow-700';
    return 'border-blue-400 bg-blue-50 text-blue-700';
  };

  return (
    <div className={`border rounded-lg p-3 mb-4 ${getStatusColor()} ${className}`}>
      <div className="flex items-start space-x-2">
        <div className="flex-shrink-0 mt-0.5">
          {isOverLimit ? (
            <MessageSquare className="h-4 w-4 text-red-600" />
          ) : (
            <Info className="h-4 w-4 text-blue-600" />
          )}
        </div>
        
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">
              LinkedIn Connection Request Limits
            </h4>
            <div className="text-xs font-mono">
              {messageLength}/{summary.maxLimit} chars
            </div>
          </div>

          {/* Character limit status */}
          <div className="text-xs space-y-1">
            {isOverLimit && (
              <div className="text-red-600 font-medium">
                ⚠️ Message exceeds LinkedIn character limit!
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="font-medium">Your Limits:</span> {summary.minLimit}-{summary.maxLimit} chars
              </div>
              <div>
                <span className="font-medium">Accounts:</span> {summary.totalAccounts} connected
              </div>
            </div>
          </div>

          {/* Account breakdown */}
          <div className="text-xs">
            <div className="flex flex-wrap gap-2 mt-1">
              {accounts.map((account, index) => {
                const features = account.connection_params.im.premiumFeatures;
                const isPremium = account.connection_params.im.premiumId !== null || features.length > 0;
                const charLimit = isPremium ? 300 : 200;
                
                return (
                  <div
                    key={account.id}
                    className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-xs ${
                      isPremium 
                        ? 'bg-purple-100 text-purple-700' 
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {getAccountTypeIcon(features)}
                    <span className="truncate max-w-20" title={account.name}>
                      {account.name.split(' ')[0]}
                    </span>
                    <span className="text-xs opacity-75">({charLimit})</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Character Limit Recommendations */}
          {isOverLimit && (
            <div className="text-xs bg-white bg-opacity-50 rounded p-2 mt-2">
              <strong>💡 Character Limit Tips:</strong>
              <ul className="list-disc list-inside space-y-0.5 mt-1">
                <li>Split into multiple messages</li>
                <li>Remove non-essential words</li>
                <li>Use template variables for personalization</li>
                {summary.freeAccounts > 0 && (
                  <li>Free accounts limited to {summary.minLimit} characters</li>
                )}
              </ul>
            </div>
          )}

          {/* Language & Personalization Section */}
          <div className="text-xs mt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1">
                <Globe className="h-3 w-3" />
                <span className="font-medium">Language: {guidelines.language}</span>
                <span className="text-xs opacity-75">({guidelines.formality})</span>
              </div>
              <button
                onClick={() => setShowPersonalizationTips(!showPersonalizationTips)}
                className="flex items-center space-x-1 text-blue-600 hover:text-blue-700"
              >
                <Lightbulb className="h-3 w-3" />
                <span>Tips</span>
              </button>
            </div>

            {showPersonalizationTips && (
              <div className="bg-white bg-opacity-50 rounded p-2 mt-2 space-y-2">
                {/* Cultural Guidelines */}
                <div>
                  <strong>🌍 Cultural Notes:</strong>
                  <ul className="list-disc list-inside space-y-0.5 mt-1">
                    {guidelines.culturalNotes.slice(0, 3).map((note, idx) => (
                      <li key={idx}>{note}</li>
                    ))}
                  </ul>
                </div>

                {/* Personalization Variables */}
                <div>
                  <strong>🎯 Key Variables:</strong>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {guidelines.commonVariables.slice(0, 6).map((variable, idx) => (
                      <span 
                        key={idx}
                        className="inline-block bg-blue-100 text-blue-700 px-1 py-0.5 rounded text-xs"
                      >
                        {variable}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Language-Specific Recommendations */}
                {languageRecommendations.length > 0 && (
                  <div>
                    <strong>✨ {guidelines.language} Recommendations:</strong>
                    <ul className="list-disc list-inside space-y-0.5 mt-1">
                      {languageRecommendations.map((rec, idx) => (
                        <li key={idx}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Do's and Don'ts */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <strong className="text-green-600">✓ Do:</strong>
                    <ul className="list-disc list-inside space-y-0.5 mt-1">
                      {guidelines.dosList.slice(0, 2).map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <strong className="text-red-600">✗ Don't:</strong>
                    <ul className="list-disc list-inside space-y-0.5 mt-1">
                      {guidelines.dontsList.slice(0, 2).map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Character Efficiency for Language */}
                <div>
                  <strong>⚡ {guidelines.language} Efficiency:</strong>
                  <ul className="list-disc list-inside space-y-0.5 mt-1">
                    {guidelines.characterEfficiency.tips.slice(0, 3).map((tip, idx) => (
                      <li key={idx}>{tip}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}