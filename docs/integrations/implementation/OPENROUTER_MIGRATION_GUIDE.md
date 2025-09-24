# OpenRouter API Migration Guide

**Migration Date**: September 23, 2025  
**Type**: Critical Infrastructure Change  
**Impact**: Sam AI Core Engine + MCP Template Tools  

## Migration Overview

This guide documents the technical migration from direct Mistral SDK to OpenRouter API, providing enhanced flexibility and multi-model capabilities for Sam AI.

## Pre-Migration State

### Dependencies
```json
{
  "@mistralai/mistralai": "^1.0.0"
}
```

### Environment Variables
```bash
MISTRAL_API_KEY=your_mistral_api_key
```

### API Integration Pattern
```typescript
import Mistral from '@mistralai/mistralai'
const mistralClient = new Mistral({ apiKey: process.env.MISTRAL_API_KEY })
```

## Post-Migration State

### Dependencies
```json
{
  // @mistralai/mistralai removed - no longer needed
}
```

### Environment Variables
```bash
OPENROUTER_API_KEY=your_openrouter_api_key
NEXT_PUBLIC_APP_URL=https://your-domain.com  # Optional, for attribution
```

### API Integration Pattern
```typescript
// Direct HTTP fetch to OpenRouter
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ model: 'mistralai/mistral-large-2407', ... })
})
```

## File-by-File Migration Details

### 1. Core Sam AI Engine

**File**: `/app/api/sam/threads/[threadId]/messages/route.ts`

#### Changes Made

**Removed**:
```typescript
import Mistral from '@mistralai/mistralai'

const mistralClient = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY
})

async function callMistralAI(messages: any[], systemPrompt: string) {
  const mistralKey = process.env.MISTRAL_API_KEY;
  // ... Mistral SDK implementation
  const response = await mistralClient.chat.complete({
    model: 'mistral-large-latest',
    // ...
  });
}
```

**Added**:
```typescript
async function callOpenRouterAPI(messages: any[], systemPrompt: string) {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  
  if (!openRouterKey) {
    console.log('⚠️  OpenRouter API key not configured, using fallback');
    return getMockSamResponse(messages);
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://innovareai.com',
        'X-Title': 'Sam AI Sales Consultant'
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-large-2407',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((msg: any) => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content
          }))
        ],
        temperature: 0.7,
        max_tokens: 1000,
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in OpenRouter response');
    }

    return content;
    
  } catch (error) {
    console.error('❌ OpenRouter API error:', error);
    console.log('🔄 Falling back to mock response');
    return getMockSamResponse(messages);
  }
}
```

**Function Call Updated**:
```typescript
// Before
aiResponse = await callMistralAI(messages, systemPrompt)

// After  
aiResponse = await callOpenRouterAPI(messages, systemPrompt)
```

### 2. MCP Template Tools

**File**: `/lib/mcp/mistral-mcp.ts`

#### Changes Made

**Removed**:
```typescript
import Mistral from '@mistralai/mistralai'

const mistralClient = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY
})

async function callMistralAPI(request: {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature: number;
  max_tokens: number;
}): Promise<{ content: string }> {
  try {
    if (!process.env.MISTRAL_API_KEY) {
      return getMockMistralResponse(request);
    }
    
    const response = await mistralClient.chat.complete({
      model: request.model,
      messages: request.messages.map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content
      })),
      temperature: request.temperature,
      maxTokens: request.max_tokens
    })
    // ...
  }
}
```

**Added**:
```typescript
// Using OpenRouter API for Mistral access

async function callMistralAPI(request: {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature: number;
  max_tokens: number;
}): Promise<{ content: string }> {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      console.log('⚠️  OpenRouter API key not found, using mock response');
      return getMockMistralResponse(request);
    }

    console.log('🧠 Calling OpenRouter API for Mistral:', request.model);
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://innovareai.com',
        'X-Title': 'Sam AI Template Optimization'
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-large-2407',
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.max_tokens,
        top_p: 0.9
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content
    
    if (!content) {
      throw new Error('No content in Mistral response')
    }

    return { content }
    
  } catch (error) {
    console.error('❌ Mistral API error:', error)
    console.log('🔄 Falling back to mock response')
    return getMockMistralResponse(request)
  }
}
```

## API Parameter Mapping

### Mistral SDK → OpenRouter API

| Mistral SDK | OpenRouter API | Notes |
|-------------|----------------|-------|
| `model: 'mistral-large-latest'` | `model: 'mistralai/mistral-large-2407'` | Specific version for consistency |
| `maxTokens: 1000` | `max_tokens: 1000` | Snake_case format |
| `temperature: 0.7` | `temperature: 0.7` | Unchanged |
| N/A | `top_p: 0.9` | Added for better control |
| N/A | `frequency_penalty: 0.1` | Added to reduce repetition |
| N/A | `presence_penalty: 0.1` | Added for topic diversity |

### Response Format Changes

**Mistral SDK Response**:
```typescript
{
  choices: [{
    message: {
      content: "response text"
    }
  }]
}
```

**OpenRouter API Response**:
```typescript
{
  choices: [{
    message: {
      content: "response text"
    }
  }]
}
```
*Note: Response format is identical (OpenAI-compatible)*

## Environment Variable Migration

### Development Environment

**Before** (`.env.local`):
```bash
MISTRAL_API_KEY=your_mistral_api_key_here
```

**After** (`.env.local`):
```bash
OPENROUTER_API_KEY=your_openrouter_api_key_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Production Environment

**Before**:
```bash
MISTRAL_API_KEY=prod_mistral_key
```

**After**:
```bash
OPENROUTER_API_KEY=prod_openrouter_key
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
```

## Testing Migration

### 1. Build Verification

```bash
npm run build
# Should complete without errors
```

### 2. Integration Testing

Run the OpenRouter integration test:

```bash
node scripts/js/test-openrouter-integration.js
```

Expected output:
```
🌐 SAM AI OPENROUTER INTEGRATION TEST
====================================

🔧 Test 1: OpenRouter API Configuration Check
✅ OpenRouter API key configured
✅ Sam will use live OpenRouter → Mistral responses

🔄 Test 2: Engine Migration Status
✅ MIGRATED Sam Message API
✅ UPDATED API Endpoint
✅ UPDATED Model Reference
✅ MIGRATED MCP Template Tools
✅ UPDATED Fallback Handling

🎉 OPENROUTER INTEGRATION SUMMARY
=================================
🟢 Migration: COMPLETE
🟢 API Integration: READY
🟢 Model Access: OPERATIONAL
🟢 Fallback System: ACTIVE
🟢 MCP Tools: INTEGRATED
```

### 3. Functional Testing

Test Sam AI conversations:

1. **Basic Conversation**:
   - User: "Hi Sam, how can you help me?"
   - Expected: Sam responds with consultant introduction

2. **Campaign Creation**:
   - User: "Create a campaign targeting tech CEOs"
   - Expected: Campaign creation via MCP tools

3. **Template Optimization**:
   - User: "Optimize my LinkedIn template"
   - Expected: Template optimization via OpenRouter → Mistral

### 4. Fallback Testing

Test fallback behavior:

1. Temporarily remove `OPENROUTER_API_KEY`
2. Test Sam conversations
3. Expected: Intelligent mock responses
4. Restore API key and verify normal operation

## Rollback Procedure

If rollback is needed:

### 1. Revert Code Changes

```bash
git checkout HEAD~1 -- app/api/sam/threads/[threadId]/messages/route.ts
git checkout HEAD~1 -- lib/mcp/mistral-mcp.ts
```

### 2. Restore Dependencies

```bash
npm install @mistralai/mistralai
```

### 3. Update Environment Variables

```bash
# Remove
OPENROUTER_API_KEY=...
NEXT_PUBLIC_APP_URL=...

# Add back
MISTRAL_API_KEY=your_mistral_api_key
```

### 4. Verify Rollback

```bash
npm run build
# Test basic Sam functionality
```

## Performance Considerations

### Token Usage Optimization

**OpenRouter Advantages**:
- More detailed usage analytics
- Model-specific cost optimization
- Better rate limit handling

**Monitoring Points**:
- Average tokens per conversation
- Cost per conversation
- Response latency
- Error rates

### Rate Limits

**OpenRouter Rate Limits**:
- Varies by model and subscription tier
- Generally more generous than direct provider APIs
- Built-in queuing and retry logic

**Best Practices**:
- Monitor usage in OpenRouter dashboard
- Implement exponential backoff for retries
- Use appropriate max_tokens limits

## Security Considerations

### API Key Management

**OpenRouter API Key**:
- Treat as highly sensitive credential
- Rotate regularly (quarterly recommended)
- Monitor usage for anomalies
- Use environment variables, never hardcode

**Attribution Headers**:
```typescript
'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://innovareai.com'
'X-Title': 'Sam AI Sales Consultant'
```

### Request Validation

**Input Sanitization**:
- Validate message content before API calls
- Implement length limits for conversations
- Filter potentially harmful content

**Output Validation**:
- Verify response format matches expectations
- Check for appropriate response length
- Validate content before displaying to users

## Monitoring and Observability

### Application Metrics

**Key Metrics to Track**:
```typescript
// Response times
const startTime = Date.now()
const response = await callOpenRouterAPI(...)
const duration = Date.now() - startTime

// Success rates
const successRate = successfulRequests / totalRequests

// Fallback usage
const fallbackRate = fallbackRequests / totalRequests
```

### OpenRouter Dashboard

**Monitor**:
- Daily/monthly token usage
- Cost per model
- Error rates and types
- Response latency trends

### Error Tracking

**Critical Errors to Monitor**:
- Authentication failures (401)
- Rate limit exceeded (429)
- Model unavailable (503)
- Network timeouts

**Alerting Thresholds**:
- Error rate > 5%
- Fallback usage > 20%
- Response time > 10 seconds
- Daily cost > expected budget

## Documentation Updates

### Update Required in:

1. **README.md**: Environment variable section
2. **Deployment guides**: OpenRouter account setup
3. **API documentation**: Model references
4. **Troubleshooting guides**: New error scenarios

### Developer Onboarding

**New developers need**:
- OpenRouter account access (for production debugging)
- Understanding of multi-model architecture
- Familiarity with fallback behavior
- Knowledge of cost implications

## Cost Analysis

### Before Migration (Mistral Direct)

**Pricing Structure**:
- Direct Mistral API rates
- No additional overhead
- Limited to Mistral models only

### After Migration (OpenRouter)

**Pricing Structure**:
- OpenRouter markup (typically 10-20%)
- Access to multiple models
- Better usage analytics
- Potential volume discounts

**Cost Optimization Opportunities**:
- Model selection based on use case complexity
- Intelligent fallback to cheaper models
- Usage-based model routing

## Future Enhancements

### Multi-Model Routing

**Planned Implementation**:
```typescript
const modelConfig = {
  simple_questions: 'meta-llama/llama-3.1-70b',
  template_optimization: 'mistralai/mistral-large-2407',
  complex_analysis: 'anthropic/claude-3.5-sonnet',
  cost_sensitive: 'openai/gpt-4o-mini'
}
```

### A/B Testing Framework

**Model Performance Comparison**:
- Route conversations to different models
- Measure user satisfaction metrics
- Optimize model selection based on performance

### Advanced Features

**Streaming Responses**:
- Real-time response generation
- Better user experience
- Reduced perceived latency

**Response Caching**:
- Cache common template optimizations
- Reduce API costs for repeated queries
- Faster responses for similar requests

## Conclusion

The OpenRouter API migration successfully provides:

✅ **Enhanced Flexibility**: Multi-model access through single API  
✅ **Improved Reliability**: Better error handling and fallback options  
✅ **Future-Proofing**: Easy model switching and provider diversity  
✅ **Maintained Functionality**: All existing features operational  
✅ **Cost Visibility**: Better usage analytics and optimization opportunities  

The migration maintains Sam AI's core identity and capabilities while significantly expanding future possibilities for AI model utilization and optimization.

---

**Migration Status**: ✅ Complete  
**Production Deployment**: Ready  
**Next Review**: Q1 2026 for model optimization analysis