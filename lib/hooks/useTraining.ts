import { useState, useEffect, useMemo } from 'react';
import { TrainingSession, TrainingStats, TrainingFilters } from '@/app/types/training';

// This hook can be extended to integrate with Supabase later
export const useTraining = () => {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock data - replace with Supabase queries later
  const mockTrainingSessions: TrainingSession[] = [
    {
      id: '1',
      title: 'Discovery Call Mastery',
      description: 'Learn the art of conducting effective discovery calls to uncover client needs and pain points.',
      difficulty: 'intermediate',
      duration: 45,
      progress: 100,
      score: 92,
      isCompleted: true,
      tags: ['Discovery', 'Communication', 'Client Relations'],
      type: 'Sales Fundamentals',
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-20')
    },
    {
      id: '2',
      title: 'Objection Handling Bootcamp',
      description: 'Master the techniques to handle common objections and turn resistance into opportunities.',
      difficulty: 'advanced',
      duration: 60,
      progress: 75,
      score: 88,
      isCompleted: false,
      tags: ['Objections', 'Persuasion', 'Advanced'],
      type: 'Advanced Sales',
      createdAt: new Date('2024-01-10'),
      updatedAt: new Date('2024-01-18')
    },
    {
      id: '3',
      title: 'Cold Calling Confidence Builder',
      description: 'Build confidence and skills for effective cold calling campaigns.',
      difficulty: 'beginner',
      duration: 30,
      progress: 0,
      isCompleted: false,
      tags: ['Cold Calling', 'Confidence', 'Prospecting'],
      type: 'Prospecting',
      createdAt: new Date('2024-01-08'),
      updatedAt: new Date('2024-01-08')
    },
    {
      id: '4',
      title: 'Proposal Writing Excellence',
      description: 'Create compelling proposals that win deals and exceed client expectations.',
      difficulty: 'intermediate',
      duration: 50,
      progress: 40,
      isCompleted: false,
      tags: ['Proposals', 'Writing', 'Closing'],
      type: 'Sales Process',
      createdAt: new Date('2024-01-12'),
      updatedAt: new Date('2024-01-16')
    },
    {
      id: '5',
      title: 'Negotiation Tactics & Strategy',
      description: 'Advanced negotiation techniques to close deals on favorable terms.',
      difficulty: 'advanced',
      duration: 75,
      progress: 100,
      score: 95,
      isCompleted: true,
      tags: ['Negotiation', 'Strategy', 'Closing'],
      type: 'Advanced Sales',
      createdAt: new Date('2024-01-05'),
      updatedAt: new Date('2024-01-14')
    },
    {
      id: '6',
      title: 'Social Selling Fundamentals',
      description: 'Leverage social media platforms to build relationships and generate leads.',
      difficulty: 'beginner',
      duration: 35,
      progress: 20,
      isCompleted: false,
      tags: ['Social Media', 'LinkedIn', 'Prospecting'],
      type: 'Digital Sales',
      createdAt: new Date('2024-01-07'),
      updatedAt: new Date('2024-01-11')
    }
  ];

  // Simulate loading data
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      setSessions(mockTrainingSessions);
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  // Calculate stats
  const stats: TrainingStats = useMemo(() => {
    const totalSessions = sessions.length;
    const completedSessions = sessions.filter(s => s.isCompleted).length;
    const averageScore = sessions
      .filter(s => s.score)
      .reduce((acc, s) => acc + (s.score || 0), 0) / 
      sessions.filter(s => s.score).length || 0;
    const totalTrainingTime = sessions
      .filter(s => s.isCompleted)
      .reduce((acc, s) => acc + s.duration, 0);

    return {
      totalSessions,
      completedSessions,
      averageScore: Math.round(averageScore),
      totalTrainingTime
    };
  }, [sessions]);

  // Filter sessions
  const getFilteredSessions = (filters: TrainingFilters) => {
    return sessions.filter(session => {
      const matchesSearch = session.title.toLowerCase().includes(filters.search.toLowerCase()) ||
                          session.description.toLowerCase().includes(filters.search.toLowerCase()) ||
                          session.tags.some(tag => tag.toLowerCase().includes(filters.search.toLowerCase()));
      
      const matchesType = filters.type === 'all' || session.type === filters.type;
      const matchesDifficulty = filters.difficulty === 'all' || session.difficulty === filters.difficulty;
      const matchesCompletion = !filters.showCompleted || session.isCompleted;

      return matchesSearch && matchesType && matchesDifficulty && matchesCompletion;
    });
  };

  // Actions
  const startSession = async (sessionId: string) => {
    try {
      // TODO: Implement session start logic with Supabase
      console.log('Starting session:', sessionId);
      // Update progress, create session log, etc.
    } catch (err) {
      setError('Failed to start session');
    }
  };

  const retrySession = async (sessionId: string) => {
    try {
      // TODO: Implement session retry logic with Supabase
      console.log('Retrying session:', sessionId);
      // Reset progress, create new attempt, etc.
    } catch (err) {
      setError('Failed to retry session');
    }
  };

  const updateProgress = async (sessionId: string, progress: number, score?: number) => {
    try {
      // TODO: Implement progress update with Supabase
      console.log('Updating progress:', { sessionId, progress, score });
      // Update session progress, save score if completed
    } catch (err) {
      setError('Failed to update progress');
    }
  };

  const createSession = async (sessionData: Omit<TrainingSession, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      // TODO: Implement session creation with Supabase
      console.log('Creating session:', sessionData);
      // Insert new session into database
    } catch (err) {
      setError('Failed to create session');
    }
  };

  return {
    sessions,
    stats,
    loading,
    error,
    getFilteredSessions,
    startSession,
    retrySession,
    updateProgress,
    createSession,
    setError
  };
};