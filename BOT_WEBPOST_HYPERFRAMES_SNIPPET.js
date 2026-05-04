/**
 * BOT.JS INTEGRATION SNIPPET
 * 
 * /webpost-hyperframes command using Haiku + HeyGen Hyperframes
 * 
 * Copy this section and paste into bot.js message handler
 */

// ============================================
// At the TOP of bot.js:
// ============================================
const WebPostHyperframes = require('./webpost-hyperframes-module.js');
const webpostHyperframes = new WebPostHyperframes();

// ============================================
// In the message handler (inside bot.on('text')):
// ============================================

// /webpost-hyperframes command
if (msg.text?.startsWith('/webpost-hyperframes ')) {
  const query = msg.text.replace('/webpost-hyperframes ', '').trim();

  if (!query || query.length === 0) {
    await bot.sendMessage(
      chatId,
      `📱 *WebPost with HeyGen Hyperframes*\n\nUsage: /webpost-hyperframes <topic>\n\nExample:\n/webpost-hyperframes Chile tech startups\n\nFeatures:\n✍️  Post generation (Haiku - fastest)\n🎬 Carousel frames (Hyperframes - AI video)\n🎥 Full video (Runway - optional)`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const loadingMsg = await bot.sendMessage(
    chatId,
    `🔍 Searching "${query}"...\n⏳ Generating post with Haiku...\n🎬 Creating frames with Hyperframes...`,
    { parse_mode: 'Markdown' }
  );

  try {
    console.log(`[Bot] /webpost-hyperframes "${query}"`);
    
    // Run with frame generation enabled
    const result = await webpostHyperframes.run(query, {
      generateFrames: true,
      generateVideo: false, // Set to true if you have Runway key
      frameCount: 3,
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    // Format for Telegram
    const formatted = webpostHyperframes.formatForTelegram(result);

    // Delete loading message
    try {
      await bot.deleteMessage(chatId, loadingMsg.message_id);
    } catch (e) {
      // Ignore delete errors
    }

    // Send final post
    await bot.sendMessage(chatId, formatted, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });

    console.log(`[Bot] ✅ /webpost-hyperframes complete (${result.tokens.total} tokens)`);
  } catch (error) {
    console.error(`[Bot] ❌ /webpost-hyperframes error:`, error.message);

    // Delete loading message
    try {
      await bot.deleteMessage(chatId, loadingMsg.message_id);
    } catch (e) {
      // Ignore
    }

    // Send error
    await bot.sendMessage(
      chatId,
      `❌ *Error:* ${error.message}\n\nRequired:\nANTHROPIC_API_KEY (Haiku)\nHEYGEN_API_KEY (Hyperframes)`,
      { parse_mode: 'Markdown' }
    );
  }
}

// ============================================
// Optional: /webpost-hyperframes-help command
// ============================================

if (msg.text === '/webpost-hyperframes-help') {
  const helpText = `📱 *WebPost with HeyGen Hyperframes*

*Usage:*
\`/webpost-hyperframes <topic>\`

*What it does:*
1. 🔍 Search with Brave API (0 tokens)
2. ✍️  Generate post with Claude Haiku (~150 tokens - FASTEST)
3. 🎬 Create carousel frames with HeyGen Hyperframes
4. 📚 Link to source articles

*Why Hyperframes?*
• Native video frames (not static images)
• AI-powered animations
• Supports GSAP, Tailwind, custom HTML
• Deterministic rendering (same input = same output)
• Open source (Apache 2.0)
• Better than Adobe for video-based content

*Token breakdown:*
• Brave search: 0 ✅
• Haiku post: ~150 tokens ✅ (CHEAPEST)
• Hyperframes frames: Separate API
• Runway video: Optional
• Total: ~150 tokens per post

*Environment variables:*
\`ANTHROPIC_API_KEY\` (required for Haiku)
\`BRAVE_SEARCH_API_KEY\` (optional)
\`HEYGEN_API_KEY\` (required for frames)
\`RUNWAY_API_KEY\` (optional for full video)

*Examples:*
• /webpost-hyperframes AI trends 2026
• /webpost-hyperframes crypto adoption
• /webpost-hyperframes tech startups

*Haiku vs other models:*
✅ Haiku: ~150 tokens, ~2s (FASTEST)
⚠️  OpenRouter: ~200 tokens, ~4s
⚠️  Grok: ~350 tokens, ~5-10s

Haiku is the fastest Claude model!
`;

  await bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
}

// ============================================
// Optional: /webpost-pipeline command (show all options)
// ============================================

if (msg.text === '/webpost-pipeline') {
  const pipelineText = `🔄 *WebPost Pipeline Comparison*

\`\`\`
/post
├─ No search
├─ Grok post (~350 tokens)
└─ Result: Original content

/webpost-openrouter
├─ Brave search (0 tokens)
├─ OpenRouter post (~200 tokens)
└─ Result: News + no images

/webpost-adobe
├─ Brave search (0 tokens)
├─ Haiku post (~150 tokens)
├─ Adobe Creative images
└─ Result: News + professional images

/webpost-hyperframes ⭐ LATEST
├─ Brave search (0 tokens)
├─ Haiku post (~150 tokens)
├─ HeyGen Hyperframes (AI video frames)
└─ Result: News + AI-animated frames
\`\`\`

*Quick pick:*
• Brand new content: /post
• Budget news: /webpost-openrouter
• Professional images: /webpost-adobe
• AI video frames: /webpost-hyperframes ⭐
`;

  await bot.sendMessage(chatId, pipelineText, { parse_mode: 'Markdown' });
}

// ============================================
// INTEGRATION CHECKLIST
// ============================================

/*
SETUP CHECKLIST for /webpost-hyperframes

Environment Variables:
☐ ANTHROPIC_API_KEY=sk-ant-... (Haiku - REQUIRED)
☐ HEYGEN_API_KEY=xxx (Hyperframes - REQUIRED)
☐ BRAVE_SEARCH_API_KEY=xxx (optional)
☐ RUNWAY_API_KEY=xxx (optional for full video)

Code Changes:
☐ 1. Copy webpost-hyperframes-module.js to /tmp/map/
☐ 2. Add import at top of bot.js:
     const WebPostHyperframes = require('./webpost-hyperframes-module.js');
     const webpostHyperframes = new WebPostHyperframes();

☐ 3. Add /webpost-hyperframes handler (above)
☐ 4. Add /webpost-hyperframes-help handler (optional)
☐ 5. Add /webpost-pipeline handler (optional)

Testing:
☐ npm start (local test)
☐ /webpost-hyperframes Chile tech (verify works)
☐ Check token usage in output
☐ Check frame generation

Deployment:
☐ Set all env vars in Render
☐ Deploy bot to Render
☐ Test: /webpost-hyperframes test query
☐ Monitor: Check logs for errors

Success Criteria:
✅ Post generates in ~3 seconds
✅ Frames (if HeyGen key set) queued
✅ Token count shown (~150 for Haiku)
✅ Sources linked
✅ Status shows Hyperframes generation

Getting API Keys:
• HeyGen: https://www.heygen.com (need account + API key)
• Anthropic: https://console.anthropic.com
• Brave: https://api.search.brave.com
*/
