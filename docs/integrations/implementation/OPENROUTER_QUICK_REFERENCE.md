# OpenRouter API Quick Reference

**Last Updated**: September 23, 2025  
**Status**: ✅ Production Ready  

## TL;DR

Sam AI migrated from Mistral SDK → OpenRouter API for enhanced flexibility and multi-model capabilities. All functionality preserved, new environment variable required.

## Environment Variables

### Required
```bash
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

### Optional (Recommended)
```bash
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### Removed
```bash
# No longer needed
MISTRAL_API_KEY=...
```

## Quick Setup

### 1. Get OpenRouter API Key
1. Visit [openrouter.ai](https://openrouter.ai)
2. Create account and add payment method
3. Generate API key in dashboard
4. Add to environment variables

### 2. Test Integration
```bash
node scripts/js/test-openrouter-integration.js
```

### 3. Deploy
```bash
npm run build  # Verify compilation
# Deploy with OPENROUTER_API_KEY set
```

## API Details

### Current Model
```
mistralai/mistral-large-2407
```

### Endpoint
```
https://openrouter.ai/api/v1/chat/completions
```

### Headers
```typescript
{
  'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
  'Content-Type': 'application/json',
  'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL,
  'X-Title': 'Sam AI Sales Consultant'
}
```

## Modified Files

### Core Engine
- `/app/api/sam/threads/[threadId]/messages/route.ts`
  - `callMistralAI()` → `callOpenRouterAPI()`
  - Environment variable: `MISTRAL_API_KEY` → `OPENROUTER_API_KEY`

### MCP Tools
- `/lib/mcp/mistral-mcp.ts`
  - Removed Mistral SDK dependency
  - Updated `callMistralAPI()` function to use OpenRouter

## Testing

### Build Test
```bash
npm run build
# ✓ Should complete without errors
```

### Integration Test
```bash
node scripts/js/test-openrouter-integration.js
# ✅ All tests should pass
```

### Functional Test
1. Start Sam conversation
2. Try: "Create a campaign targeting tech CEOs"
3. Try: "Optimize my LinkedIn template"
4. Verify: Sam responds appropriately

### Fallback Test
1. Remove `OPENROUTER_API_KEY` temporarily
2. Test Sam conversation
3. Verify: Intelligent mock responses
4. Restore API key

## Troubleshooting

### Issue: "OpenRouter API key not configured"
**Solution**: Add `OPENROUTER_API_KEY` to environment variables

### Issue: "OpenRouter API error: 401"
**Solution**: 
1. Verify API key is correct
2. Check OpenRouter account has credits
3. Ensure no extra spaces in environment variable

### Issue: "OpenRouter API error: 429"
**Solution**: Rate limit exceeded, wait and retry

### Issue: Different responses than before
**Solution**: 
1. Verify model is `mistralai/mistral-large-2407`
2. Check system prompt unchanged
3. Confirm parameters match previous config

## Model Options (Future)

### Available via OpenRouter
```typescript
// Current
'mistralai/mistral-large-2407'

// Alternatives
'anthropic/claude-3.5-sonnet'     // Best reasoning
'openai/gpt-4o'                   // General intelligence  
'meta-llama/llama-3.1-405b'       // Open source
'google/gemini-pro'               // Google ecosystem
```

### Model Switching
Update in both files:
- `/app/api/sam/threads/[threadId]/messages/route.ts` (line ~30)
- `/lib/mcp/mistral-mcp.ts` (line ~387)

## Cost Monitoring

### OpenRouter Dashboard
- View token usage: [openrouter.ai/activity](https://openrouter.ai/activity)
- Monitor costs: Real-time usage tracking
- Set alerts: Budget and usage thresholds

### Cost Optimization
- Use cheaper models for simple tasks
- Implement response caching
- Optimize max_tokens limits

## Support

### OpenRouter Resources
- **Docs**: [docs.openrouter.ai](https://docs.openrouter.ai)
- **Models**: [openrouter.ai/models](https://openrouter.ai/models)
- **Status**: [status.openrouter.ai](https://status.openrouter.ai)
- **Discord**: OpenRouter community

### Internal Resources
- **Full Documentation**: `/docs/integrations/implementation/OPENROUTER_API_INTEGRATION.md`
- **Migration Guide**: `/docs/integrations/implementation/OPENROUTER_MIGRATION_GUIDE.md`
- **Test Script**: `/scripts/js/test-openrouter-integration.js`

## Fallback Behavior

### When API Unavailable
Sam automatically provides intelligent mock responses:

- **Campaign creation**: Guides through process with built-in tools
- **Template optimization**: Uses local optimization algorithms  
- **General questions**: Maintains consultant personality

### Monitoring Fallback Usage
```bash
# Check logs for:
"🔄 Falling back to mock response"
```

High fallback usage indicates API issues or configuration problems.

## Security Notes

### API Key Security
- ⚠️ Never commit API keys to version control
- ✅ Use environment variables only
- ✅ Rotate keys quarterly
- ✅ Monitor usage for anomalies

### Attribution Requirements
OpenRouter requires proper attribution via headers:
```typescript
'HTTP-Referer': 'https://your-domain.com'
'X-Title': 'Your App Name'
```

## Quick Commands

### Check Integration Status
```bash
# Test current setup
node scripts/js/test-openrouter-integration.js

# Build verification  
npm run build

# Check environment
echo $OPENROUTER_API_KEY
```

### Reset to Working State
```bash
# If issues, verify these files are updated:
git log --oneline -5 app/api/sam/threads/[threadId]/messages/route.ts
git log --oneline -5 lib/mcp/mistral-mcp.ts

# Check environment variables
env | grep OPENROUTER
```

### Emergency Rollback
```bash
# If critical issues (use with caution)
git checkout HEAD~1 -- app/api/sam/threads/[threadId]/messages/route.ts
git checkout HEAD~1 -- lib/mcp/mistral-mcp.ts
npm install @mistralai/mistralai
# Set MISTRAL_API_KEY instead of OPENROUTER_API_KEY
```

---

## Summary

✅ **Migration Complete**: Mistral SDK → OpenRouter API  
✅ **Functionality Preserved**: All Sam AI features operational  
✅ **Enhanced Flexibility**: Multi-model access via single API  
✅ **Future-Proof**: Easy model switching and optimization  
✅ **Production Ready**: Tested and verified  

**Key Requirement**: Add `OPENROUTER_API_KEY` to environment variables

For detailed information, see the full documentation in `/docs/integrations/implementation/OPENROUTER_API_INTEGRATION.md`