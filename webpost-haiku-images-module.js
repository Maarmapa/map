/**
 * WEBPOST-HAIKU-IMAGES MODULE
 * 
 * Simple + Complete: Brave search → Haiku post → Haiku image prompts → SVG/HTML rendering
 * 
 * Generates images using Haiku itself (no external image APIs):
 * 1. Haiku creates compelling post
 * 2. Haiku generates image descriptions (prompts)
 * 3. Render as SVG/HTML carousel frames (deterministic)
 * 
 * Usage:
 *   runWebPostHaikuImages("Chile tech startups")
 *   → Brave search → Haiku post → Haiku image prompts → SVG carousel
 */

const axios = require('axios');

const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY;
const HAIKU_API_KEY = process.env.ANTHROPIC_API_KEY;

class WebPostHaikuImages {
  constructor() {
    this.model = 'claude-3-5-haiku-20241022'; // Fastest Claude
  }

  /**
   * Search articles with Brave API
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
   * Generate post + image prompts with Claude Haiku
   * Single API call for both
   */
  async generatePostAndImagePrompts(query, articles) {
    if (!HAIKU_API_KEY) {
      throw new Error('❌ ANTHROPIC_API_KEY not set');
    }

    const articlesToUse = articles.slice(0, 3);
    const sourcesText = articlesToUse
      .map((a, i) => `${i + 1}. "${a.title}" - ${a.description}`)
      .join('\n');

    const prompt = `Create an Instagram post + 3 image descriptions for: "${query}"

Based on these articles:
${sourcesText}

OUTPUT FORMAT (use exactly this format):

POST:
[Write a compelling Instagram post with hook, 3 insights, CTA, and 2-3 emojis. Max 250 words]

IMAGE-PROMPT-1:
[Description for first carousel slide image (vivid, visual, one sentence)]

IMAGE-PROMPT-2:
[Description for second carousel slide image (vivid, visual, one sentence)]

IMAGE-PROMPT-3:
[Description for third carousel slide image (vivid, visual, one sentence)]

Requirements:
- Post: Professional, conversational tone
- Image prompts: Visual, descriptive, single sentence each
- Style: Modern, professional, suitable for Instagram`;

    try {
      const startTime = Date.now();
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: this.model,
          max_tokens: 800,
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
      const fullContent = response.data.content?.[0]?.text || '';
      const tokensUsed = response.data.usage?.input_tokens + response.data.usage?.output_tokens;

      // Parse post and image prompts from response
      const parsed = this.parsePostAndPrompts(fullContent);

      console.log(`✅ Haiku post + image prompts generated (${tokensUsed} tokens, ${elapsed}ms)`);

      return {
        post: parsed.post,
        imagePrompts: parsed.imagePrompts,
        tokensUsed,
        model: this.model,
        elapsed,
        fullContent,
      };
    } catch (error) {
      console.error('❌ Haiku error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Parse Haiku response into post + image prompts
   */
  parsePostAndPrompts(content) {
    const postMatch = content.match(/POST:\s*\n([\s\S]*?)(?=\n\nIMAGE-PROMPT|$)/);
    const prompt1Match = content.match(/IMAGE-PROMPT-1:\s*\n([\s\S]*?)(?=\n\nIMAGE-PROMPT-2|$)/);
    const prompt2Match = content.match(/IMAGE-PROMPT-2:\s*\n([\s\S]*?)(?=\n\nIMAGE-PROMPT-3|$)/);
    const prompt3Match = content.match(/IMAGE-PROMPT-3:\s*\n([\s\S]*?)(?=\n\n|$)/);

    return {
      post: postMatch ? postMatch[1].trim() : content,
      imagePrompts: [
        prompt1Match ? prompt1Match[1].trim() : 'Modern professional design',
        prompt2Match ? prompt2Match[1].trim() : 'Contemporary business concept',
        prompt3Match ? prompt3Match[1].trim() : 'Innovation and growth visualization',
      ],
    };
  }

  /**
   * Create SVG carousel frames from image prompts
   * Deterministic rendering (no external APIs needed)
   */
  createSvgFrames(imagePrompts, postTitle) {
    return imagePrompts.map((prompt, idx) => {
      // Create a colorful SVG frame with text (deterministic, no API calls)
      const colors = [
        { bg: '#1e293b', accent: '#3b82f6' }, // dark blue
        { bg: '#1e1b4b', accent: '#8b5cf6' }, // dark purple
        { bg: '#0f172a', accent: '#ec4899' }, // dark pink
      ];

      const color = colors[idx];
      
      return {
        id: `frame-${idx + 1}`,
        svgData: `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1920" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad${idx}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${color.bg};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${color.accent};stop-opacity:0.1" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="1080" height="1920" fill="url(#grad${idx})" />
  
  <!-- Title -->
  <text x="540" y="200" font-size="56" font-weight="bold" fill="white" text-anchor="middle" font-family="Arial">
    ${postTitle.substring(0, 30)}...
  </text>
  
  <!-- Image description (visual placeholder) -->
  <circle cx="540" cy="900" r="300" fill="${color.accent}" opacity="0.3" />
  <circle cx="540" cy="900" r="280" fill="none" stroke="${color.accent}" stroke-width="2" opacity="0.6" />
  
  <!-- Content text -->
  <text x="540" y="1200" font-size="32" fill="white" text-anchor="middle" font-family="Arial" font-weight="500">
    ${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}
  </text>
  
  <!-- Counter -->
  <text x="540" y="1800" font-size="24" fill="${color.accent}" text-anchor="middle" font-family="Arial">
    ${idx + 1} / 3
  </text>
</svg>`,
        prompt,
      };
    });
  }

  /**
   * Generate HTML carousel (alternative to SVG, more stylish)
   */
  createHtmlCarouselFrames(imagePrompts, postTitle) {
    return imagePrompts.map((prompt, idx) => {
      const gradients = [
        'from-blue-600 to-purple-600',
        'from-purple-600 to-pink-600',
        'from-pink-600 to-orange-600',
      ];

      return {
        id: `carousel-${idx + 1}`,
        html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { margin: 0; padding: 0; }
    .carousel-frame { width: 1080px; height: 1920px; }
  </style>
</head>
<body class="bg-gradient-to-br ${gradients[idx]}">
  <div class="carousel-frame flex flex-col items-center justify-center text-white p-8">
    <!-- Title -->
    <h1 class="text-6xl font-bold mb-12 text-center leading-tight">
      ${postTitle.substring(0, 25)}
    </h1>

    <!-- Visual Area -->
    <div class="w-80 h-80 rounded-full border-4 border-white/30 flex items-center justify-center mb-12 bg-white/5">
      <div class="text-center px-6">
        <p class="text-2xl font-semibold">${prompt.substring(0, 40)}</p>
        <p class="text-lg mt-2 opacity-75">${prompt.substring(40, 80)}</p>
      </div>
    </div>

    <!-- Counter -->
    <div class="mt-auto bg-white/10 px-8 py-4 rounded-full">
      <p class="text-2xl font-light">${idx + 1} / 3</p>
    </div>
  </div>
</body>
</html>`,
        prompt,
      };
    });
  }

  /**
   * Main command: /webpost-haiku-images <query>
   */
  async run(query, options = {}) {
    const {
      imageFormat = 'html', // 'html' or 'svg'
      imageCount = 3,
    } = options;

    if (!query || query.trim().length === 0) {
      return {
        success: false,
        error: 'Usage: /webpost-haiku-images <topic>\nExample: /webpost-haiku-images Chile tech startups',
      };
    }

    const startTime = Date.now();
    const result = {
      query,
      search: null,
      post: null,
      imagePrompts: null,
      images: null,
      tokens: {},
      elapsed: 0,
    };

    try {
      console.log(`\n🔍 /webpost-haiku-images "${query}"`);

      // Step 1: Search (0 tokens)
      console.log('📡 Searching with Brave API...');
      result.search = await this.searchBrave(query, 5);
      console.log(`✅ Found ${result.search.length} articles`);

      // Step 2: Generate post + image prompts (Haiku tokens)
      console.log('✍️  Generating post + image prompts with Claude Haiku...');
      result.post = await this.generatePostAndImagePrompts(query, result.search);
      result.imagePrompts = result.post.imagePrompts;
      result.tokens.post = result.post.tokensUsed;

      // Step 3: Create carousel images (deterministic rendering, no API calls)
      console.log(`🎨 Generating ${imageCount} carousel frames...`);
      if (imageFormat === 'html') {
        result.images = this.createHtmlCarouselFrames(result.imagePrompts, query);
      } else {
        result.images = this.createSvgFrames(result.imagePrompts, query);
      }
      console.log(`✅ Generated ${result.images.length} frames`);

      // Summary
      result.elapsed = Date.now() - startTime;
      result.success = true;
      result.tokens.total = Object.values(result.tokens).reduce((a, b) => a + b, 0);

      console.log(`\n✅ Complete in ${result.elapsed}ms`);
      console.log(`📊 Tokens: ${result.tokens.total} (Haiku only)`);

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

    let text = `📱 *WebPost (Haiku + Images): ${result.query}*\n\n`;

    // Post content
    text += `✍️ *Post:*\n${result.post.post}\n\n`;

    // Sources
    text += `📚 *Sources:*\n`;
    result.search.slice(0, 2).forEach((article, i) => {
      text += `${i + 1}. [${article.title}](${article.url})\n`;
    });

    // Token info
    text += `\n📊 *Token Usage (Haiku ONLY):*\n`;
    text += `Haiku: ${result.post.tokensUsed} tokens\n`;
    text += `⏱️  Generated in ${(result.elapsed / 1000).toFixed(1)}s\n`;

    // Image info
    if (result.images?.length > 0) {
      text += `\n🎨 *Carousel:* ${result.images.length} HTML frames (deterministic)\n`;
      text += `• Frame 1: ${result.imagePrompts[0].substring(0, 40)}...\n`;
      text += `• Frame 2: ${result.imagePrompts[1].substring(0, 40)}...\n`;
      text += `• Frame 3: ${result.imagePrompts[2].substring(0, 40)}...\n`;
    }

    return text;
  }
}

module.exports = WebPostHaikuImages;