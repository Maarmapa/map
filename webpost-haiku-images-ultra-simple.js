/**
 * WEBPOST-HAIKU-IMAGES ULTRA SIMPLE (DEBUG VERSION)
 * No Brave, no frame rendering, just Haiku
 */

const axios = require('axios');

class WebPostHaikuImagesUltraSimple {
  constructor() {
    this.model = 'claude-3-5-haiku-20241022';
  }

  async generatePost(query) {
    const HAIKU_API_KEY = process.env.API_KEY;
    
    if (!HAIKU_API_KEY) {
      throw new Error('❌ API_KEY not set in environment');
    }

    const prompt = `Create a compelling Instagram post about: "${query}"

Include:
- Hook (first line that grabs attention)
- 3 key insights as bullet points
- CTA (call to action)
- 2-3 relevant emojis

Keep it max 250 words.`;

    try {
      console.log('📡 Calling Anthropic API (ultra-simple - no images)...');
      
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
          timeout: 30000, // 30 second timeout
        }
      );

      const content = response.data.content[0].text;
      const tokens = response.data.usage.input_tokens + response.data.usage.output_tokens;

      console.log('✅ Got response from Haiku');
      return {
        post: content,
        tokens,
      };
    } catch (error) {
      console.error('❌ API Error:', error.response?.status || error.message);
      if (error.response?.data) {
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  async run(query) {
    if (!query) {
      return { success: false, error: 'No query provided' };
    }

    try {
      console.log(`\n🔍 WebPost Haiku: "${query}"\n`);
      const result = await this.generatePost(query);
      return {
        success: true,
        query,
        post: result.post,
        tokens: result.tokens,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  formatForTelegram(result) {
    if (!result.success) {
      return `❌ Error: ${result.error}`;
    }

    let text = `📱 *WebPost: ${result.query}*\n\n`;
    text += `✍️ *Post:*\n${result.post}\n\n`;
    text += `📊 Tokens: ${result.tokens}`;
    return text;
  }
}

module.exports = WebPostHaikuImagesUltraSimple;
