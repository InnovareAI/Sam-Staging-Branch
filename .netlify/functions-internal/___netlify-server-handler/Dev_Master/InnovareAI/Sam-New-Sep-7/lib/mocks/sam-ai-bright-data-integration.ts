// Lightweight mock for Bright Data system to enable offline builds

export type SamAIBrightDataSystemConfig = any

export class SamAIBrightDataSystem {
  constructor(_config: SamAIBrightDataSystemConfig) {}

  async initialize(): Promise<{ success: boolean; message: string; components: string[] }> {
    return { success: true, message: 'Mock initialized', components: ['mock'] }
  }

  async processConversation(_userMessage: string, _conversationId: string, _context?: any) {
    return {
      success: true,
      response: {
        prospectData: [],
        strategicInsights: [],
        meddic: {},
        conversationStarters: []
      },
      systemHealth: { overall: 'healthy' },
      error: undefined as string | undefined
    }
  }

  async shutdown(): Promise<{ success: boolean; message: string }> {
    return { success: true, message: 'Mock shutdown' }
  }
}

export const defaultConfigurations = {
  production: {
    intelligence: { researchDepth: 'standard', maxConcurrentResearch: 2 },
    system: {},
    compliance: {},
    costManagement: {}
  }
} as const

export default SamAIBrightDataSystem
