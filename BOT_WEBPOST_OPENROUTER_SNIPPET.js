/**
 * BOT.JS INTEGRATION SNIPPET
 * 
 * Add this to bot.js to enable /webpost-openrouter command
 * 
 * Copy this section and paste into the message handler in bot.js
 */

// ============================================
// At the TOP of bot.js, with other imports:
// ============================================
const { WebPostOpenRouter } = require('./webpost-openrouter-module.js');
const webpostOpenRouter = new WebPostOpenRouter();

// ============================================
// In the message handler (inside bot.on('text')):
// ============================================

// /webpost command
if (msg.text?.startsWith('/webpost ')) {
  const query = msg.text.replace('/webpost ', '').trim();

  if (!query || query.length === 0) {
    await bot.sendMessage(
      chatId,
      `📱 Usage: /webpost <topic>\n\nExample: /webpost Chile tech startups\n\nNo Grok. No DeepSeek. Just OpenRouter + Brave search.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Show loading state
  const loadingMsg = await bot.sendMessage(
    chatId,
    `🔍 Searching "${query}"...\n⏳ Generating post with OpenRouter...`,
    { parse_mode: 'Markdown' }
  );

  try {
    // Run the webpost command
    console.log(`[Bot] /webpost "${query}"`);
    const result = await webpostOpenRouter.run(query);

    if (!result.success) {
      throw new Error(result.error);
    }

    // Format for Telegram
    const formatted = webpostOpenRouter.formatForTelegram(result);

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

    // Add token reaction
    try {
      await bot.setMessageReaction(chatId, loadingMsg.message_id + 1, {
        reaction: [{ type: 'emoji', emoji: '✅' }],
      });
    } catch (e) {
      // Ignore reaction errors
    }

    console.log(`[Bot] ✅ /webpost complete (${result.tokens.total} tokens)`);
  } catch (error) {
    console.error(`[Bot] ❌ /webpost error:`, error.message);

    // Delete loading message
    try {
      await bot.deleteMessage(chatId, loadingMsg.message_id);
    } catch (e) {
      // Ignore
    }

    // Send error
    await bot.sendMessage(
      chatId,
      `❌ *Error:* ${error.message}\n\nMake sure OPENROUTER_API_KEY is set.`,
      { parse_mode: 'Markdown' }
    );
  }
}

// ============================================
// Optional: /webpost-help command
// ============================================

if (msg.text === '/webpost-help') {
  const helpText = `📱 *WebPost Command*

*Usage:*
\`/webpost <topic>\`

*Examples:*
• /webpost Chile tech startups
• /webpost AI regulation trends
• /webpost crypto adoption 2026

*What it does:*
1. 🔍 Search with Brave API (0 tokens)
2. ✍️  Generate post with OpenRouter (~200 tokens)
3. 🎬 Create video with Runway ML
4. 📚 Link to source articles

*Token breakdown:*
• Brave search: 0 ✅
• OpenRouter post: ~200 tokens
• Runway video: Async (no tokens)
• Total: ~200 tokens per post

*No Grok. No DeepSeek. Pure OpenRouter.*

Set env vars:
\`BRAVE_SEARCH_API_KEY\`
\`OPENROUTER_API_KEY\`
\`RUNWAY_API_KEY\` (optional)
`;

  await bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
}

// ============================================
// INTEGRATION CHECKLIST
// ============================================
/*
☐ 1. Copy webpost-openrouter-module.js to /tmp/map/
☐ 2. Add imports at top of bot.js:
     const { WebPostOpenRouter } = require('./webpost-openrouter-module.js');
     const webpostOpenRouter = new WebPostOpenRouter();
     
☐ 3. Add /webpost handler to message handler
☐ 4. Add /webpost-help handler (optional)
☐ 5. Set environment variables:
     BRAVE_SEARCH_API_KEY=xxx
     OPENROUTER_API_KEY=xxx
     RUNWAY_API_KEY=xxx (optional)
     
☐ 6. Test locally:
     /webpost Chile tech startups
     
☐ 7. Deploy to Render
☐ 8. Test in Telegram: /webpost your query
*/
