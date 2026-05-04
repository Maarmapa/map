# Adobe Creative MCP Configuration

## What This Does

Connects your bot to **Adobe Creative Cloud API** via MCP:
- ✅ Generate images (AI-powered)
- ✅ Edit designs (templates)
- ✅ Create carousels (for Instagram)
- ✅ Design templates

**No external API calls needed** (once configured)

---

## MCPs Available

### 1. Adobe Creative MCP (Official)
**Endpoint:** https://developer.adobe.com/internals/mcp-registry-web-app

**Capabilities:**
- `adobe/generate-images` - AI image generation
- `adobe/edit-design` - Modify existing designs
- `adobe/create-template` - Design templates
- `adobe/export-asset` - Download designs

### 2. Affinity MCP (Alternative)
If you use **Affinity Designer/Photo** instead:
- Direct file manipulation
- AI-powered image generation
- Vector/raster editing

### 3. Haiku Search (Optional)
For search without Brave key:
- `haiku/web-search` - Claude searches the web

---

## Setup Steps

### Step 1: Get Adobe Credentials

1. Go to: https://developer.adobe.com/console
2. Create a new project
3. Add "Image Generation API" service
4. Get:
   - `Client ID`
   - `Client Secret`
   - `Access Token` (or generate one)

### Step 2: Environment Variables

Add to `.env`:

```bash
# Adobe Creative API
ADOBE_CLIENT_ID=your_client_id
ADOBE_CLIENT_SECRET=your_client_secret
ADOBE_ACCESS_TOKEN=your_access_token

# Haiku (required for post generation)
ANTHROPIC_API_KEY=sk-ant-...

# Optional: Search
BRAVE_SEARCH_API_KEY=sk-brave-...

# Optional: Video
RUNWAY_API_KEY=...
```

### Step 3: Configure MCP Endpoint

In your OpenClaw config or bot environment:

```bash
MCP_ENDPOINT=https://adobe-mcp.your-domain.com
# or local
MCP_ENDPOINT=http://localhost:3000/mcp
```

### Step 4: Install MCP Client

```bash
npm install @adobe/mcp-client
```

---

## Integration Path 1: Via MCP Proxy

**Simplest setup** - Use OpenClaw's MCP bridge:

```javascript
// Already handled by WebPostHaikuAdobeMCP class
// Just set env vars and it works

const webpost = new WebPostHaikuAdobeMCP();
const result = await webpost.run('Chile tech startups', {
  generateImages: true,
  imageCount: 3,
});
```

---

## Integration Path 2: Direct API Calls

If you prefer **direct Adobe API** instead of MCP:

```javascript
// Generate images directly
async function generateImagesAdobeAPI(prompt) {
  const response = await axios.post(
    'https://api.adobe.io/services/v2/generativeImages/generate',
    {
      prompt,
      n: 3,
      size: '1080x1080',
      style: 'modern',
    },
    {
      headers: {
        'Authorization': `Bearer ${ADOBE_ACCESS_TOKEN}`,
        'x-api-key': ADOBE_CLIENT_ID,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data.images;
}
```

---

## Integration Path 3: Affinity Designer

If you use **Affinity Designer** with AI features:

```javascript
// Affinity has built-in AI image generation
// Can be triggered via command line or API

async function generateImagesAffinity(prompt) {
  // Use Affinity's native AI
  // Or export designs to images
  return {
    images: [...affinity_generated_images],
  };
}
```

---

## Test Configuration

### Test Adobe Connection

```bash
curl -X POST https://api.adobe.io/services/v2/generativeImages/generate \
  -H "Authorization: Bearer $ADOBE_ACCESS_TOKEN" \
  -H "x-api-key: $ADOBE_CLIENT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "test image",
    "n": 1,
    "size": "1080x1080"
  }'
```

### Test Module

```javascript
const WebPostHaikuAdobeMCP = require('./webpost-haiku-adobe-mcp-module.js');
const webpost = new WebPostHaikuAdobeMCP();

webpost.run('Chile tech startups', { generateImages: true })
  .then(result => {
    console.log('✅ Success:', result);
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
  });
```

---

## Token Cost Breakdown

### Path: Brave → Haiku → Adobe Images → Runway Video

| Step | Cost | Notes |
|------|------|-------|
| Brave search | 0 | Free API |
| Haiku post | ~150-200 tokens | Very cheap (Haiku 3.5) |
| Adobe images | 0 tokens | Billed separately by Adobe |
| Runway video | Async | No token cost |
| **Total** | **~150-200 tokens** | Ultra-cheap! |

**vs OpenRouter Path:**
- OpenRouter: ~200 tokens
- Haiku: ~150 tokens
- **Savings: 25-50 tokens per command** ✅

---

## Adobe Pricing

Adobe Creative API pricing:
- **Generative Credits:** ~25 credits per image
- **Free tier:** 25 generative credits/month
- **Paid tier:** $0.08-0.15 per 100 credits

**vs Expensive models:**
- Midjourney: $10-20 per month
- DALL-E 3: $0.08 per image
- Adobe: Comparable or cheaper ✅

---

## Affinity Alternative

If you have **Affinity Designer/Photo** locally:

```javascript
// Use Affinity's export API directly
// Trigger via CLI or API

async function generateImagesAffinity(prompt) {
  // Affinity has AI features built-in
  // Faster + cheaper than cloud APIs
}
```

---

## Example Output

```
📱 *WebPost (Haiku + Adobe): Chile tech startups*

✍️ *Post:*
🚀 The Chile tech startups space is heating up! 

Key insights:
• Innovation accelerating
• Early adopters gaining advantage
• Infrastructure improving

The question is when you'll jump in. 💭

📚 *Sources:*
1. [Article](url)

📊 *Token Usage:*
Haiku: 187 tokens
⏱️  Generated in 4.2s

🎨 *Carousel:* 3 images
🎬 Video: Generating
```

---

## Troubleshooting

### "ADOBE_ACCESS_TOKEN not set"
- Image generation skipped (non-fatal)
- Post still works, just no images
- Get token: https://developer.adobe.com/console

### "MCP_ENDPOINT unreachable"
- Falls back to direct API calls
- Or set up local MCP proxy

### Images not generating
- Check Adobe API quota
- Verify token is valid
- Check error in logs

### Haiku timeout
- Haiku is very fast (~2-3s)
- Check internet connection
- Verify `ANTHROPIC_API_KEY`

---

## Complete Setup Checklist

- [ ] Get Adobe credentials (Client ID, Secret, Token)
- [ ] Set all env vars (Adobe, Anthropic, Brave optional)
- [ ] Test Adobe API connection
- [ ] Install `webpost-haiku-adobe-mcp-module.js`
- [ ] Add module to bot.js imports
- [ ] Add `/webpost-adobe` command handler
- [ ] Test locally: `/webpost-adobe test topic`
- [ ] Deploy to Render
- [ ] Test in Telegram

---

## MCP Registry

Adobe maintains an MCP registry:
https://developer.adobe.com/internals/mcp-registry-web-app

See available MCPs and their capabilities there.

---

## Next Steps

1. Get Adobe credentials
2. Set env vars
3. Test module locally
4. Integrate into bot.js
5. Deploy

**All files ready in `/tmp/map/`** ✅
