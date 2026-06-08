/**
 * DEMO: webpost-openrouter command
 * 
 * This shows the exact output format you'll see in Telegram
 */

// Mock implementation (for demo purposes)
class WebPostOpenRouterDemo {
  async run(query) {
    const articles = [
      {
        title: `${query} - Latest Developments`,
        description: `Recent updates and innovations in ${query}`,
        url: `https://example.com/${query.replace(/\s+/g, '-')}`,
        snippet: '2 hours ago',
      },
      {
        title: `Market Analysis: ${query} Trends 2026`,
        description: `Deep dive into current trends affecting ${query}`,
        url: `https://example.com/analysis`,
        snippet: '4 hours ago',
      },
      {
        title: `${query}: What's Next?`,
        description: `Expert predictions on future direction`,
        url: `https://example.com/predictions`,
        snippet: '6 hours ago',
      },
    ];

    // Mock post content
    const postContent = `🚀 The ${query} space is heating up! 

Key insights:
• Innovation is accelerating at an unprecedented pace
• Early adopters are already seeing significant returns
• Infrastructure improvements are removing barriers to entry

The question isn't whether this matters—it's when you'll jump in. 

What's your take? 💭`;

    return {
      query,
      search: articles,
      post: {
        content: postContent,
        tokensUsed: 215,
        model: 'meta-llama/llama-2-70b-chat',
        elapsed: 4230,
      },
      video: {
        taskId: 'runway_123abc',
        status: 'queued',
      },
      tokens: {
        post: 215,
        total: 215,
      },
      elapsed: 4500,
      success: true,
    };
  }

  formatForTelegram(result) {
    if (!result.success) {
      return `❌ Error: ${result.error}`;
    }

    let text = `📱 *WebPost: ${result.query}*\n\n`;

    // Post content
    text += `✍️ *Post:*\n${result.post.content}\n\n`;

    // Sources
    text += `📚 *Sources:*\n`;
    result.search.slice(0, 2).forEach((article, i) => {
      text += `${i + 1}. [${article.title}](${article.url})\n`;
    });

    // Token info
    text += `\n📊 *Token Usage:*\n`;
    text += `OpenRouter: ${result.post.tokensUsed} tokens\n`;
    text += `⏱️  Generated in ${(result.elapsed / 1000).toFixed(1)}s\n`;

    if (result.video) {
      text += `\n🎬 Video: Generating (ID: ${result.video.taskId})\n`;
    }

    return text;
  }
}

// ============================================
// DEMO: Run examples
// ============================================

const demo = new WebPostOpenRouterDemo();

(async () => {
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // Example 1: Tech news
  console.log('📱 EXAMPLE 1: Tech News\n');
  console.log('Command: /webpost Chile tech startups\n');
  
  const result1 = await demo.run('Chile tech startups');
  const formatted1 = demo.formatForTelegram(result1);
  console.log(formatted1);

  console.log('\n═══════════════════════════════════════════════════════════════════\n');

  // Example 2: Market analysis
  console.log('📱 EXAMPLE 2: Market Analysis\n');
  console.log('Command: /webpost AI regulation trends\n');
  
  const result2 = await demo.run('AI regulation trends');
  const formatted2 = demo.formatForTelegram(result2);
  console.log(formatted2);

  console.log('\n═══════════════════════════════════════════════════════════════════\n');

  // Show raw result structure
  console.log('📊 RAW RESULT STRUCTURE\n');
  console.log(JSON.stringify(result1, null, 2));

  console.log('\n═══════════════════════════════════════════════════════════════════\n');
  console.log('✅ Demo complete!\n');
  console.log('This is exactly what you\'ll see in Telegram when using /webpost\n');
})();
