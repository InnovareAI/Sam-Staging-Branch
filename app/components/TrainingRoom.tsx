'use client';

import React, { useState, useEffect } from 'react';
import { 
  ArrowRight,
  ArrowLeft,
  Settings,
  GraduationCap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Enhanced onboarding scripts from Training Room v2
const opener = [
  "Hi, I'm Sam. How's your day going so far?",
  "Good to hear. Before we get started, what should I call you?"
];

const orientation = [
  "I work with a team of AI agents that take care of the heavy lifting in outreach—finding the right leads, personalizing messages, handling replies, and making sure follow‑ups don't slip through the cracks.",
  "To make that work for your business, I'll ask a few questions about your company, customers, and process. Think of it like a quick discovery session.",
  "You're in control — you can stop at any time, skip a question, or come back later. I'll remember where we left off.",
  "You can also upload sales decks, case studies, or share your website link — I'll read them and use them to fill gaps.",
  "The goal: build your ideal customer profile, target market, and messaging strategy, so everything we automate is accurate and personal."
];

const roomTour = [
  "Chat with Sam — where we talk. Ask questions, pause, resume anytime.",
  "Knowledge Base — everything we discuss and upload gets stored here for me to reference.",
  "Training Room — where I guide you through the 7‑stage onboarding flow.",
  "Contact Center — where inbound requests (demo forms, pricing questions) are handled.",
  "Campaign Hub — where campaigns are designed, approved, and launched.",
  "Lead Pipeline — where prospects move from discovery to opportunities.",
  "Analytics — where readiness, performance, and ROI live. Ask me to explain any stat."
];

const stages = [
  { id: 1, title: "Business Context Discovery", question: "What does your company do and who do you serve?" },
  { id: 2, title: "ICP Definition", question: "Who is your ideal customer (industry, size, roles, geo)?" },
  { id: 3, title: "Competitive Intelligence", question: "Who do you compete against and how do you win?" },
  { id: 4, title: "Sales Process Analysis", question: "How do you generate leads and where do deals tend to stall?" },
  { id: 5, title: "Success Metrics & Goals", question: "What results would make this a win in the next 90 days?" },
  { id: 6, title: "Technical & Compliance", question: "Which tools do you use (CRM, email) and any compliance needs?" },
  { id: 7, title: "Content & Brand", question: "Upload decks/case studies or share links so I can match your voice." }
];

type Answer = { stageId: number; value: string };

const TrainingRoom: React.FC = () => {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [step, setStep] = useState(0); // 0=opener, 1=orientation, 2=room tour, 3=stages
  const [stageIndex, setStageIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [userName, setUserName] = useState('');

  // Persist onboarding state in localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sam_training_onboarding');
      if (saved) {
        const data = JSON.parse(saved);
        setStep(data.step ?? 0);
        setStageIndex(data.stageIndex ?? 0);
        setAnswers(data.answers ?? []);
        setUserName(data.userName ?? '');
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sam_training_onboarding', JSON.stringify({ 
        step, 
        stageIndex, 
        answers, 
        userName 
      }));
    }
  }, [step, stageIndex, answers, userName]);


  const next = () => setStep(step + 1);
  const nextStage = () => setStageIndex(Math.min(stageIndex + 1, stages.length - 1));

  const onAnswer = (val: string) => {
    const id = stages[stageIndex].id;
    setAnswers(prev => {
      const others = prev.filter(a => a.stageId !== id);
      return [...others, { stageId: id, value: val }];
    });
    if (stageIndex < stages.length - 1) nextStage();
  };

  const progress = step < 3 ? 10 + step * 20 : ((stageIndex + 1) / stages.length) * 100;


  // Enhanced Onboarding Wizard Modal with v2 flow
  if (showOnboarding) {
    return (
      <div className="flex-1 bg-gray-900 p-6 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">SAM Training Onboarding</h1>
            <p className="text-gray-400">Personalized setup to optimize your sales process</p>
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex justify-between text-sm text-gray-400 mb-2">
              <span>Progress</span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Step 0: Opener */}
          {step === 0 && (
            <Card className="bg-gray-800 border-gray-700 mb-8">
              <CardContent className="space-y-4 pt-6">
                {opener.map((line, i) => (
                  <p key={i} className="text-gray-300">{line}</p>
                ))}
                {step === 0 && opener.length > 1 && (
                  <input
                    type="text"
                    placeholder="Your name..."
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none"
                  />
                )}
                <Button onClick={next} className="bg-purple-600 hover:bg-purple-700 text-white">
                  Continue <ArrowRight size={16} className="ml-2" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 1: Orientation */}
          {step === 1 && (
            <Card className="bg-gray-800 border-gray-700 mb-8">
              <CardHeader>
                <CardTitle className="text-xl text-white">How I Work</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {orientation.map((line, i) => (
                  <p key={i} className="text-gray-300">{line}</p>
                ))}
                <Button onClick={next} className="bg-purple-600 hover:bg-purple-700 text-white">
                  Continue <ArrowRight size={16} className="ml-2" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Room Tour */}
          {step === 2 && (
            <Card className="bg-gray-800 border-gray-700 mb-8">
              <CardHeader>
                <CardTitle className="text-xl text-white">Quick Tour</CardTitle>
                <CardDescription className="text-gray-400">
                  Here's what you'll find in your workspace
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="list-disc pl-5 space-y-2">
                  {roomTour.map((line, i) => (
                    <li key={i} className="text-gray-300">{line}</li>
                  ))}
                </ul>
                <Button onClick={next} className="bg-purple-600 hover:bg-purple-700 text-white">
                  Start Setup <ArrowRight size={16} className="ml-2" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Question Stages */}
          {step === 3 && (
            <Card className="bg-gray-800 border-gray-700 mb-8">
              <CardHeader>
                <CardTitle className="text-xl text-white">{stages[stageIndex].title}</CardTitle>
                <CardDescription className="text-gray-400">
                  Step {stageIndex + 1} of {stages.length}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-300">{stages[stageIndex].question}</p>
                <textarea
                  placeholder="Your answer... (or skip)"
                  onChange={(e) => onAnswer(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none min-h-[120px]"
                />
                <div className="flex gap-2 pt-4">
                  <Button 
                    onClick={() => setStageIndex(Math.max(0, stageIndex - 1))} 
                    disabled={stageIndex === 0}
                    variant="outline"
                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    <ArrowLeft size={16} className="mr-2" />
                    Back
                  </Button>
                  <Button 
                    onClick={nextStage} 
                    variant="outline"
                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    Skip
                  </Button>
                  {stageIndex === stages.length - 1 && (
                    <Button 
                      onClick={() => {
                        alert('Onboarding complete! Welcome to SAM.');
                        setShowOnboarding(false);
                      }} 
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      Finish <ArrowRight size={16} className="ml-2" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Skip for Now Button */}
          <div className="text-center">
            <Button
              onClick={() => setShowOnboarding(false)}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Skip for Now
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