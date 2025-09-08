'use client';

import React, { useState, useMemo } from 'react';
import { 
  Play, 
  RotateCcw, 
  Clock, 
  Trophy, 
  Target, 
  Search,
  Filter,
  Plus,
  CheckCircle2,
  Circle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { TrainingSession, TrainingStats, TrainingFilters } from '@/app/types/training';
import { useTraining } from '@/lib/hooks/useTraining';

const TrainingRoom: React.FC = () => {
  const {
    sessions,
    stats,
    loading,
    error,
    getFilteredSessions,
    startSession,
    retrySession
  } = useTraining();

  const [filters, setFilters] = useState<TrainingFilters>({
    search: '',
    type: 'all',
    showCompleted: false,
    difficulty: 'all'
  });

  // Filter training sessions using the hook
  const filteredSessions = useMemo(() => {
    return getFilteredSessions(filters);
  }, [filters, getFilteredSessions]);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'intermediate': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'advanced': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const handleStartSession = async (sessionId: string) => {
    await startSession(sessionId);
  };

  const handleRetrySession = async (sessionId: string) => {
    await retrySession(sessionId);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex-1 bg-gray-900 p-6 overflow-y-auto flex items-center justify-center">
        <div className="text-white text-xl">Loading training sessions...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex-1 bg-gray-900 p-6 overflow-y-auto flex items-center justify-center">
        <div className="text-red-400 text-xl">{error}</div>
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
        <Button className="bg-purple-600 hover:bg-purple-700 text-white">
          <Plus size={16} className="mr-2" />
          New Session
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center">
              <Target size={16} className="mr-2" />
              Total Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.totalSessions}</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center">
              <CheckCircle2 size={16} className="mr-2" />
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">{stats.completedSessions}</div>
            <p className="text-xs text-gray-500">
              {Math.round((stats.completedSessions / stats.totalSessions) * 100)}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center">
              <Trophy size={16} className="mr-2" />
              Average Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-400">{stats.averageScore}%</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center">
              <Clock size={16} className="mr-2" />
              Training Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">{Math.round(stats.totalTrainingTime / 60)}h</div>
            <p className="text-xs text-gray-500">{stats.totalTrainingTime} minutes total</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search training sessions..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            className="pl-10 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
          />
        </div>
        
        <Select value={filters.type} onValueChange={(value) => setFilters(prev => ({ ...prev, type: value }))}>
          <SelectTrigger className="w-[180px] bg-gray-800 border-gray-700 text-white">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700">
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="Sales Fundamentals">Sales Fundamentals</SelectItem>
            <SelectItem value="Advanced Sales">Advanced Sales</SelectItem>
            <SelectItem value="Prospecting">Prospecting</SelectItem>
            <SelectItem value="Sales Process">Sales Process</SelectItem>
            <SelectItem value="Digital Sales">Digital Sales</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.difficulty} onValueChange={(value) => setFilters(prev => ({ ...prev, difficulty: value }))}>
          <SelectTrigger className="w-[140px] bg-gray-800 border-gray-700 text-white">
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700">
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="beginner">Beginner</SelectItem>
            <SelectItem value="intermediate">Intermediate</SelectItem>
            <SelectItem value="advanced">Advanced</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="showCompleted"
            checked={filters.showCompleted}
            onChange={(e) => setFilters(prev => ({ ...prev, showCompleted: e.target.checked }))}
            className="rounded border-gray-700 bg-gray-800 text-purple-600 focus:ring-purple-500"
          />
          <label htmlFor="showCompleted" className="text-sm text-gray-400">
            Show Completed Only
          </label>
        </div>
      </div>

      {/* Training Sessions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredSessions.map((session) => (
          <Card key={session.id} className="bg-gray-800 border-gray-700 hover:border-purple-500/50 transition-colors">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg font-semibold text-white mb-2">
                    {session.title}
                  </CardTitle>
                  <CardDescription className="text-gray-400 text-sm">
                    {session.description}
                  </CardDescription>
                </div>
                {session.isCompleted && (
                  <CheckCircle2 size={20} className="text-green-400 ml-2" />
                )}
              </div>
            </CardHeader>
            
            <CardContent>
              {/* Tags and Difficulty */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <Badge 
                  variant="outline" 
                  className={`text-xs ${getDifficultyColor(session.difficulty)}`}
                >
                  {session.difficulty}
                </Badge>
                <div className="flex items-center text-gray-400 text-sm">
                  <Clock size={12} className="mr-1" />
                  {session.duration}min
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1 mb-4">
                {session.tags.slice(0, 3).map((tag, index) => (
                  <Badge 
                    key={index}
                    variant="secondary" 
                    className="text-xs bg-gray-700 text-gray-300 border-gray-600"
                  >
                    {tag}
                  </Badge>
                ))}
                {session.tags.length > 3 && (
                  <Badge variant="secondary" className="text-xs bg-gray-700 text-gray-300 border-gray-600">
                    +{session.tags.length - 3}
                  </Badge>
                )}
              </div>

              {/* Progress */}
              {session.progress > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-400">Progress</span>
                    <span className="text-white">{session.progress}%</span>
                  </div>
                  <Progress value={session.progress} className="h-2" />
                </div>
              )}

              {/* Score */}
              {session.score && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Score</span>
                    <span className="text-purple-400 font-medium">{session.score}%</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                {session.isCompleted ? (
                  <Button
                    onClick={() => handleRetrySession(session.id)}
                    variant="outline"
                    size="sm"
                    className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    <RotateCcw size={14} className="mr-2" />
                    Retry
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleStartSession(session.id)}
                    size="sm"
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <Play size={14} className="mr-2" />
                    {session.progress > 0 ? 'Continue' : 'Start'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredSessions.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-4">
            <Target size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg">No training sessions found</p>
            <p className="text-sm">Try adjusting your search or filters</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainingRoom;