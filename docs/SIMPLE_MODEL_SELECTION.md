# Simple Model Selection - Customer View

## Overview
Customers can choose which AI model powers SAM from a curated list. **All models are included in their plan at no extra cost.** No pricing, no usage tracking visible to customers - just simple model selection.

---

## 🎯 What Customers See

### 1. **Simple Model Selector** (`components/ModelSelector.tsx`)
A clean card showing:
- Current AI model name
- Provider (e.g., "by Anthropic")
- "Change Model" button

**Example:**
```
┌─────────────────────────────────────┐
│ AI Model                            │
│ Claude Sonnet 4.5                   │
│ by Anthropic                        │
│                      [Change Model] │
└─────────────────────────────────────┘
```

### 2. **Model Selection Modal** (`components/LLMConfigModal.tsx`)
When clicking "Change Model", customers see:
- Simple dropdown with 18+ AI models grouped by provider
- Model description and capabilities (e.g., "Agentic workflows, Coding excellence")
- Save/Cancel buttons

**That's it.** No:
- ❌ Pricing information
- ❌ Usage statistics
- ❌ Cost tracking
- ❌ BYOK/Enterprise options
- ❌ Advanced settings (temperature, tokens)
- ❌ API keys
- ❌ Custom endpoints

---

## 📋 Available Models

Customers can choose from **18 approved models**:

### Anthropic
- Claude Sonnet 4.5 ⭐ (default)

### OpenAI
- GPT-5
- GPT-5 Mini
- GPT-5 Codex

### Mistral AI (EU-hosted 🇪🇺)
- Mistral Large
- Mistral Medium 3.1

### Google
- Gemini 2.5 Flash
- Gemini 2.5 Flash Lite

### DeepSeek
- DeepSeek V3.1
- DeepSeek V3.1 Terminus

### Meta
- LLaMA 4 Scout 17B

### Qwen (Alibaba)
- Qwen3 Max
- Qwen3 Coder Plus

### xAI
- Grok 4 Fast
- Grok Code Fast 1

### Cohere (EU-deployable 🇪🇺)
- Command A

Models marked with 🇪🇺 are hosted in EU regions for GDPR compliance.

---

## 💻 Usage for Developers

### Add Model Selector to Settings Page

```tsx
'use client';

import { useState } from 'react';
import ModelSelector from '@/components/ModelSelector';
import LLMConfigModal from '@/components/LLMConfigModal';

export default function SettingsPage() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div>
      <h1>Settings</h1>
      
      <ModelSelector 
        onChangeClick={() => setShowModal(true)}
      />
      
      <LLMConfigModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={() => {
          setShowModal(false);
          // Optionally reload the page or show success message
        }}
      />
    </div>
  );
}
```

### Add to User Profile/Header

```tsx
import ModelSelector from '@/components/ModelSelector';

// In your component
<ModelSelector onChangeClick={() => setShowConfigModal(true)} />
```

---

## 🔧 How It Works (Backend)

1. **User selects model** from dropdown
2. **Save to database** via `POST /api/llm/preferences`
3. **LLM Router reads preference** when SAM processes messages
4. **Routes to selected model** automatically
5. **No user intervention needed** after saving

All model routing is handled by `lib/llm/llm-router.ts` - completely transparent to the user.

---

## 🎨 Design Principles

### Keep It Simple
- ✅ One dropdown with models
- ✅ Show model description
- ✅ Show capabilities (tags)
- ✅ EU flag for compliance

### No Business Complexity
- ✅ No pricing (all included)
- ✅ No usage tracking (internal only)
- ✅ No advanced config (handled automatically)
- ✅ No confusing options

### Trust & Transparency
- ✅ "All models included at no extra cost"
- ✅ Clear model names and providers
- ✅ Simple language ("Choose AI Model")
- ✅ EU compliance visible (🇪🇺 flag)

---

## 🗂️ File Structure

### Components (Customer-Facing)
```
components/
├── ModelSelector.tsx          # Simple card showing current model
└── LLMConfigModal.tsx         # Modal to change model (simplified)
```

### Internal (Not Exposed to Customer)
```
lib/llm/
├── approved-models.ts         # Model catalog with metadata
└── llm-router.ts              # Routes requests to selected model

app/api/llm/
├── preferences/route.ts       # GET/POST user's model selection
├── models/route.ts            # GET approved models list
└── usage/route.ts             # (Internal - not shown to customers)
```

---

## 🚀 Next Steps

1. **Add to Settings Page**
   - Drop in `<ModelSelector />` component
   - Add modal trigger

2. **Test Model Switching**
   - Select different models
   - Verify SAM uses the selected model
   - Check conversation quality

3. **Optional: Show in Header**
   - Add subtle indicator of current model
   - E.g., "Powered by Claude Sonnet 4.5" in footer

---

## ✅ Summary

**For Customers:**
- Simple dropdown to choose AI model
- All models included (no extra cost)
- No complexity, no confusion

**For You:**
- Easy to maintain (one UI component)
- Automatic routing via LLM Router
- Flexible to add new models

**For Platform:**
- Single codebase
- No separate deployments per model
- Easy to scale and add providers

---

That's it! Clean, simple, user-friendly model selection. 🎯
