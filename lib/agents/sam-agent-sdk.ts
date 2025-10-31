/**
 * SAM AI Agent SDK Wrapper
 * Implements Claude Agent SDK for continuous conversations with automatic context compaction
 * Date: October 31, 2025
 */

import { query, Options, Query, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { SAM_AGENT_CONFIG, SUB_AGENT_CONFIGS } from './sam-agent-config';

/**
 * SAM Agent Session
 * Manages a single continuous conversation with automatic context compaction
 */
export class SAMAgentSession {
  private sessionId: string;
  private workspaceId: string;
  private config: Options;
  private conversationHistory: SDKMessage[] = [];

  constructor(workspaceId: string, sessionId?: string) {
    this.workspaceId = workspaceId;
    this.sessionId = sessionId || `sam-${workspaceId}-${Date.now()}`;

    // Clone config and inject workspace context
    this.config = {
      ...SAM_AGENT_CONFIG,
      systemPrompt: `${SAM_AGENT_CONFIG.systemPrompt}

Current Workspace Context:
- Workspace ID: ${workspaceId}
- Session ID: ${this.sessionId}
- All database operations must filter by workspace_id: ${workspaceId}`
    };
  }

  /**
   * Send a message to SAM and get response
   * Uses streaming mode for real-time responses
   */
  async *chat(userMessage: string): AsyncGenerator<string, void, unknown> {
    console.log(`💬 SAM Agent (${this.sessionId}): Processing message`);

    // Create query with current config
    const queryResult: Query = query(userMessage, this.config);

    let fullResponse = '';

    try {
      // Stream responses from Claude
      for await (const message of queryResult) {
        if (message.type === 'text') {
          fullResponse += message.content;
          yield message.content;
        } else if (message.type === 'tool_use') {
          console.log(`🔧 SAM Agent using tool: ${message.toolName}`);
          // Tool execution is handled automatically by the SDK
        } else if (message.type === 'error') {
          console.error(`❌ SAM Agent error:`, message.error);
          throw new Error(`SAM Agent error: ${message.error}`);
        }
      }

      // Store in conversation history
      this.conversationHistory.push({
        type: 'text',
        content: userMessage,
        role: 'user',
        timestamp: new Date().toISOString()
      } as SDKMessage);

      this.conversationHistory.push({
        type: 'text',
        content: fullResponse,
        role: 'assistant',
        timestamp: new Date().toISOString()
      } as SDKMessage);

      console.log(`✅ SAM Agent response complete (${fullResponse.length} chars)`);
    } catch (error) {
      console.error(`❌ SAM Agent chat error:`, error);
      throw error;
    }
  }

  /**
   * Get conversation history for this session
   */
  getHistory(): SDKMessage[] {
    return this.conversationHistory;
  }

  /**
   * Get session metadata
   */
  getMetadata() {
    return {
      sessionId: this.sessionId,
      workspaceId: this.workspaceId,
      messageCount: this.conversationHistory.length,
      createdAt: this.conversationHistory[0]?.timestamp || new Date().toISOString()
    };
  }
}

/**
 * Sub-Agent for specialized tasks
 * Can be invoked by the main SAM agent for focused work
 */
export class SAMSubAgent {
  private agentType: keyof typeof SUB_AGENT_CONFIGS;
  private workspaceId: string;
  private config: Options;

  constructor(
    agentType: keyof typeof SUB_AGENT_CONFIGS,
    workspaceId: string
  ) {
    this.agentType = agentType;
    this.workspaceId = workspaceId;

    // Build config from sub-agent definition
    const subConfig = SUB_AGENT_CONFIGS[agentType];
    this.config = {
      ...SAM_AGENT_CONFIG, // Inherit base config
      ...subConfig, // Override with sub-agent specific settings
      systemPrompt: `${subConfig.systemPrompt}

Current Workspace: ${workspaceId}`,
    };
  }

  /**
   * Execute a task with this sub-agent
   */
  async execute(task: string): Promise<string> {
    console.log(`🤖 Sub-Agent [${this.agentType}]: Starting task`);

    const queryResult: Query = query(task, this.config);

    let fullResponse = '';

    try {
      for await (const message of queryResult) {
        if (message.type === 'text') {
          fullResponse += message.content;
        } else if (message.type === 'tool_use') {
          console.log(`🔧 Sub-Agent [${this.agentType}] using tool: ${message.toolName}`);
        }
      }

      console.log(`✅ Sub-Agent [${this.agentType}] task complete`);
      return fullResponse;
    } catch (error) {
      console.error(`❌ Sub-Agent [${this.agentType}] error:`, error);
      throw error;
    }
  }
}

/**
 * SAM Agent Factory
 * Creates and manages SAM agent sessions
 */
export class SAMAgentFactory {
  private static sessions = new Map<string, SAMAgentSession>();

  /**
   * Get or create a SAM agent session for a workspace
   */
  static getSession(workspaceId: string, sessionId?: string): SAMAgentSession {
    const key = sessionId || `default-${workspaceId}`;

    if (!this.sessions.has(key)) {
      const session = new SAMAgentSession(workspaceId, sessionId);
      this.sessions.set(key, session);
      console.log(`🚀 Created new SAM Agent session: ${key}`);
    }

    return this.sessions.get(key)!;
  }

  /**
   * Create a sub-agent for specialized task execution
   */
  static createSubAgent(
    agentType: keyof typeof SUB_AGENT_CONFIGS,
    workspaceId: string
  ): SAMSubAgent {
    return new SAMSubAgent(agentType, workspaceId);
  }

  /**
   * Clean up old sessions (e.g., older than 24 hours)
   */
  static cleanupSessions(maxAgeHours: number = 24): void {
    const now = Date.now();
    const maxAge = maxAgeHours * 60 * 60 * 1000;

    for (const [key, session] of this.sessions.entries()) {
      const metadata = session.getMetadata();
      const sessionAge = now - new Date(metadata.createdAt).getTime();

      if (sessionAge > maxAge) {
        this.sessions.delete(key);
        console.log(`🧹 Cleaned up old SAM Agent session: ${key}`);
      }
    }
  }

  /**
   * Get all active sessions
   */
  static getActiveSessions(): { sessionId: string; metadata: any }[] {
    return Array.from(this.sessions.entries()).map(([_, session]) => ({
      sessionId: session.getMetadata().sessionId,
      metadata: session.getMetadata()
    }));
  }
}

/**
 * Example Usage:
 *
 * // Create a session for a workspace
 * const session = SAMAgentFactory.getSession('workspace-123');
 *
 * // Stream a conversation
 * for await (const chunk of session.chat('Find 10 prospects in healthcare industry')) {
 *   process.stdout.write(chunk);
 * }
 *
 * // Use a sub-agent for specialized task
 * const enricher = SAMAgentFactory.createSubAgent('dataEnricher', 'workspace-123');
 * const result = await enricher.execute('Enrich these 5 prospects with email addresses');
 * console.log(result);
 *
 * // Clean up old sessions periodically
 * setInterval(() => SAMAgentFactory.cleanupSessions(24), 1000 * 60 * 60); // Every hour
 */
