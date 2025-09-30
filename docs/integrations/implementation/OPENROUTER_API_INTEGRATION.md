# Sam AI OpenRouter API Integration

**Implementation Date**: September 23, 2025  
**Status**: ✅ Production Ready  
**Migration**: Mistral SDK Direct → OpenRouter API  

## Overview

Sam AI has been migrated from direct Mistral SDK integration to OpenRouter API, providing enhanced flexibility, reliability, and future-proofing for AI model access. This integration maintains Sam's American sales consultant personality while enabling multi-model capabilities through a single API.

## Architecture Changes

### Before: Direct Mistral Integration
```typescript
import Mistral from '@mistralai/mistralai'

const mistralClient = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY
})

const response = await mistralClient.chat.complete({
  model: 'mistral-large-latest',
  messages: [...],
  temperature: 0.7,
  maxTokens: 1000
})
```

### After: OpenRouter Integration
```typescript
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://innovareai.com',
    'X-Title': 'Sam AI Sales Consultant'
  },
  body: JSON.stringify({
    model: 'mistralai/mistral-large-2407',
    messages: [...],
    temperature: 0.7,
    max_tokens: 1000,
    top_p: 0.9,
    frequency_penalty: 0.1,
    presence_penalty: 0.1
  })
})
```

## Implementation Details

### 1. Core Sam AI Engine Migration

**File**: `/app/api/sam/threads/[threadId]/messages/route.ts`

**Changes Made**:
- Removed Mistral SDK import and client initialization
- Replaced `callMistralAI()` with `callOpenRouterAPI()`
- Updated environment variable check from `MISTRAL_API_KEY` to `OPENROUTER_API_KEY`
- Modified model reference from `mistral-large-latest` to `mistralai/mistral-large-2407`

**Key Features**:
- Standard OpenAI-compatible API format
- Enhanced error handling with detailed status codes
- Proper attribution headers for OpenRouter
- Optimized parameters for sales conversations

### 2. MCP Template Tools Migration

**File**: `/lib/mcp/sonnet-mcp.ts`

**Changes Made**:
- Removed Mistral SDK dependency
- Updated `callMistralAPI()` function to use OpenRouter endpoint
- Maintained all existing MCP tool interfaces
- Preserved intelligent fallback responses

**Affected MCP Tools**:
- `mcp__sonnet__optimize_template` - Template optimization
- `mcp__sonnet__analyze_performance` - Performance analysis
- `mcp__sonnet__generate_variations` - A/B test variations
- `mcp__sonnet__personalize_for_prospect` - Prospect personalization

### 3. Environment Configuration

**Required Environment Variables**:
```bash
# Primary API access
OPENROUTER_API_KEY=your_openrouter_api_key

# For HTTP-Referer header attribution
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Existing Supabase credentials (unchanged)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Migration Notes**:
- `MISTRAL_API_KEY` is no longer required
- All other environment variables remain unchanged
- Fallback system works without API key configuration

## API Integration Specifications

### OpenRouter Endpoint Configuration

**Base URL**: `https://openrouter.ai/api/v1/chat/completions`

**Headers**:
```typescript
{
  'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
  'Content-Type': 'application/json',
  'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL,
  'X-Title': 'Sam AI Sales Consultant'
}
```

**Model Configuration**:
```typescript
{
  model: 'mistralai/mistral-large-2407',
  temperature: 0.7,        // Balanced creativity for sales
  max_tokens: 1000,        // Concise but comprehensive responses
  top_p: 0.9,             // High quality token selection
  frequency_penalty: 0.1,  // Slight reduction in repetition
  presence_penalty: 0.1    // Encourage topic diversity
}
```

### System Prompt (Maintained)

Sam's American sales consultant identity and system prompts remain unchanged:

```typescript
const systemPrompt = `You are Sam, an AI Sales Consultant and Orchestration Agent designed for the American and global B2B sales market.

CONSULTANT APPROACH:
- Provide strategic sales guidance with expert-level insights
- Focus on measurable business outcomes and ROI optimization
- Use consultant-level language that demonstrates deep sales expertise
- Offer best practices from proven sales methodologies

AMERICAN SALES CULTURE:
- Direct, confident, and results-oriented communication
- Revenue and competitive positioning focus
- Fast-paced, action-oriented recommendations
- Data-driven decision making emphasis

ORCHESTRATION CAPABILITIES:
- Coordinate complex sales processes across multiple channels
- Integrate campaign management, template optimization, and performance analytics
- Route user requests to appropriate MCP tools seamlessly
...`
```

## Multi-Model Capabilities

### Current Model: Mistral Large 2407

**Optimized For**:
- Business conversation excellence
- European AI compliance (GDPR)
- Strategic sales consulting
- Template optimization and personalization

**Performance Characteristics**:
- High reasoning capability for complex sales scenarios
- Multilingual support for global markets
- Cost-effective for high-volume usage
- Fast response times for real-time conversations

### Future Model Options

OpenRouter provides access to multiple AI providers through a single API:

#### **Claude 4.5 Sonnet** (`anthropic/claude-4.5-sonnet`)
- **Best For**: Sophisticated conversation flows, complex reasoning
- **Use Cases**: Strategic planning, detailed prospect research
- **Advantages**: Superior context understanding, nuanced responses

#### **GPT-4o** (`openai/gpt-4o`)
- **Best For**: General business intelligence, broad knowledge
- **Use Cases**: Market analysis, competitive research
- **Advantages**: Extensive training data, reliable performance

#### **Llama 3.1 405B** (`meta-llama/llama-3.1-405b`)
- **Best For**: Open source compliance, cost optimization
- **Use Cases**: High-volume template generation, basic optimization
- **Advantages**: No vendor lock-in, transparent development

#### **Gemini Pro** (`google/gemini-pro`)
- **Best For**: Google ecosystem integration, multimodal capabilities
- **Use Cases**: Document analysis, presentation optimization
- **Advantages**: Google Workspace integration, competitive pricing

### Model Switching Implementation

Easy model switching through configuration:

```typescript
// Current configuration
const model = 'mistralai/mistral-large-2407'

// Switch to Claude for sophisticated reasoning
const model = 'anthropic/claude-4.5-sonnet'

// Switch to GPT-4o for general intelligence
const model = 'openai/gpt-4o'
```

## Fallback and Error Handling

### Intelligent Fallback System

When OpenRouter API is unavailable, Sam provides context-aware mock responses:

```typescript
function getMockSamResponse(messages: any[]): string {
  const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || ''
  
  // Campaign creation fallback
  if (/create.*campaign|new.*campaign/.test(lastMessage)) {
    return "🎯 I'd love to help you create a winning campaign! While I'm experiencing a temporary connection issue with my AI engine, I can still guide you through campaign creation using my built-in tools..."
  }
  
  // Template optimization fallback
  if (/optimize.*template|improve.*template/.test(lastMessage)) {
    return "💪 Let's optimize that template for maximum impact! I'm currently using my local optimization algorithms while my cloud AI reconnects..."
  }
  
  // Default consultant response
  return "🤝 I'm here to help drive your sales success! I'm experiencing a brief connectivity issue with my AI engine, but my core campaign management and template optimization tools are fully operational..."
}
```

### Error Recovery

**Automatic Retry Logic**:
1. Primary OpenRouter API call
2. If failed, log error and retry once
3. If still failed, provide intelligent mock response
4. Continue normal operation with degraded AI capabilities

**Error Logging**:
```typescript
console.error('❌ OpenRouter API error:', error)
console.log('🔄 Falling back to mock response')
```

## Performance Optimizations

### Request Optimization

**Conversation History Management**:
- Send only last 10 messages to reduce token usage
- Include system prompt once per conversation
- Clean up prompt leakage from responses

**Token Management**:
- Max tokens: 1000 (optimal for sales responses)
- Temperature: 0.7 (balanced creativity/consistency)
- Stop sequences: Prevent infinite generation

### Caching Strategy

**System Prompt Caching**:
- System prompt stored once per conversation thread
- Reduces redundant token usage
- Maintains consistency across messages

**Response Optimization**:
- Stream responses for better UX (future enhancement)
- Implement response compression
- Cache common template optimizations

## MCP Tool Integration

### Template Optimization Flow

```mermaid
graph TD
    A[User: "Optimize template"] --> B[ThreadedChatInterface]
    B --> C[handleSamMCPCommands]
    C --> D[/api/sam/mcp-tools]
    D --> E[sam-mcp-handler.ts]
    E --> F[mcp__sonnet__optimize_template]
    F --> G[OpenRouter API Call]
    G --> H[Mistral Large 2407]
    H --> I[Optimized Template Response]
    I --> J[Formatted Sam Response]
```

### Campaign Creation Flow

```mermaid
graph TD
    A[User: "Create campaign"] --> B[ThreadedChatInterface]
    B --> C[handleSamMCPCommands]
    C --> D[/api/sam/mcp-tools]
    D --> E[sam-mcp-handler.ts]
    E --> F[mcp__sam__create_campaign]
    F --> G[Database Operations]
    G --> H[Campaign Created]
    H --> I[Template Selection]
    I --> J[Execution Plan]
    J --> K[Formatted Sam Response]
```

### Natural Language Detection

Sam automatically detects user intent and routes to appropriate MCP tools:

```typescript
// Campaign creation commands
if (command.includes('create campaign') || 
    command.includes('start campaign') ||
    command.includes('new campaign') ||
    command.includes('campaign for') ||
    command.includes('target campaign')) {
  await executeSamMCPCommand(input, 'campaign')
  return true
}

// Template optimization commands
if (command.includes('optimize template') ||
    command.includes('improve template') ||
    command.includes('analyze template') ||
    command.includes('template performance')) {
  await executeSamMCPCommand(input, 'template')
  return true
}
```

## Testing and Validation

### Integration Testing

**Test Script**: `/scripts/js/test-openrouter-integration.js`

**Validation Points**:
- ✅ OpenRouter API key configuration
- ✅ Engine migration status verification
- ✅ Model reference updates
- ✅ Fallback system functionality
- ✅ MCP tool integration preservation

**Build Verification**:
```bash
npm run build
# ✓ Compiled successfully in 4.6s
```

### Production Readiness Checklist

- [x] **API Integration**: OpenRouter endpoint properly configured
- [x] **Authentication**: OPENROUTER_API_KEY environment variable support
- [x] **Model Configuration**: Mistral Large 2407 properly referenced
- [x] **Error Handling**: Graceful fallback to mock responses
- [x] **MCP Integration**: All 16 tools operational with OpenRouter
- [x] **Build Verification**: Successful compilation without errors
- [x] **Testing**: Integration test script validates all components
- [x] **Documentation**: Complete implementation documentation

## Deployment Instructions

### 1. Environment Configuration

Add to your environment variables:
```bash
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

Optional (for better attribution):
```bash
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### 2. OpenRouter Account Setup

1. Create account at [openrouter.ai](https://openrouter.ai)
2. Generate API key in dashboard
3. Add payment method for usage billing
4. Monitor usage and costs in OpenRouter dashboard

### 3. Model Configuration

Current model: `mistralai/mistral-large-2407`

To change models, update in both files:
- `/app/api/sam/threads/[threadId]/messages/route.ts`
- `/lib/mcp/sonnet-mcp.ts`

### 4. Testing in Production

1. Deploy with OpenRouter API key
2. Test Sam conversations for AI responses
3. Verify MCP tool functionality
4. Monitor OpenRouter usage dashboard
5. Test fallback behavior (remove API key temporarily)

## Monitoring and Analytics

### OpenRouter Dashboard

**Usage Metrics**:
- Token consumption per model
- Request/response latency
- Error rates and status codes
- Cost analysis and optimization opportunities

**Model Performance**:
- Response quality metrics
- User satisfaction indicators
- Cost per conversation analysis
- Model comparison data

### Application Monitoring

**Error Tracking**:
```typescript
console.error('❌ OpenRouter API error:', error)
console.log('🔄 Falling back to mock response')
```

**Performance Metrics**:
- Response time per conversation
- Fallback usage frequency
- MCP tool success rates
- User engagement patterns

## Future Enhancements

### Multi-Model Routing

**Planned Implementation**:
- Route different use cases to optimal models
- Implement cost-based model selection
- A/B test models for performance optimization
- Automatic fallback chains for reliability

**Example Configuration**:
```typescript
const modelConfig = {
  conversation: 'mistralai/mistral-large-2407',
  optimization: 'anthropic/claude-4.5-sonnet',
  analysis: 'openai/gpt-4o',
  fallback: 'meta-llama/llama-3.1-405b'
}
```

### Advanced Features

**Streaming Responses**:
- Real-time response generation
- Better user experience for long responses
- Reduced perceived latency

**Response Caching**:
- Cache common template optimizations
- Reduce API costs for repeated queries
- Faster response times for similar requests

**Usage Optimization**:
- Intelligent token management
- Model selection based on complexity
- Automatic cost optimization

## Troubleshooting

### Common Issues

**Issue**: OpenRouter API key not working
**Solution**: 
1. Verify API key is correct in environment variables
2. Check OpenRouter account has sufficient credits
3. Ensure HTTP-Referer header is properly configured

**Issue**: Responses seem different from before
**Solution**:
1. Verify model is set to `mistralai/mistral-large-2407`
2. Check system prompt hasn't changed
3. Confirm temperature and other parameters match previous configuration

**Issue**: MCP tools not working with OpenRouter
**Solution**:
1. Verify `/lib/mcp/sonnet-mcp.ts` has been updated
2. Check environment variable name changed from MISTRAL_API_KEY to OPENROUTER_API_KEY
3. Test fallback responses are working when API key is missing

### Support Resources

**OpenRouter Documentation**: [docs.openrouter.ai](https://docs.openrouter.ai)
**Model Information**: [openrouter.ai/models](https://openrouter.ai/models)
**Status Page**: [status.openrouter.ai](https://status.openrouter.ai)

## Conclusion

The OpenRouter API integration successfully provides Sam AI with:

- **Enhanced Flexibility**: Multi-model access through single API
- **Improved Reliability**: Better error handling and fallback options
- **Future-Proofing**: Easy model switching and provider diversity
- **Maintained Identity**: American sales consultant personality preserved
- **Complete MCP Integration**: All 16 tools operational with new API

This integration positions Sam AI for continued evolution with the rapidly advancing AI landscape while maintaining the core sales expertise and consultant approach that defines the platform.

---

**Integration Complete**: September 23, 2025  
**Status**: ✅ Production Ready  
**Next Review**: Q1 2026 for model optimization analysis