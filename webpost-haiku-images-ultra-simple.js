/**
 * WEBPOST-HAIKU-IMAGES ULTRA SIMPLE (DEBUG VERSION)
 * No Brave, no frame rendering, just Haiku
 */

const axios = require('axios');

const RUNWAY_KEY = process.env.RUNWAY_KEY;

class WebPostHaikuImagesUltraSimple {
  constructor() {
    this.model = 'claude-haiku-4-5';
  }

  async generateImageWithRunway(prompt) {
    if (!RUNWAY_KEY) {
      console.log('⚠️  RUNWAY_KEY not set, skipping image');
      return null;
    }

    try {
      console.log('🎨 Generating image with Runway...');
      const response = await axios.post(
        'https://api.dev.runwayml.com/v1/text_to_image',
        {
          prompt: prompt.substring(0, 200),
          num_images: 1,
          guidance_scale: 7.5,
          height: 1920,
          width: 1080,
        },
        {
          headers: {
            'Authorization': `Bearer ${RUNWAY_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        }
      );

      console.log('✅ Runway image generated');
      return response.data.images?.[0] || null;
    } catch (error) {
      console.error('⚠️  Runway error (non-fatal):', error.message);
      return null;
    }
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
      
      // Generate 1 image with Runway
      const imageUrl = await this.generateImageWithRunway(`Instagram carousel: ${query}`);
      
      return {
        success: true,
        query,
        post: result.post,
        tokens: result.tokens,
        image: imageUrl,
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
    
    if (result.image) {
      text += `\n\n🎨 *Image:* [Generated with Runway]`;
      text += `\n${result.image}`;
    }
    
    return text;
  }
}

module.exports = WebPostHaikuImagesUltraSimple;
