'use client';

import { toastSuccess, toastError, toastWarning, toastInfo } from '@/lib/toast';
import { useState, useEffect } from 'react';

// Onboarding scripts from Training Room v2 2
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

// Progress Bar Component
function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full bg-gray-200 rounded h-2">
      <div className="bg-blue-600 h-2 rounded" style={{width:`${progress}%`}} />
    </div>
  );
}

// Question Card Component  
function QuestionCard({ question, onSubmit }: { question: string; onSubmit: (val:string)=>void }) {
  const [val, setVal] = useState('');
  return (
    <div className="p-4 border rounded bg-gray-50 space-y-2">
      <p>{question}</p>
      <input
        type="text"
        className="mt-1 border px-2 py-1 w-full"
        placeholder="Your answer... (or skip)"
        value={val}
        onChange={e=>setVal(e.target.value)}
      />
      <div className="flex gap-2">
        <button onClick={()=>onSubmit(val)} className="px-3 py-2 bg-blue-600 text-white rounded">Submit</button>
      </div>
    </div>
  );
}

// Main Onboarding Wizard Component
function OnboardingWizard() {
  const [step, setStep] = useState(0);  // 0=opener, 1=orientation, 2=room tour, 3=stages
  const [stageIndex, setStageIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);

  // persist in localStorage (simple demo)
  useEffect(()=>{
    const saved = typeof window !== 'undefined' ? localStorage.getItem('sam_onboarding') : null;
    if (saved) {
      const s = JSON.parse(saved);
      setStep(s.step ?? 0);
      setStageIndex(s.stageIndex ?? 0);
      setAnswers(s.answers ?? []);
    }
  },[]);

  useEffect(()=>{
    if (typeof window !== 'undefined') {
      localStorage.setItem('sam_onboarding', JSON.stringify({ step, stageIndex, answers }));
    }
  },[step, stageIndex, answers]);

  const next = () => setStep(step+1);
  const nextStage = () => setStageIndex(Math.min(stageIndex+1, stages.length-1));

  const onAnswer = (val:string) => {
    const id = stages[stageIndex].id;
    setAnswers(prev => {
      const others = prev.filter(a => a.stageId !== id);
      return [...others, { stageId:id, value:val }];
    });
    if (stageIndex < stages.length-1) nextStage();
  };

  const progress = step < 3 ? 10 + step*20 : ((stageIndex+1)/stages.length)*100;

  return (
    <div className="space-y-4">
      <ProgressBar progress={progress} />

      {step===0 && (
        <div className="space-y-3">
          {opener.map((line,i)=>(<p key={i}>{line}</p>))}
          <button onClick={next} className="px-4 py-2 bg-blue-600 text-white rounded">Continue</button>
        </div>
      )}

      {step===1 && (
        <div className="space-y-3">
          {orientation.map((line,i)=>(<p key={i}>{line}</p>))}
          <button onClick={next} className="px-4 py-2 bg-blue-600 text-white rounded">Continue</button>
        </div>
      )}

      {step===2 && (
        <div className="space-y-3">
          <h3 className="font-semibold">Quick Tour</h3>
          <ul className="list-disc pl-5 space-y-1">
            {roomTour.map((line,i)=>(<li key={i}>{line}</li>))}
          </ul>
          <button onClick={next} className="px-4 py-2 bg-blue-600 text-white rounded">Start</button>
        </div>
      )}

      {step===3 && (
        <div className="space-y-4">
          <h3 className="font-semibold">{stages[stageIndex].title}</h3>
          <QuestionCard question={stages[stageIndex].question} onSubmit={onAnswer} />
          <div className="flex gap-2">
            <button onClick={()=>setStageIndex(Math.max(0, stageIndex-1))} className="px-3 py-2 border rounded">Back</button>
            <button onClick={nextStage} className="px-3 py-2 border rounded">Skip</button>
            {stageIndex===stages.length-1 && (
              <button onClick={()=>toastError('Onboarding complete')} className="px-3 py-2 bg-emerald-600 text-white rounded">Finish</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Main Training Room Component
const TrainingRoom: React.FC = () => {
  return (
    <div className="flex-1 bg-gray-900 p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-4">Sam Training Room</h1>
        <OnboardingWizard />
      </div>
    </div>
  );
};

export default TrainingRoom;
