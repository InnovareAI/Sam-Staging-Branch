export interface TrainingSession {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: number; // in minutes
  progress: number; // 0-100
  score?: number; // 0-100
  isCompleted: boolean;
  tags: string[];
  type: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrainingStats {
  totalSessions: number;
  completedSessions: number;
  averageScore: number;
  totalTrainingTime: number; // in minutes
}

export interface TrainingFilters {
  search: string;
  type: string;
  showCompleted: boolean;
  difficulty: string;
}