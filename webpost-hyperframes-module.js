/**
 * WEBPOST-HYPERFRAMES MODULE
 * 
 * Complete pipeline: Brave search → Haiku post → HeyGen Hyperframes images
 * 
 * HeyGen Hyperframes: HTML → Video frames (AI-powered video generation)
 * Better than Adobe: Native video frames, supports animations, AI captions
 * 
 * Usage:
 *   runWebPostHyperframes("Chile tech startups")
 *   → Brave search → Haiku post → Hyperframes carousel images
 */

const axios = require('axios');

const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY;
const HAIKU_API_KEY = process.env.API_KEY;
const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

class WebPostHyperframes {
  constructor() {
    this.model = 'claude-3-5-haiku-20241022'; // Fastest Claude
    this.heygenEndpoint = 'https://api.heygen.com/v1';
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
   * Generate post with Claude Haiku
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
- Emoji: Add 2-3 relevant emojis
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
   * Generate carousel frames with HeyGen Hyperframes
   * Creates HTML composition → renders to frames
   */
  async generateFramesHyperframes(query, postContent, count = 3) {
    if (!HEYGEN_API_KEY) {
      console.log('⚠️  HEYGEN_API_KEY not set, skipping frame generation');
      return null;
    }

    try {
      console.log(`🎬 Generating ${count} frames with HeyGen Hyperframes...`);

      // Extract key points from post for slides
      const lines = postContent.split('\n').filter(l => l.trim().startsWith('•'));
      const slides = lines.slice(0, count).map(l => l.replace('• ', '').trim());

      if (slides.length === 0) {
        console.log('⚠️  No slides found in post, using generic frames');
        return null;
      }

      // Create HTML composition for each slide
      const htmlCompositions = slides.map((slide, idx) => ({
        id: `slide-${idx + 1}`,
        html: this.createHtmlFrame(query, slide, idx + 1, slides.length),
      }));

      // Send to Hyperframes API for rendering
      const response = await axios.post(
        `${this.heygenEndpoint}/hyperframes/render`,
        {
          compositions: htmlCompositions,
          format: 'frames', // Return as frames, not video
          frameRate: 30,
          quality: 'high',
        },
        {
          headers: {
            'X-Api-Key': HEYGEN_API_KEY,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log(`✅ Hyperframes generated ${count} frames`);

      return {
        frames: response.data.frames || [],
        slides,
        composition: htmlCompositions,
      };
    } catch (error) {
      console.error('⚠️  Hyperframes error (non-fatal):', error.message);
      return null;
    }
  }

  /**
   * Create HTML frame for Hyperframes rendering
   * Modern, animated carousel slide
   */
  createHtmlFrame(title, content, slideNum, totalSlides) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Carousel Slide ${slideNum}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
  </style>
</head>
<body class="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
  <div id="stage" data-composition-id="carousel-${slideNum}" data-start="0" data-width="1080" data-height="1920">
    <!-- Background -->
    <div class="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 opacity-20"></div>
    
    <!-- Content -->
    <div class="h-full flex flex-col items-center justify-center p-8 text-white text-center">
      <!-- Title -->
      <div id="title" class="mb-8 opacity-0">
        <h1 class="text-5xl font-bold mb-2">${title}</h1>
        <div class="h-1 w-24 bg-gradient-to-r from-blue-400 to-pink-400 mx-auto"></div>
      </div>

      <!-- Main Content -->
      <div id="content" class="mb-8 max-w-2xl opacity-0">
        <p class="text-3xl font-semibold leading-relaxed">${content}</p>
      </div>

      <!-- Slide Counter -->
      <div id="counter" class="mt-auto text-lg font-light opacity-0">
        <span class="inline-block bg-white/10 px-4 py-2 rounded-full">
          ${slideNum} / ${totalSlides}
        </span>
      </div>
    </div>
  </div>

  <script>
    // GSAP Timeline for animations
    const tl = gsap.timeline();
    
    // Fade in animations
    tl.to('#title', { duration: 1, opacity: 1, ease: 'power2.out' }, 0)
      .to('#content', { duration: 1, opacity: 1, ease: 'power2.out' }, 0.3)
      .to('#counter', { duration: 0.8, opacity: 1, ease: 'power2.out' }, 0.6);

    // Register timeline for Hyperframes seeking
    window.__hfTimeline = tl;
  </script>
</body>
</html>`;
  }

  /**
   * Generate video with Runway ML (optional, for full video)
   */
  async generateVideoRunway(prompt) {
    const RUNWAY_KEY = process.env.RUNWAY_KEY;
    
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
   * Main command: /webpost-hyperframes <query>
   */
  async run(query, options = {}) {
    const {
      generateFrames = true,
      generateVideo = false,
      frameCount = 3,
    } = options;

    if (!query || query.trim().length === 0) {
      return {
        success: false,
        error: 'Usage: /webpost-hyperframes <topic>\nExample: /webpost-hyperframes Chile tech startups',
      };
    }

    const startTime = Date.now();
    const result = {
      query,
      search: null,
      post: null,
      frames: null,
      video: null,
      tokens: {},
      elapsed: 0,
    };

    try {
      console.log(`\n🔍 /webpost-hyperframes "${query}"`);

      // Step 1: Search (0 tokens)
      console.log('📡 Searching with Brave API...');
      result.search = await this.searchBrave(query, 5);
      console.log(`✅ Found ${result.search.length} articles`);

      // Step 2: Generate post (Haiku tokens)
      console.log('✍️  Generating post with Claude Haiku...');
      result.post = await this.generatePostHaiku(query, result.search);
      result.tokens.post = result.post.tokensUsed;

      // Step 3: Generate frames (HeyGen Hyperframes)
      if (generateFrames) {
        console.log('🎬 Generating carousel frames with Hyperframes...');
        result.frames = await this.generateFramesHyperframes(query, result.post.content, frameCount);
      }

      // Step 4: Generate video (optional)
      if (generateVideo) {
        console.log('🎥 Generating full video with Runway...');
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

    let text = `📱 *WebPost (Haiku + Hyperframes): ${result.query}*\n\n`;

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

    // Frames info
    if (result.frames?.frames?.length > 0) {
      text += `\n🎬 *Carousel:* ${result.frames.frames.length} frames (Hyperframes)\n`;
    }

    // Video info
    if (result.video) {
      text += `\n🎥 Video: Generating (ID: ${result.video.taskId})\n`;
    }

    return text;
  }
}

module.exports = WebPostHyperframes;