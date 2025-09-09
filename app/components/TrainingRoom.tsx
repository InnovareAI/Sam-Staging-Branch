'use client';

import React, { useState } from 'react';
import { 
  ArrowRight,
  ArrowLeft,
  Settings,
  GraduationCap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Onboarding stages from SAM UI Training Room v1
const onboardingStages = [
  'Business Context', 
  'ICP Definition',
  'Competition',
  'Sales Process',
  'Metrics & Goals',
  'Tech & Compliance',
  'Content & Brand'
];

const onboardingQuestions = {
  'Business Context': 'What industry does your business operate in, and what are your primary products or services?',
  'ICP Definition': 'Describe your ideal customer profile (ICP) - company size, industry, role, pain points?',
  'Competition': 'Who are your main competitors and what differentiates you from them?',
  'Sales Process': 'What does your current sales process look like from lead to close?',
  'Metrics & Goals': 'What are your current sales metrics and what goals are you trying to achieve?',
  'Tech & Compliance': 'What sales tech stack do you use and are there any compliance requirements?',
  'Content & Brand': 'How would you describe your brand voice and what content resonates with prospects?'
};

const TrainingRoom: React.FC = () => {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStage, setOnboardingStage] = useState(0);
  const [onboardingAnswers, setOnboardingAnswers] = useState<{[key: string]: string}>({});


  const handleOnboardingNext = () => {
    const currentStage = onboardingStages[onboardingStage];
    const answer = onboardingAnswers[currentStage] || '';
    
    if (answer.trim()) {
      if (onboardingStage < onboardingStages.length - 1) {
        setOnboardingStage(onboardingStage + 1);
      } else {
        // Complete onboarding
        console.log('Onboarding completed with answers:', onboardingAnswers);
        setShowOnboarding(false);
        setOnboardingStage(0);
      }
    }
  };

  const handleOnboardingPrev = () => {
    if (onboardingStage > 0) {
      setOnboardingStage(onboardingStage - 1);
    }
  };

  const handleAnswerChange = (stage: string, answer: string) => {
    setOnboardingAnswers(prev => ({
      ...prev,
      [stage]: answer
    }));
  };


  // Onboarding Wizard Modal
  if (showOnboarding) {
    const currentStage = onboardingStages[onboardingStage];
    const currentQuestion = onboardingQuestions[currentStage as keyof typeof onboardingQuestions];
    const progress = ((onboardingStage + 1) / onboardingStages.length) * 100;
    
    return (
      <div className="flex-1 bg-gray-900 p-6 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">SAM Training Onboarding</h1>
            <p className="text-gray-400">Help us understand your business to personalize your training</p>
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex justify-between text-sm text-gray-400 mb-2">
              <span>Step {onboardingStage + 1} of {onboardingStages.length}</span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Question Card */}
          <Card className="bg-gray-800 border-gray-700 mb-8">
            <CardHeader>
              <CardTitle className="text-xl text-white">{currentStage}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-300">{currentQuestion}</p>
              <textarea
                value={onboardingAnswers[currentStage] || ''}
                onChange={(e) => handleAnswerChange(currentStage, e.target.value)}
                placeholder="Your answer..."
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none min-h-[120px]"
              />
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button
              onClick={handleOnboardingPrev}
              disabled={onboardingStage === 0}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              <ArrowLeft size={16} className="mr-2" />
              Previous
            </Button>
            
            <Button
              onClick={() => setShowOnboarding(false)}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Skip for Now
            </Button>
            
            <Button
              onClick={handleOnboardingNext}
              disabled={!onboardingAnswers[currentStage]?.trim()}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {onboardingStage === onboardingStages.length - 1 ? 'Complete' : 'Next'}
              <ArrowRight size={16} className="ml-2" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-900 p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Training Room</h1>
          <p className="text-gray-400">Enhance your sales skills with personalized training sessions</p>
        </div>
        <Button 
          onClick={() => setShowOnboarding(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white"
        >
          <Settings size={16} className="mr-2" />
          Setup Profile
        </Button>
      </div>

      {/* Simple Training Room Content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <GraduationCap size={64} className="mx-auto mb-6 text-purple-500 opacity-50" />
          <h2 className="text-2xl font-bold text-white mb-4">Training Room</h2>
          <p className="text-gray-400 mb-8">
            Set up your business profile to get personalized training recommendations and sales insights.
          </p>
          <Button 
            onClick={() => setShowOnboarding(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Settings size={16} className="mr-2" />
            Start Setup
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TrainingRoom;