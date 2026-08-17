# /webpost-openrouter Integration Guide

## What It Does

Clean, simple command: **Search → Post → Video**

```
/webpost Chile tech startups
```

### Flow
1. **Search** with Brave API (0 tokens)
2. **Generate post** with OpenRouter Llama 2 (~200 tokens)
3. **Create video** with Runway ML (async)
4. **Format** for Telegram with sources

### No Grok. No DeepSeek. Just OpenRouter.

---

## File Details

### `webpost-openrouter-module.js` (340 lines)
- **Class:** `WebPostOpenRouter`
- **Main method:** `run(query)` → Full pipeline
- **Searches:** Brave API (or mock if no key)
- **Posts:** OpenRouter (Llama 2 cheap model)
- **Videos:** Runway ML async
- **Output:** Telegram-formatted text

### Token Usage
- **Brave search:** 0 tokens ✅
- **OpenRouter post:** ~200 tokens (Llama 2)
- **Runway video:** Async (no token cost)
- **Total:** ~200 tokens per command

---

## Installation

### 1. Copy the module
```bash
cp webpost-openrouter-module.js /tmp/map/
```

### 2. Add to bot.js imports
```javascript
const { WebPostOpenRouter } = require('./webpost-openrouter-module.js');
const webpostOpenRouter = new WebPostOpenRouter();
```

### 3. Add command handler
```javascript
// In bot.js message handler, add:
if (msg.text?.startsWith('/webpost ')) {
  const query = msg.text.replace('/webpost ', '').trim();
  
  try {
    const result = await webpostOpenRouter.run(query);
    const formatted = webpostOpenRouter.formatForTelegram(result);
    await bot.sendMessage(chatId, formatted, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });
  } catch (error) {
    await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
}
```

### 4. Environment variables
Add to `.env`:
```bash
BRAVE_SEARCH_API_KEY=your_brave_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
RUNWAY_API_KEY=your_runway_api_key
```

### 5. Install dependencies (if needed)
```bash
npm install axios
```

---

## Usage Examples

### Example 1: Tech News
```
/webpost AI regulation trends 2026
```
**Output:**
- 📱 Post about AI regulation
- 🔗 Links to 3 articles
- 📊 Token usage: ~200 tokens
- 🎬 Video queued

### Example 2: Market Analysis
```
/webpost Chile crypto adoption
```
**Output:**
- ✍️ Curated post from search results
- 📚 Original sources linked
- ⏱️ Generation time
- 🎬 Runway video (async)

### Example 3: Industry Trends
```
/webpost Web3 adoption enterprise
```

---

## Architecture

### Search Phase
```
User query
    ↓
Brave API (0 tokens)
    ↓
Return: title, description, URL
```

### Post Generation Phase
```
Articles + query
    ↓
OpenRouter (Llama 2)
    ↓
Generate: Hook + body + CTA + emojis
    ↓
Track tokens used
```

### Video Phase
```
Post content
    ↓
Runway ML (async)
    ↓
Queue: 8-second mobile video
```

---

## Configuration

### Models
**OpenRouter models (cheapest, fastest):**
- `meta-llama/llama-2-70b-chat` (recommended) ← Uses this
- `mistralai/mixtral-8x7b-instruct` (alternative)
- `meta-llama/llama-3-8b` (ultra-cheap)

To change model, edit in `generatePostOpenRouter()`:
```javascript
model: 'mistralai/mixtral-8x7b-instruct',
```

### Temperature
- **0.8** = creative, conversational (current)
- **0.5** = balanced
- **0.3** = factual, formal

### Max Tokens
- **500** = current (~250 words)
- **300** = shorter posts
- **750** = longer analysis

---

## Testing

### Without API Keys (Mock Mode)
```bash
node -e "
const { WebPostOpenRouter } = require('./webpost-openrouter-module.js');
const webpost = new WebPostOpenRouter();

webpost.run('Chile tech startups').then(result => {
  console.log(JSON.stringify(result, null, 2));
});
"
```

### With Real APIs
1. Set env vars
2. Run the command above
3. Check Telegram: `/webpost your query`

---

## Comparison: Previous Commands

| Command | Search | Model | Tokens | Video | Use Case |
|---------|--------|-------|--------|-------|----------|
| `/post` | None | Grok | ~350 | Runway | Original content |
| `/webpost` | Brave | OpenRouter | ~200 ✅ | Runway | Curated news |
| `/webpost-carousel` | Web | OpenRouter | ~300 | Runway | Visual carousel |
| `/webpost-openrouter` | Brave | OpenRouter | ~200 ✅ | Runway | **You are here** |

**Why this one?**
- ✅ Simplest implementation
- ✅ 0 tokens for search
- ✅ No Grok dependency
- ✅ Reliable OpenRouter
- ✅ Fast Brave API

---

## Token Tracking

Integrates with `token-monitor.js`:
```javascript
this.tokenMonitor.addUsage('openrouter-post', tokensUsed);
```

View usage in Telegram:
```
/tokens
```

---

## Troubleshooting

### "BRAVE_SEARCH_API_KEY not set"
- Bot uses **mock search** (still works!)
- Add key to `.env` for real results
- Get key: https://api.search.brave.com

### "OPENROUTER_API_KEY not set"
- Command will fail
- Get key: https://openrouter.ai
- Add to `.env`

### Video not generating
- Runway API may be rate-limited
- Command continues without video (non-fatal)
- Check `RUNWAY_API_KEY` in `.env`

### Slow response
- Brave search is instant
- OpenRouter depends on model size
- Llama 2 is fast (~5-10s)
- Runway is async (doesn't block)

---

## Next Steps

1. ✅ Copy module to `/tmp/map/`
2. ✅ Add to `bot.js` imports
3. ✅ Add command handler
4. ✅ Set env vars
5. ✅ Test: `/webpost Chile tech`
6. Deploy to Render

---

## Files

- `webpost-openrouter-module.js` — Main implementation
- `WEBPOST_OPENROUTER_INTEGRATION.md` — This file

---

**Ready to deploy!** 🚀
