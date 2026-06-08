/**
 * BOT.JS INTEGRATION SNIPPET
 * 
 * /webpost-haiku-images command
 * Brave search + Haiku post + Haiku-generated image prompts + HTML carousel frames
 * 
 * EVERYTHING WITH HAIKU - NO OTHER IMAGE APIs!
 */

// ============================================
// At the TOP of bot.js:
// ============================================
const WebPostHaikuImages = require('./webpost-haiku-images-module.js');
const webpostHaikuImages = new WebPostHaikuImages();

// ============================================
// In the message handler (inside bot.on('text')):
// ============================================

// /webpost-haiku-images command
if (msg.text?.startsWith('/webpost-haiku-images ')) {
  const query = msg.text.replace('/webpost-haiku-images ', '').trim();

  if (!query || query.length === 0) {
    await bot.sendMessage(
      chatId,
      `📱 *WebPost with Haiku Images*\n\nUsage: /webpost-haiku-images <topic>\n\nExample:\n/webpost-haiku-images Chile tech startups\n\nFeatures:\n✍️  Post generation (Haiku)\n🎨 Image prompts (Haiku)\n📦 Carousel frames (Deterministic HTML)`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const loadingMsg = await bot.sendMessage(
    chatId,
    `🔍 Searching "${query}"...\n⏳ Generating post with Haiku...\n🎨 Creating image carousel...`,
    { parse_mode: 'Markdown' }
  );

  try {
    console.log(`[Bot] /webpost-haiku-images "${query}"`);
    
    // Run with HTML frames
    const result = await webpostHaikuImages.run(query, {
      imageFormat: 'html', // or 'svg'
      imageCount: 3,
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    // Format for Telegram
    const formatted = webpostHaikuImages.formatForTelegram(result);

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

    console.log(`[Bot] ✅ /webpost-haiku-images complete (${result.tokens.total} tokens)`);
  } catch (error) {
    console.error(`[Bot] ❌ /webpost-haiku-images error:`, error.message);

    // Delete loading message
    try {
      await bot.deleteMessage(chatId, loadingMsg.message_id);
    } catch (e) {
      // Ignore
    }

    // Send error
    await bot.sendMessage(
      chatId,
      `❌ *Error:* ${error.message}\n\nRequired: ANTHROPIC_API_KEY (Haiku)`,
      { parse_mode: 'Markdown' }
    );
  }
}

// ============================================
// Optional: /webpost-haiku-images-help
// ============================================

if (msg.text === '/webpost-haiku-images-help') {
  const helpText = `📱 *WebPost with Haiku Images*

*Usage:*
\`/webpost-haiku-images <topic>\`

*What it does:*
1. 🔍 Search with Brave API (0 tokens)
2. ✍️  Generate post with Claude Haiku (~200-250 tokens)
3. 🎨 Generate image prompts with Claude Haiku (included in post generation)
4. 📦 Create carousel frames (deterministic HTML, 0 tokens)
5. 📚 Link to source articles

*Why this is BEST:*
• ONLY Haiku - no other APIs
• Haiku generates both post AND image descriptions
• Deterministic HTML rendering (no external image API)
• Super fast (~3 seconds total)
• Cheapest option (~$0.03-0.04 per post)
• All in-house solution

*Token breakdown:*
• Brave search: 0 ✅
• Haiku post + prompts: ~200-250 tokens
• HTML frames: 0 (deterministic rendering)
• Total: ~200-250 tokens per post ✅

*Environment variables:*
\`ANTHROPIC_API_KEY\` (required - Haiku)
\`BRAVE_SEARCH_API_KEY\` (optional - falls back to mock)

*Examples:*
• /webpost-haiku-images AI trends 2026
• /webpost-haiku-images crypto adoption
• /webpost-haiku-images tech startups

*Why not use other image APIs:*
- Adobe: ~$1-2 per image (expensive)
- Hyperframes: Separate HeyGen API costs
- This way: Just Haiku! Simple, cheap, fast

*Image formats:*
- HTML carousel (Tailwind CSS) - default
- SVG carousel (lightweight)
`;

  await bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
}

// ============================================
// Optional: /webpost-comparison-simple (easy decision)
// ============================================

if (msg.text === '/webpost-simple') {
  const simpleText = `🎯 *Which WebPost should I use?*

\`\`\`
Easy decision tree:

1. Want original brand content?
   → /post (Grok)

2. Want just text post, budget?
   → /webpost-openrouter (~200 tokens)

3. Want post + images, only Haiku?
   → /webpost-haiku-images (~200-250 tokens) ⭐ SIMPLEST

4. Want professional static images?
   → /webpost-adobe (need Adobe key)

5. Want animated carousel for social?
   → /webpost-hyperframes (need HeyGen key)
\`\`\`

*Recommendation for STARTING:*
→ Use /webpost-haiku-images first
   • Only needs Anthropic key (you have it)
   • Brave key is optional
   • Cheapest
   • Fastest to set up
   • Produces great results
`;

  await bot.sendMessage(chatId, simpleText, { parse_mode: 'Markdown' });
}

// ============================================
// INTEGRATION CHECKLIST
// ============================================

/*
SETUP CHECKLIST for /webpost-haiku-images

Environment Variables:
☐ ANTHROPIC_API_KEY=sk-ant-... (Haiku - REQUIRED)
☐ BRAVE_SEARCH_API_KEY=xxx (optional, falls back to mock)

Code Changes:
☐ 1. Copy webpost-haiku-images-module.js to /tmp/map/
☐ 2. Add import at top of bot.js:
     const WebPostHaikuImages = require('./webpost-haiku-images-module.js');
     const webpostHaikuImages = new WebPostHaikuImages();

☐ 3. Add /webpost-haiku-images handler (above)
☐ 4. Add /webpost-haiku-images-help handler (optional)
☐ 5. Add /webpost-simple handler (optional)

Testing:
☐ npm start (local test)
☐ /webpost-haiku-images Chile tech (verify works)
☐ Check token usage in output
☐ Check carousel frame generation

Deployment:
☐ Set env vars in Render
☐ Deploy bot to Render
☐ Test: /webpost-haiku-images test query
☐ Monitor: Check logs

Success Criteria:
✅ Post generates in ~3 seconds
✅ Image frames generated (HTML format)
✅ Token count shown (~200-250 for Haiku)
✅ Sources linked
✅ No external API calls (except Brave search)

Why this is EASY to start:
• Minimal dependencies
• Only needs Anthropic API key
• Brave is optional (falls back to mock)
• No Adobe, HeyGen, Runway keys needed
• Single Haiku call for everything
*/
