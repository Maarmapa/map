/**
 * BOT.JS INTEGRATION SNIPPET
 * 
 * /webpost-adobe command using Haiku + Adobe Creative MCP
 * 
 * Copy this section and paste into bot.js message handler
 */

// ============================================
// At the TOP of bot.js:
// ============================================
const WebPostHaikuAdobeMCP = require('./webpost-haiku-adobe-mcp-module.js');
const webpostHaikuAdobe = new WebPostHaikuAdobeMCP();

// ============================================
// In the message handler (inside bot.on('text')):
// ============================================

// /webpost-adobe command
if (msg.text?.startsWith('/webpost-adobe ')) {
  const query = msg.text.replace('/webpost-adobe ', '').trim();

  if (!query || query.length === 0) {
    await bot.sendMessage(
      chatId,
      `📱 *WebPost with Adobe Creative*\n\nUsage: /webpost-adobe <topic>\n\nExample:\n/webpost-adobe Chile tech startups\n\nFeatures:\n✍️  Post generation (Haiku)\n🎨 Image carousel (Adobe Creative)\n🎬 Video (Runway)`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const loadingMsg = await bot.sendMessage(
    chatId,
    `🔍 Searching "${query}"...\n⏳ Generating post with Haiku...\n🎨 Creating images with Adobe...`,
    { parse_mode: 'Markdown' }
  );

  try {
    console.log(`[Bot] /webpost-adobe "${query}"`);
    
    // Run with image generation enabled
    const result = await webpostHaikuAdobe.run(query, {
      generateImages: true,
      generateVideo: true,
      imageCount: 3,
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    // Format for Telegram
    const formatted = webpostHaikuAdobe.formatForTelegram(result);

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

    console.log(`[Bot] ✅ /webpost-adobe complete (${result.tokens.total} tokens)`);
  } catch (error) {
    console.error(`[Bot] ❌ /webpost-adobe error:`, error.message);

    // Delete loading message
    try {
      await bot.deleteMessage(chatId, loadingMsg.message_id);
    } catch (e) {
      // Ignore
    }

    // Send error
    await bot.sendMessage(
      chatId,
      `❌ *Error:* ${error.message}\n\nMake sure ANTHROPIC_API_KEY is set.`,
      { parse_mode: 'Markdown' }
    );
  }
}

// ============================================
// Optional: /webpost-adobe-help command
// ============================================

if (msg.text === '/webpost-adobe-help') {
  const helpText = `📱 *WebPost with Adobe Creative*

*Usage:*
\`/webpost-adobe <topic>\`

*Examples:*
• /webpost-adobe Chile tech startups
• /webpost-adobe AI regulation trends
• /webpost-adobe Web3 adoption enterprise

*What it does:*
1. 🔍 Search with Brave API (0 tokens)
2. ✍️  Generate post with Claude Haiku (~150 tokens)
3. 🎨 Create carousel images with Adobe Creative
4. 🎬 Generate video with Runway ML
5. 📚 Link to source articles

*Token breakdown (Haiku path):*
• Brave search: 0 ✅
• Haiku post: ~150 tokens (cheaper than OpenRouter!)
• Adobe images: Separate billing
• Runway video: Async (no tokens)
• Total: ~150 tokens per post

*Environment variables:*
\`ANTHROPIC_API_KEY\` (required for Haiku)
\`BRAVE_SEARCH_API_KEY\` (optional, falls back to mock)
\`ADOBE_ACCESS_TOKEN\` (required for images)
\`RUNWAY_API_KEY\` (optional for video)

*No Grok. No DeepSeek. No OpenRouter.*
*Haiku + Adobe + Brave. All in-house.*
`;

  await bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
}

// ============================================
// Optional: /webpost-compare command (show all versions)
// ============================================

if (msg.text === '/webpost-compare') {
  const compareText = `📱 *WebPost Commands Comparison*

| Command | Search | Model | Tokens | Images |
|---------|--------|-------|--------|--------|
| /post | — | Grok | ~350 | Grok |
| /webpost | Brave ✅ | OpenRouter | ~200 | Runway |
| /webpost-carousel | Web | OpenRouter | ~300 | Web |
| /webpost-adobe | Brave ✅ | Haiku ✅ | ~150 ✅ | Adobe ✅ |

*Winner for cost?* /webpost-adobe (~150 tokens)
*Winner for images?* /webpost-adobe (Adobe Creative)
*Winner for speed?* /webpost-adobe (Haiku is fastest)

Try: /webpost-adobe Chile tech startups`;

  await bot.sendMessage(chatId, compareText, { parse_mode: 'Markdown' });
}

// ============================================
// INTEGRATION CHECKLIST
// ============================================

/*
SETUP CHECKLIST for /webpost-adobe

Environment Variables:
☐ ANTHROPIC_API_KEY=sk-ant-... (Haiku)
☐ ADOBE_CLIENT_ID=xxx (for images)
☐ ADOBE_CLIENT_SECRET=xxx
☐ ADOBE_ACCESS_TOKEN=xxx
☐ BRAVE_SEARCH_API_KEY=xxx (optional)
☐ RUNWAY_API_KEY=xxx (optional for video)

Code Changes:
☐ 1. Copy webpost-haiku-adobe-mcp-module.js to /tmp/map/
☐ 2. Add import at top of bot.js:
     const WebPostHaikuAdobeMCP = require('./webpost-haiku-adobe-mcp-module.js');
     const webpostHaikuAdobe = new WebPostHaikuAdobeMCP();

☐ 3. Add /webpost-adobe handler to message listener (above)
☐ 4. Add /webpost-adobe-help handler (optional)
☐ 5. Add /webpost-compare handler (optional)

Testing:
☐ npm start (local test)
☐ /webpost-adobe Chile tech (verify works)
☐ Check token usage in output
☐ Check image generation

Deployment:
☐ Set all env vars in Render
☐ Deploy bot to Render
☐ Test: /webpost-adobe test query
☐ Monitor: Check logs for errors

Token Monitoring:
☐ Install token-monitor.js integration
☐ Track Haiku tokens per command
☐ Set up token alerts

Success Criteria:
✅ Post generates in ~4 seconds
✅ Images (if Adobe key set) appear in output
✅ Token count shown (150-200 for Haiku)
✅ Sources linked
✅ Video queues (if Runway key set)
*/
