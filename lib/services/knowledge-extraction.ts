// SAM AI Knowledge Extraction Service
// Background service for processing and extracting knowledge from conversations

import { knowledgeClassifier } from './knowledge-classifier';
import { supabaseKnowledge } from '@/lib/supabase-knowledge';

export interface ExtractionJob {
  conversationId: string;
  userId: string;
  organizationId?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  processedAt?: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface ExtractionResult {
  success: boolean;
  conversationId: string;
  personalExtractions: number;
  teamExtractions: number;
  confidence: number;
  processingTime: number;
  error?: string;
}

export interface KnowledgeStats {
  totalConversations: number;
  processedConversations: number;
  pendingExtractions: number;
  personalKnowledgeItems: number;
  teamKnowledgeItems: number;
  avgConfidence: number;
  topCategories: Array<{
    category: string;
    count: number;
    avgConfidence: number;
  }>;
}

export class KnowledgeExtractionService {
  private extractionQueue: ExtractionJob[] = [];
  private isProcessing = false;
  private maxConcurrentJobs = 3;
  private processingJobs = new Set<string>();

  constructor() {
    // Start background processing
    this.startBackgroundProcessor();
  }

  // Add extraction job to queue
  async queueExtraction(
    conversationId: string,
    userId: string,
    organizationId?: string,
    priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium'
  ): Promise<void> {
    const job: ExtractionJob = {
      conversationId,
      userId,
      organizationId,
      priority,
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date(),
      status: 'pending'
    };

    this.extractionQueue.push(job);
    this.sortQueue(); // Sort by priority
    
    console.log(`🔄 Queued knowledge extraction for conversation ${conversationId} (priority: ${priority})`);
    
    // Try to process immediately if not at capacity
    this.processQueue();
  }

  // Process extraction queue
  private async processQueue(): Promise<void> {
    if (this.processingJobs.size >= this.maxConcurrentJobs) {
      return; // At capacity
    }

    const nextJob = this.extractionQueue.find(job => 
      job.status === 'pending' && !this.processingJobs.has(job.conversationId)
    );

    if (!nextJob) {
      return; // No pending jobs
    }

    await this.processExtractionJob(nextJob);
  }

  // Process individual extraction job
  private async processExtractionJob(job: ExtractionJob): Promise<void> {
    const startTime = Date.now();
    
    try {
      job.status = 'processing';
      job.processedAt = new Date();
      this.processingJobs.add(job.conversationId);

      console.log(`🧠 Processing knowledge extraction for conversation ${job.conversationId}...`);

      // Perform the actual knowledge extraction
      const result = await knowledgeClassifier.extractAndStoreKnowledge(job.conversationId);
      
      const processingTime = Date.now() - startTime;

      if (result.success) {
        job.status = 'completed';
        console.log(`✅ Completed knowledge extraction for conversation ${job.conversationId} in ${processingTime}ms:`, {
          personal: result.result?.personal_extractions || 0,
          team: result.result?.team_extractions || 0,
          confidence: result.result?.confidence || 0
        });

        // Update knowledge base search index if needed
        await this.updateSearchIndex(job.userId, job.organizationId);

      } else {
        throw new Error(result.error || 'Unknown extraction error');
      }

    } catch (error) {
      job.retryCount++;
      const processingTime = Date.now() - startTime;
      
      console.error(`❌ Knowledge extraction failed for conversation ${job.conversationId}:`, error);

      if (job.retryCount < job.maxRetries) {
        job.status = 'pending';
        console.log(`🔄 Retrying extraction for conversation ${job.conversationId} (attempt ${job.retryCount + 1}/${job.maxRetries})`);
        
        // Add exponential backoff delay
        setTimeout(() => {
          this.processQueue();
        }, Math.pow(2, job.retryCount) * 1000);
      } else {
        job.status = 'failed';
        console.error(`💥 Max retries exceeded for conversation ${job.conversationId}`);
      }
    } finally {
      this.processingJobs.delete(job.conversationId);
      
      // Process next job in queue
      setTimeout(() => {
        this.processQueue();
      }, 100);
    }
  }

  // Sort queue by priority
  private sortQueue(): void {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    
    this.extractionQueue.sort((a, b) => {
      // First by priority
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by creation time (oldest first)
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  // Start background processor
  private startBackgroundProcessor(): void {
    setInterval(() => {
      this.processQueue();
      this.cleanupOldJobs();
    }, 5000); // Process every 5 seconds
  }

  // Clean up old completed/failed jobs
  private cleanupOldJobs(): void {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    const initialCount = this.extractionQueue.length;
    this.extractionQueue = this.extractionQueue.filter(job => 
      job.status === 'pending' || 
      job.status === 'processing' || 
      (job.processedAt && job.processedAt > cutoff)
    );
    
    const cleaned = initialCount - this.extractionQueue.length;
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} old extraction jobs`);
    }
  }

  // Update search index for better RAG performance
  private async updateSearchIndex(userId: string, organizationId?: string): Promise<void> {
    try {
      // This would integrate with your vector database or search system
      // For now, we'll just trigger a cache refresh
      console.log(`🔍 Updating search index for user ${userId}, org ${organizationId}`);
      
      // Example: refresh knowledge base search cache
      // await vectorDatabase.refreshUserIndex(userId, organizationId);
      
    } catch (error) {
      console.error('Search index update failed:', error);
      // Non-critical, don't fail the extraction
    }
  }

  // Get extraction queue status
  getQueueStatus(): {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    totalInQueue: number;
  } {
    const status = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      totalInQueue: this.extractionQueue.length
    };

    this.extractionQueue.forEach(job => {
      status[job.status]++;
    });

    return status;
  }

  // Get knowledge statistics for a user/organization
  async getKnowledgeStats(
    userId?: string,
    organizationId?: string,
    timeRange: 'day' | 'week' | 'month' | 'all' = 'all'
  ): Promise<KnowledgeStats> {
    try {
      const personalKnowledge = userId 
        ? await knowledgeClassifier.getExtractedKnowledge(userId, undefined, 'personal')
        : [];
      
      const teamKnowledge = organizationId 
        ? await knowledgeClassifier.getExtractedKnowledge(undefined, organizationId, 'team_shareable')
        : [];

      // Calculate category statistics
      const categoryStats = new Map<string, { count: number; totalConfidence: number }>();
      
      [...personalKnowledge, ...teamKnowledge].forEach(item => {
        const existing = categoryStats.get(item.category) || { count: 0, totalConfidence: 0 };
        categoryStats.set(item.category, {
          count: existing.count + 1,
          totalConfidence: existing.totalConfidence + item.confidence_score
        });
      });

      const topCategories = Array.from(categoryStats.entries())
        .map(([category, stats]) => ({
          category,
          count: stats.count,
          avgConfidence: stats.totalConfidence / stats.count
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const totalItems = personalKnowledge.length + teamKnowledge.length;
      const avgConfidence = totalItems > 0 
        ? [...personalKnowledge, ...teamKnowledge].reduce((sum, item) => sum + item.confidence_score, 0) / totalItems
        : 0;

      return {
        totalConversations: 0, // Would need to query conversations table
        processedConversations: 0, // Would need to query conversations table
        pendingExtractions: this.getQueueStatus().pending,
        personalKnowledgeItems: personalKnowledge.length,
        teamKnowledgeItems: teamKnowledge.length,
        avgConfidence,
        topCategories
      };

    } catch (error) {
      console.error('Error getting knowledge stats:', error);
      return {
        totalConversations: 0,
        processedConversations: 0,
        pendingExtractions: 0,
        personalKnowledgeItems: 0,
        teamKnowledgeItems: 0,
        avgConfidence: 0,
        topCategories: []
      };
    }
  }

  // Force process all pending extractions (admin function)
  async processPendingExtractions(): Promise<ExtractionResult[]> {
    console.log('🚀 Force processing all pending extractions...');
    
    const pendingJobs = this.extractionQueue.filter(job => job.status === 'pending');
    const results: ExtractionResult[] = [];
    
    for (const job of pendingJobs) {
      const startTime = Date.now();
      
      try {
        const result = await knowledgeClassifier.extractAndStoreKnowledge(job.conversationId);
        const processingTime = Date.now() - startTime;
        
        results.push({
          success: result.success,
          conversationId: job.conversationId,
          personalExtractions: result.result?.personal_extractions || 0,
          teamExtractions: result.result?.team_extractions || 0,
          confidence: result.result?.confidence || 0,
          processingTime,
          error: result.error
        });
        
        job.status = result.success ? 'completed' : 'failed';
        
      } catch (error) {
        const processingTime = Date.now() - startTime;
        results.push({
          success: false,
          conversationId: job.conversationId,
          personalExtractions: 0,
          teamExtractions: 0,
          confidence: 0,
          processingTime,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        job.status = 'failed';
      }
    }
    
    console.log(`✅ Processed ${results.length} pending extractions`);
    return results;
  }

  // Reprocess failed extractions
  async retryFailedExtractions(): Promise<void> {
    const failedJobs = this.extractionQueue.filter(job => job.status === 'failed');
    
    failedJobs.forEach(job => {
      job.status = 'pending';
      job.retryCount = 0; // Reset retry count
      console.log(`🔄 Retrying failed extraction for conversation ${job.conversationId}`);
    });
    
    this.sortQueue();
    this.processQueue();
  }

  // Get enhanced knowledge context for RAG
  async getEnhancedKnowledgeContext(
    userId: string,
    organizationId?: string,
    conversationContext?: string,
    limit: number = 20
  ): Promise<{
    personalContext: any;
    teamContext: any;
    contextualRelevance: number;
    knowledgeAge: string;
  }> {
    const baseContext = await knowledgeClassifier.getUserKnowledgeContext(
      userId,
      organizationId,
      ['personal', 'team_shareable'],
      limit
    );

    // Add contextual relevance scoring if conversation context provided
    let contextualRelevance = 1.0;
    if (conversationContext) {
      contextualRelevance = this.calculateContextualRelevance(
        conversationContext,
        baseContext
      );
    }

    return {
      personalContext: baseContext.personal_knowledge,
      teamContext: baseContext.team_knowledge,
      contextualRelevance,
      knowledgeAge: this.calculateKnowledgeAge(baseContext)
    };
  }

  // Calculate how relevant stored knowledge is to current conversation
  private calculateContextualRelevance(
    conversationContext: string,
    knowledgeContext: any
  ): number {
    // Simple keyword matching for now - could be enhanced with ML
    const contextWords = conversationContext.toLowerCase().split(/\s+/);
    const knowledgeText = JSON.stringify(knowledgeContext).toLowerCase();
    
    const matches = contextWords.filter(word => 
      word.length > 3 && knowledgeText.includes(word)
    ).length;
    
    return Math.min(1.0, matches / Math.max(1, contextWords.length * 0.1));
  }

  // Calculate average age of knowledge items
  private calculateKnowledgeAge(knowledgeContext: any): string {
    const now = Date.now();
    const timestamps: number[] = [];
    
    // Extract timestamps from knowledge context
    const extractTimestamps = (obj: any) => {
      if (typeof obj === 'object' && obj !== null) {
        if (obj.detected_at) {
          timestamps.push(new Date(obj.detected_at).getTime());
        }
        Object.values(obj).forEach(value => {
          if (typeof value === 'object') {
            extractTimestamps(value);
          }
        });
      }
    };
    
    extractTimestamps(knowledgeContext);
    
    if (timestamps.length === 0) {
      return 'unknown';
    }
    
    const avgTimestamp = timestamps.reduce((a, b) => a + b) / timestamps.length;
    const ageMs = now - avgTimestamp;
    const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
    
    if (ageDays < 1) return 'fresh';
    if (ageDays < 7) return 'recent';
    if (ageDays < 30) return 'current';
    return 'aged';
  }
}

// Export singleton instance
export const knowledgeExtractionService = new KnowledgeExtractionService();