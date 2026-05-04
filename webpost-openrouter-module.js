/**
 * WEBPOST-OPENROUTER MODULE
 * 
 * Simple, clean /webpost command:
 * - Search: Brave (0 tokens) or Claude Haiku (minimal tokens)
 * - Post generation: OpenRouter (Llama, Mixtral, etc.)
 * - Video: Runway ML
 * 
 * NO GROK, NO DEEPSEEK
 * 
 * Usage:
 *   runWebPostOpenRouter("Chile tech startups")
 *   → Brave search → OpenRouter post → Runway video
 */

const axios = require('axios');
const TokenMonitor = require('./token-monitor.js');

const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const RUNWAY_API_KEY = process.env.RUNWAY_API_KEY;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY;
const R2_SECRET_KEY = process.env.R2_SECRET_KEY;
const R2_BUCKET = process.env.R2_BUCKET || 'maarmapa-content';

class WebPostOpenRouter {
  constructor() {
    try {
      this.tokenMonitor = new TokenMonitor();
    } catch (e) {
      console.log('⚠️  TokenMonitor not available, tracking disabled');
      this.tokenMonitor = null;
    }
  }

  /**
   * Search articles with Brave API (0 tokens)
   * Returns: Array of { title, description, url, snippet }
   */
  async searchBrave(query, count = 5) {
    if (!BRAVE_API_KEY) {
      console.log('⚠️  BRAVE_SEARCH_API_KEY not set, using mock search');
      return this.mockSearch(query);
    }

    try {
      const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
        params: {
          q: query,
          count: Math.min(count, 10),
        },
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': BRAVE_API_KEY,
        },
      });

      const results = response.data.web || [];
      return results.map(r => ({
        title: r.title,
        description: r.description,
        url: r.url,
        snippet: r.page_age ? `${r.page_age} ago` : 'recent',
      }));
    } catch (error) {
      console.error('❌ Brave search error:', error.message);
      return this.mockSearch(query);
    }
  }

  /**
   * Mock search for testing (0 tokens, 0 API calls)
   */
  mockSearch(query) {
    return [
      {
        title: `${query} - Breaking News`,
        description: `Latest developments in ${query}. Industry leaders share insights and predictions.`,
        url: `https://example.com/${query.replace(/\s+/g, '-')}`,
        snippet: '2 hours ago',
      },
      {
        title: `Analysis: ${query} Market Trends`,
        description: `Deep dive into current market dynamics affecting ${query}.`,
        url: `https://example.com/analysis-${query.replace(/\s+/g, '-')}`,
        snippet: '4 hours ago',
      },
      {
        title: `${query} Leaders Announce New Initiative`,
        description: `Major developments as industry moves forward with innovation.`,
        url: `https://example.com/initiative-${query.replace(/\s+/g, '-')}`,
        snippet: '6 hours ago',
      },
    ];
  }

  /**
   * Generate post with OpenRouter
   * Uses cheaper models (Llama 2, Mixtral, etc.)
   */
  async generatePostOpenRouter(query, articles) {
    if (!OPENROUTER_API_KEY) {
      throw new Error('❌ OPENROUTER_API_KEY not set');
    }

    const articlesToUse = articles.slice(0, 3);
    const sourcesText = articlesToUse
      .map((a, i) => `${i + 1}. "${a.title}" - ${a.description}`)
      .join('\n');

    const prompt = `Create a compelling Instagram post about: "${query}"

Based on these articles:
${sourcesText}

Requirements:
- Hook: First line must grab attention (max 15 words)
- Body: 3-4 key insights, conversational tone
- Call-to-action: Ask a question or invite engagement
- Emoji: Add 2-3 relevant emojis
- Format: Mobile-friendly (max 3 sentences per section)
- Tone: Professional but conversational

Output ONLY the post text, no hashtags, no titles.`;

    try {
      const startTime = Date.now();
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: 'meta-llama/llama-2-70b-chat', // Cheaper, fast
          messages: [
            {
              role: 'system',
              content: 'You are an expert social media copywriter. Write engaging, authentic posts.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.8,
          max_tokens: 500,
        },
        {
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'https://maarmapa.eth',
            'X-Title': 'maarmapa-bot',
          },
        }
      );

      const elapsed = Date.now() - startTime;
      const content = response.data.choices?.[0]?.message?.content || '';
      const tokensUsed = response.data.usage?.total_tokens || 0;

      // Track tokens
      if (this.tokenMonitor) {
        this.tokenMonitor.trackUsage('openrouter', tokensUsed, 'webpost-post', true);
      }

      console.log(`✅ OpenRouter post generated (${tokensUsed} tokens, ${elapsed}ms)`);

      return {
        content,
        tokensUsed,
        model: 'meta-llama/llama-2-70b-chat',
        elapsed,
      };
    } catch (error) {
      console.error('❌ OpenRouter error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Generate video with Runway ML
   */
  async generateVideoRunway(prompt) {
    if (!RUNWAY_API_KEY) {
      console.log('⚠️  RUNWAY_API_KEY not set, skipping video generation');
      return null;
    }

    try {
      const response = await axios.post(
        'https://api.runwayml.com/v1/video/generate',
        {
          prompt: prompt.substring(0, 150), // Runway limit
          duration: 8, // 8-second video
          width: 1080,
          height: 1920, // Mobile format
        },
        {
          headers: {
            'Authorization': `Bearer ${RUNWAY_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('✅ Runway video request sent');
      return {
        taskId: response.data.task_id,
        status: 'queued',
      };
    } catch (error) {
      console.error('⚠️  Runway error (non-fatal):', error.message);
      return null; // Don't fail the whole command
    }
  }

  /**
   * Main command: /webpost <query>
   */
  async run(query) {
    if (!query || query.trim().length === 0) {
      return {
        success: false,
        error: 'Usage: /webpost <topic>\nExample: /webpost Chile tech startups',
      };
    }

    const startTime = Date.now();
    const result = {
      query,
      search: null,
      post: null,
      video: null,
      tokens: {},
      elapsed: 0,
    };

    try {
      console.log(`\n🔍 /webpost "${query}"`);

      // Step 1: Search (0 tokens)
      console.log('📡 Searching with Brave API...');
      result.search = await this.searchBrave(query, 5);
      console.log(`✅ Found ${result.search.length} articles`);

      // Step 2: Generate post (OpenRouter tokens)
      console.log('✍️  Generating post with OpenRouter...');
      result.post = await this.generatePostOpenRouter(query, result.search);
      result.tokens.post = result.post.tokensUsed;

      // Step 3: Generate video (Runway)
      console.log('🎬 Generating video with Runway...');
      const videoPrompt = `${query}: ${result.post.content.substring(0, 100)}`;
      result.video = await this.generateVideoRunway(videoPrompt);

      // Summary
      result.elapsed = Date.now() - startTime;
      result.success = true;
      result.tokens.total = Object.values(result.tokens).reduce((a, b) => a + b, 0);

      console.log(`\n✅ Complete in ${result.elapsed}ms`);
      console.log(`📊 Tokens: ${result.tokens.total} (OpenRouter)`);

      return result;
    } catch (error) {
      result.success = false;
      result.error = error.message;
      console.error('❌ Error:', error.message);
      return result;
    }
  }

  /**
   * Format for Telegram output
   */
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

module.exports = WebPostOpenRouter;
