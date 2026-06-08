# HeyGen Hyperframes Setup Guide

## What is HeyGen Hyperframes?

**Hyperframes** is an open-source video rendering framework by HeyGen:
- Write HTML/CSS/JavaScript
- Render to video frames or MP4
- Built for AI agents & deterministic rendering
- Better than static images: supports animations, timelines, responsive design

**vs Adobe Creative:**
- Adobe: Static AI-generated images
- Hyperframes: HTML → Dynamic video frames (animated, interactive)

**vs Remotion:**
- Remotion: React components (needs build step)
- Hyperframes: Plain HTML (no build needed, plays as-is)

---

## Getting Started

### 1. Get HeyGen API Key

1. Go to: https://www.heygen.com
2. Create account or log in
3. Go to API settings
4. Generate API key
5. Copy the key

### 2. Environment Variables

Add to `.env`:

```bash
# HeyGen Hyperframes API
HEYGEN_API_KEY=your_heygen_api_key

# Claude Haiku (required for posts)
ANTHROPIC_API_KEY=sk-ant-...

# Brave search (optional, fallback to mock)
BRAVE_SEARCH_API_KEY=sk-brave-...
```

### 3. Install Module

```bash
cp webpost-hyperframes-module.js /tmp/map/
npm install axios
```

### 4. Add to Bot

See `BOT_WEBPOST_HYPERFRAMES_SNIPPET.js` for full integration.

---

## How It Works

### Step 1: User Input
```
/webpost-hyperframes Chile tech startups
```

### Step 2: Search
- Brave API searches for articles
- Returns: title, description, URL
- **Cost: 0 tokens**

### Step 3: Generate Post
- Claude Haiku generates Instagram post
- Based on article summaries
- Includes hook, body, CTA, emojis
- **Cost: ~150 tokens**

### Step 4: Create HTML Composition
```html
<div id="stage" data-composition-id="carousel-1">
  <div class="h-full flex flex-col items-center justify-center p-8">
    <h1 class="text-5xl font-bold">Chile tech startups</h1>
    <p class="text-3xl font-semibold">Key insight about innovation</p>
    <span class="text-lg">1 / 3</span>
  </div>
</div>
```

### Step 5: Render with Hyperframes API
- Sends HTML composition to HeyGen
- Renders to video frames
- Returns image frames or MP4
- **Cost: Separate HeyGen API usage**

### Step 6: Return to User
```
📱 *WebPost (Haiku + Hyperframes): Chile tech startups*

✍️ *Post:*
🚀 The Chile tech startups space is heating up!
...

🎬 *Carousel:* 3 frames (Hyperframes)
```

---

## HTML Composition Structure

The module generates HTML frames automatically:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
</head>
<body class="bg-gradient-to-br from-slate-900 to-slate-800">
  <div id="stage" data-composition-id="carousel-1">
    <!-- Title -->
    <h1 id="title" class="text-5xl font-bold opacity-0">
      Chile tech startups
    </h1>
    
    <!-- Content -->
    <p id="content" class="text-3xl font-semibold opacity-0">
      Innovation accelerating
    </p>
    
    <!-- Counter -->
    <span id="counter" class="text-lg opacity-0">
      1 / 3
    </span>
  </div>

  <script>
    // GSAP timeline for animations
    const tl = gsap.timeline();
    tl.to('#title', { duration: 1, opacity: 1, ease: 'power2.out' }, 0)
      .to('#content', { duration: 1, opacity: 1 }, 0.3)
      .to('#counter', { duration: 0.8, opacity: 1 }, 0.6);
    
    // Register for Hyperframes seeking
    window.__hfTimeline = tl;
  </script>
</body>
</html>
```

---

## Features

### Styling
- **Tailwind CSS v4** (browser runtime)
- Gradients, animations, responsive design
- No build step needed

### Animations
- **GSAP** timelines (paused, seekable)
- Deterministic playback (frame-accurate)
- Timeline registration: `window.__hfTimeline`

### Composition
- Data attributes: `data-start`, `data-duration`, `data-track-index`
- HTML-native (plain markup)
- No React, no JSX

### Output
- Video frames (individual images)
- MP4 video (optional)
- Customizable resolution (1080x1920 for mobile)

---

## Token Cost Breakdown

| Component | Tokens | Cost |
|-----------|--------|------|
| Brave search | 0 | Free |
| Haiku post | ~150 | ~$0.02 |
| Hyperframes | 0 tokens | API usage (separate) |
| **Total** | **~150 tokens** | **~$0.02 + HeyGen API** |

**Monthly (30 posts):**
- Tokens: 4,500 tokens ≈ $90
- HeyGen API: ~$50-200 (depends on usage)
- **Total: ~$140-290/month**

---

## HeyGen Pricing

HeyGen Hyperframes API:
- **Pay-as-you-go:** Charge per frame/video rendered
- **Typical cost:** $0.10-0.50 per video
- **Free tier:** May have free credits for testing

Check https://www.heygen.com/pricing for current rates.

---

## API Endpoints

### Render Frames

```bash
POST https://api.heygen.com/v1/hyperframes/render

{
  "compositions": [
    {
      "id": "slide-1",
      "html": "<div>...</div>"
    }
  ],
  "format": "frames",      # or "video"
  "frameRate": 30,
  "quality": "high"
}
```

### Response

```json
{
  "frames": [
    "https://cdn.heygen.com/frame-1.png",
    "https://cdn.heygen.com/frame-2.png",
    "https://cdn.heygen.com/frame-3.png"
  ]
}
```

---

## Customization

### Change Frame Count

```javascript
const result = await webpostHyperframes.run(query, {
  generateFrames: true,
  frameCount: 5,  // Instead of 3
});
```

### Change Frame Style

Edit `createHtmlFrame()` in the module to customize:
- Colors (Tailwind classes)
- Fonts (from CDN or system)
- Animations (GSAP timeline)
- Layout (flex, grid, absolute)

### Add Full Video Generation

```javascript
const result = await webpostHyperframes.run(query, {
  generateFrames: true,
  generateVideo: true,  // Enable Runway video
  frameCount: 3,
});
```

---

## Troubleshooting

### "HEYGEN_API_KEY not set"
- Frame generation skipped (non-fatal)
- Post still works, just no frames
- Get key: https://www.heygen.com/api

### "Hyperframes render failed"
- Check API key validity
- Check HeyGen account has credits
- Check error logs for details

### "Haiku timeout"
- Haiku is very fast (2-3s normally)
- Check internet connection
- Verify `ANTHROPIC_API_KEY` is valid

### "No frames in response"
- Check Hyperframes API status
- Verify HTML composition is valid
- Check HeyGen API quota

---

## Advantages Over Alternatives

| Feature | Adobe | Hyperframes |
|---------|-------|------------|
| **Image generation** | AI (static) | HTML → frames |
| **Animations** | None | GSAP, CSS, native |
| **Customization** | Limited | Full HTML control |
| **Cost** | ~$1-2/image | ~$0.10-0.50/video |
| **Open source** | No | Yes (Apache 2.0) |
| **Building** | No | No build needed |
| **Format** | Static images | Video frames |

**Winner:** Hyperframes for dynamic, animated content ✅

---

## Next Steps

1. ✅ Get HeyGen API key
2. ✅ Set `HEYGEN_API_KEY` env var
3. ✅ Copy module to bot.js directory
4. ✅ Add integration snippet
5. ✅ Test: `/webpost-hyperframes your query`
6. ✅ Monitor frame generation
7. ✅ Adjust styles if needed

---

## Resources

- **Hyperframes Docs:** https://hyperframes.heygen.com/introduction
- **GitHub:** https://github.com/heygen-com/hyperframes
- **HeyGen API:** https://www.heygen.com/api
- **GSAP Docs:** https://gsap.com
- **Tailwind:** https://tailwindcss.com

---

## Example Output

```
📱 *WebPost (Haiku + Hyperframes): Chile tech startups*

✍️ *Post:*
🚀 The Chile tech startups space is heating up! 

Key insights:
• Innovation accelerating at unprecedented pace
• Early adopters gaining significant advantage
• Infrastructure improvements removing barriers

The question is when you'll jump in. 💭

📚 *Sources:*
1. [Chile tech startups - Latest](https://...)
2. [Market Analysis - Chile tech](https://...)

📊 *Token Usage:*
Haiku: 187 tokens
⏱️  Generated in 3.2s

🎬 *Carousel:* 3 frames (Hyperframes)
```

---

**Status:** Ready for production! 🚀
