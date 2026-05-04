/**
 * WEBPOST-HAIKU-IMAGES SIMPLE (FIXED)
 * 
 * Brave search + Haiku post + Haiku image prompts (NO frames rendering)
 * Fast, simple, works instantly
 */

const axios = require('axios');

const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY;
const HAIKU_API_KEY = process.env.API_KEY;

class WebPostHaikuImagesSimple {
  constructor() {
    this.model = 'claude-haiku-4-5';
  }

  async searchBrave(query, count = 5) {
    if (!BRAVE_API_KEY) {
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
      console.error('❌ Brave search error:', error.response?.status || error.message);
      console.error('   Details:', error.response?.data || error.message);
      return this.mockSearch(query);
    }
  }

  mockSearch(query) {
    return [
      {
        title: `${query} - Latest Developments`,
        description: `Recent updates and innovations in ${query}.`,
        url: `https://example.com/${query.replace(/\s+/g, '-')}`,
      },
      {
        title: `Market Analysis: ${query}`,
        description: `Deep dive into current trends affecting ${query}.`,
        url: `https://example.com/analysis`,
      },
      {
        title: `${query}: What's Next?`,
        description: `Expert predictions on future direction.`,
        url: `https://example.com/predictions`,
      },
    ];
  }

  async generatePostAndImagePrompts(query, articles) {
    if (!HAIKU_API_KEY) {
      throw new Error('❌ API_KEY not set');
    }

    const articlesToUse = articles.slice(0, 3);
    const sourcesText = articlesToUse
      .map((a, i) => `${i + 1}. "${a.title}" - ${a.description}`)
      .join('\n');

    const prompt = `Create an Instagram post + 3 image descriptions for: "${query}"

Based on these articles:
${sourcesText}

OUTPUT (use exactly this format):

POST:
[Write a compelling Instagram post with hook, 3 insights, CTA, emojis. Max 250 words]

IMAGE-PROMPT-1:
[First carousel slide description - one sentence, visual]

IMAGE-PROMPT-2:
[Second carousel slide description - one sentence, visual]

IMAGE-PROMPT-3:
[Third carousel slide description - one sentence, visual]`;

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

      // Parse post and image prompts
      const parsed = this.parsePostAndPrompts(fullContent);

      console.log(`✅ Haiku post + image prompts (${tokensUsed} tokens, ${elapsed}ms)`);

      return {
        post: parsed.post,
        imagePrompts: parsed.imagePrompts,
        tokensUsed,
        model: this.model,
        elapsed,
      };
    } catch (error) {
      console.error('❌ Haiku error:', error.response?.status || error.message);
      console.error('   Details:', error.response?.data || error.message);
      throw error;
    }
  }

  parsePostAndPrompts(content) {
    const postMatch = content.match(/POST:\s*\n([\s\S]*?)(?=\n\nIMAGE-PROMPT|$)/);
    const prompt1Match = content.match(/IMAGE-PROMPT-1:\s*\n([\s\S]*?)(?=\n\nIMAGE-PROMPT-2|$)/);
    const prompt2Match = content.match(/IMAGE-PROMPT-2:\s*\n([\s\S]*?)(?=\n\nIMAGE-PROMPT-3|$)/);
    const prompt3Match = content.match(/IMAGE-PROMPT-3:\s*\n([\s\S]*?)(?=\n\n|$)/);

    return {
      post: postMatch ? postMatch[1].trim() : content,
      imagePrompts: [
        prompt1Match ? prompt1Match[1].trim() : 'Modern design',
        prompt2Match ? prompt2Match[1].trim() : 'Professional concept',
        prompt3Match ? prompt3Match[1].trim() : 'Future vision',
      ],
    };
  }

  async run(query) {
    if (!query || query.trim().length === 0) {
      return {
        success: false,
        error: 'Usage: /webpost-haiku-images <topic>',
      };
    }

    const startTime = Date.now();
    const result = {
      query,
      search: null,
      post: null,
      imagePrompts: null,
      tokens: {},
      elapsed: 0,
    };

    try {
      console.log(`\n🔍 /webpost-haiku-images "${query}"`);

      console.log('📡 Searching...');
      result.search = await this.searchBrave(query, 5);

      console.log('✍️  Generating post + image prompts...');
      result.post = await this.generatePostAndImagePrompts(query, result.search);
      result.imagePrompts = result.post.imagePrompts;
      result.tokens.post = result.post.tokensUsed;

      result.elapsed = Date.now() - startTime;
      result.success = true;
      result.tokens.total = result.tokens.post;

      console.log(`✅ Complete in ${result.elapsed}ms`);

      return result;
    } catch (error) {
      result.success = false;
      result.error = error.message;
      console.error('❌ Error:', error.message);
      return result;
    }
  }

  formatForTelegram(result) {
    if (!result.success) {
      return `❌ Error: ${result.error}`;
    }

    let text = `📱 *WebPost (Haiku): ${result.query}*\n\n`;

    // Post
    text += `✍️ *Post:*\n${result.post.post}\n\n`;

    // Sources
    text += `📚 *Sources:*\n`;
    result.search.slice(0, 2).forEach((article, i) => {
      text += `${i + 1}. [${article.title.substring(0, 50)}...](${article.url})\n`;
    });

    // Image prompts
    text += `\n🎨 *Image Prompts (for carousel):*\n`;
    result.imagePrompts.forEach((prompt, i) => {
      text += `${i + 1}. ${prompt.substring(0, 60)}...\n`;
    });

    // Stats
    text += `\n📊 *Token Usage:*\n`;
    text += `Haiku: ${result.post.tokensUsed} tokens\n`;
    text += `⏱️  Generated in ${(result.elapsed / 1000).toFixed(1)}s`;

    return text;
  }
}

module.exports = WebPostHaikuImagesSimple;
