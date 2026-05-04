/**
 * WEBPOST-HAIKU-ADOBE-MCP MODULE
 * 
 * Search + Post + Images, all in-house via MCP + Haiku:
 * - Search: Brave API (0 tokens) or Haiku (minimal tokens)
 * - Post generation: Claude Haiku (cheap, fast)
 * - Images: Adobe Creative API (via MCP) or Affinity AI
 * - No OpenRouter, No Grok, No DeepSeek
 * 
 * MCPs used:
 * - adobe-creative-mcp: Design, generate images, edit
 * - haiku-search: Web search (optional, if Brave unavailable)
 * 
 * Usage:
 *   runWebPostHaikuAdobe("Chile tech startups", { generateImages: true })
 *   → Brave search → Haiku post → Adobe Creative images → Runway video
 */

const axios = require('axios');

const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY;
const HAIKU_API_KEY = process.env.API_KEY;
const ADOBE_CLIENT_ID = process.env.ADOBE_CLIENT_ID;
const ADOBE_CLIENT_SECRET = process.env.ADOBE_CLIENT_SECRET;
const ADOBE_ACCESS_TOKEN = process.env.ADOBE_ACCESS_TOKEN;
const RUNWAY_KEY = process.env.RUNWAY_KEY;

class WebPostHaikuAdobeMCP {
  constructor() {
    this.model = 'claude-3-5-haiku-20241022'; // Fastest + cheapest
    this.mcpEndpoint = process.env.MCP_ENDPOINT || 'http://localhost:3000/mcp';
    this.adobeSession = null;
  }

  /**
   * Search articles with Brave API
   * Returns: Array of { title, description, url }
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
      }));
    } catch (error) {
      console.error('❌ Brave search error:', error.message);
      return this.mockSearch(query);
    }
  }

  /**
   * Mock search for testing
   */
  mockSearch(query) {
    return [
      {
        title: `${query} - Latest Developments`,
        description: `Recent updates and innovations in ${query}. Industry leaders share insights.`,
        url: `https://example.com/${query.replace(/\s+/g, '-')}`,
      },
      {
        title: `Market Analysis: ${query} Trends 2026`,
        description: `Deep dive into current market dynamics affecting ${query}.`,
        url: `https://example.com/analysis`,
      },
      {
        title: `${query}: What's Next?`,
        description: `Expert predictions on future direction and innovation.`,
        url: `https://example.com/predictions`,
      },
    ];
  }

  /**
   * Generate post with Claude Haiku (minimal tokens)
   */
  async generatePostHaiku(query, articles) {
    if (!HAIKU_API_KEY) {
      throw new Error('❌ ANTHROPIC_API_KEY not set');
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
- Body: 3 key insights, conversational tone
- CTA: Ask a question to invite engagement
- Emoji: Add 2-3 relevant emojis (max)
- Format: Mobile-friendly (short paragraphs)
- Tone: Professional but conversational
- Length: Max 250 words

Output ONLY the post text, no hashtags, no titles.`;

    try {
      const startTime = Date.now();
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: this.model,
          max_tokens: 400,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        },
        {
          headers: {
            'x-api-key': HAIKU_API_KEY,
            'anthropic-version': '2023-06-01',
          },
        }
      );

      const elapsed = Date.now() - startTime;
      const content = response.data.content?.[0]?.text || '';
      const tokensUsed = response.data.usage?.input_tokens + response.data.usage?.output_tokens;

      console.log(`✅ Haiku post generated (${tokensUsed} tokens, ${elapsed}ms)`);

      return {
        content,
        tokensUsed,
        model: this.model,
        elapsed,
      };
    } catch (error) {
      console.error('❌ Haiku error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Generate images with Adobe Creative (via MCP)
   * Requires: adobe-creative-mcp configured
   */
  async generateImagesAdobe(prompt, count = 3) {
    if (!ADOBE_ACCESS_TOKEN) {
      console.log('⚠️  ADOBE_ACCESS_TOKEN not set, skipping image generation');
      return null;
    }

    try {
      console.log(`🎨 Requesting ${count} images from Adobe Creative...`);

      // Call Adobe Creative API via MCP
      const response = await axios.post(
        `${this.mcpEndpoint}/adobe/generate-images`,
        {
          prompt: prompt.substring(0, 200),
          numImages: count,
          style: 'modern',
          size: '1080x1080',
        },
        {
          headers: {
            'Authorization': `Bearer ${ADOBE_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log(`✅ Adobe generated ${count} images`);

      return {
        images: response.data.images || [],
        prompt,
        count,
      };
    } catch (error) {
      console.error('⚠️  Adobe error (non-fatal):', error.message);
      return null; // Don't fail the whole command
    }
  }

  /**
   * Generate carousel with images (for Instagram)
   */
  async generateCarouselAdobe(postContent, imageCount = 3) {
    // Extract 3-4 key points from post for carousel slides
    const lines = postContent.split('\n').filter(l => l.trim().startsWith('•'));
    const slides = lines.slice(0, imageCount);

    if (slides.length === 0) {
      console.log('⚠️  No carousel slides found in post');
      return null;
    }

    try {
      const carouselPrompt = `Create a modern carousel design for Instagram about: "${slides[0]}"
Style: Minimal, professional, modern typography
Colors: Dark background with accent colors
Text: "${slides[0]}" centered, large text`;

      const images = await this.generateImagesAdobe(carouselPrompt, imageCount);
      return images;
    } catch (error) {
      console.error('⚠️  Carousel generation failed:', error.message);
      return null;
    }
  }

  /**
   * Generate video with Runway ML (async)
   */
  async generateVideoRunway(prompt) {
    if (!RUNWAY_KEY) {
      console.log('⚠️  RUNWAY_KEY not set, skipping video generation');
      return null;
    }

    try {
      const response = await axios.post(
        'https://api.runwayml.com/v1/video/generate',
        {
          prompt: prompt.substring(0, 150),
          duration: 8,
          width: 1080,
          height: 1920,
        },
        {
          headers: {
            'Authorization': `Bearer ${RUNWAY_KEY}`,
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
      return null;
    }
  }

  /**
   * Main command: /webpost-adobe <query>
   */
  async run(query, options = {}) {
    const {
      generateImages = true,
      generateVideo = true,
      imageCount = 3,
    } = options;

    if (!query || query.trim().length === 0) {
      return {
        success: false,
        error: 'Usage: /webpost-adobe <topic>\nExample: /webpost-adobe Chile tech startups',
      };
    }

    const startTime = Date.now();
    const result = {
      query,
      search: null,
      post: null,
      images: null,
      video: null,
      tokens: {},
      elapsed: 0,
    };

    try {
      console.log(`\n🔍 /webpost-adobe "${query}"`);

      // Step 1: Search (0 tokens)
      console.log('📡 Searching with Brave API...');
      result.search = await this.searchBrave(query, 5);
      console.log(`✅ Found ${result.search.length} articles`);

      // Step 2: Generate post (Haiku tokens)
      console.log('✍️  Generating post with Claude Haiku...');
      result.post = await this.generatePostHaiku(query, result.search);
      result.tokens.post = result.post.tokensUsed;

      // Step 3: Generate images (Adobe, async preferred)
      if (generateImages) {
        console.log('🎨 Generating carousel images with Adobe Creative...');
        result.images = await this.generateCarouselAdobe(result.post.content, imageCount);
      }

      // Step 4: Generate video (Runway)
      if (generateVideo) {
        console.log('🎬 Generating video with Runway...');
        const videoPrompt = `${query}: ${result.post.content.substring(0, 100)}`;
        result.video = await this.generateVideoRunway(videoPrompt);
      }

      // Summary
      result.elapsed = Date.now() - startTime;
      result.success = true;
      result.tokens.total = Object.values(result.tokens).reduce((a, b) => a + b, 0);

      console.log(`\n✅ Complete in ${result.elapsed}ms`);
      console.log(`📊 Tokens: ${result.tokens.total} (Haiku)`);

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

    let text = `📱 *WebPost (Haiku + Adobe): ${result.query}*\n\n`;

    // Post content
    text += `✍️ *Post:*\n${result.post.content}\n\n`;

    // Sources
    text += `📚 *Sources:*\n`;
    result.search.slice(0, 2).forEach((article, i) => {
      text += `${i + 1}. [${article.title}](${article.url})\n`;
    });

    // Token info
    text += `\n📊 *Token Usage (Haiku):*\n`;
    text += `Haiku: ${result.post.tokensUsed} tokens\n`;
    text += `⏱️  Generated in ${(result.elapsed / 1000).toFixed(1)}s\n`;

    // Images info
    if (result.images?.images?.length > 0) {
      text += `\n🎨 *Carousel:* ${result.images.images.length} images\n`;
    }

    // Video info
    if (result.video) {
      text += `\n🎬 Video: Generating (ID: ${result.video.taskId})\n`;
    }

    return text;
  }
}

module.exports = WebPostHaikuAdobeMCP;
