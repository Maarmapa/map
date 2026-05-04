// WEBPOST CAROUSEL + VIDEO MODULE v1
// /webpost-carousel <topic> — Web search → Extract best content → Generate carousel + Runway video
// Token usage: ~150 tokens OpenRouter (minimal DeepSeek), 0 Grok

const cheerio = require('cheerio');

class WebPostCarouselGenerator {
  constructor(options = {}) {
    this.openrouterKey = options.openrouterKey;
    this.anthropicKey = options.anthropicKey;
    this.grokKey = options.grokKey;
    this.runwayKey = options.runwayKey;
    this.telegramToken = options.telegramToken;
    this.r2Worker = options.r2Worker;
    this.currentTextModel = 'deepseek/deepseek-v4-flash';
    this.searchProvider = options.searchProvider || 'duckduckgo'; // 'duckduckgo' | 'anthropic'
    this.imageGenerator = options.imageGenerator || 'grok'; // 'grok' | 'anthropic' | 'webimages'
  }

  // ========== WEB SEARCH ==========
  
  // Option 1: DuckDuckGo (free, no tokens)
  async webSearchDuckDuckGo(query) {
    try {
      const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&t=h_&ia=web`;
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      };

      const response = await fetch(url, { headers });
      const html = await response.text();
      const $ = cheerio.load(html);

      let results = [];
      $('a[data-testid="result-title-a"]').each((i, el) => {
        if (results.length >= 15) return false;
        const title = $(el).text().trim();
        const link = $(el).attr('href');
        if (title && link) {
          results.push({ title, url: link, index: i + 1 });
        }
      });

      return results;
    } catch (e) {
      console.error('DuckDuckGo search error:', e.message);
      return [];
    }
  }

  // Option 2: Anthropic/Claude (uses tokens but more structured)
  async webSearchAnthropic(query) {
    if (!this.anthropicKey) return [];
    
    try {
      const prompt = `Search the web for: "${query}"
      
Return top 10 results as JSON:
[
  { "title": "...", "url": "...", "snippet": "..." },
  ...
]

ONLY JSON, no other text.`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.anthropicKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2048,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const data = await response.json();
      const text = data.content?.[0]?.text || '';
      
      try {
        return JSON.parse(text);
      } catch {
        return [];
      }
    } catch (e) {
      console.error('Anthropic search error:', e.message);
      return [];
    }
  }

  async webSearch(query) {
    return this.searchProvider === 'anthropic' 
      ? this.webSearchAnthropic(query)
      : this.webSearchDuckDuckGo(query);
  }

  // ========== CONTENT EXTRACTION ==========

  // Extraer imágenes + videos de una URL
  async extractMediaFromUrl(url) {
    try {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      };

      const response = await fetch(url, { headers, timeout: 10000 });
      if (!response.ok) return { images: [], videos: [] };

      const html = await response.text();
      const $ = cheerio.load(html);

      let images = [];
      let videos = [];

      // Extract images
      $('img').each((i, el) => {
        if (images.length >= 20) return false;
        const src = $(el).attr('src') || $(el).attr('data-src');
        const alt = $(el).attr('alt') || '';

        if (src && !src.includes('ad') && !src.includes('icon') && !src.includes('logo')) {
          images.push({
            url: src.startsWith('http') ? src : new URL(src, url).href,
            alt: alt.slice(0, 100),
            source: url
          });
        }
      });

      // Extract video sources
      $('video source, iframe[src*="youtube"], iframe[src*="vimeo"]').each((i, el) => {
        if (videos.length >= 5) return false;
        const src = $(el).attr('src');
        if (src) {
          videos.push({
            url: src,
            type: $(el).attr('type') || 'video/mp4',
            source: url
          });
        }
      });

      return { 
        images: images.slice(0, 15), 
        videos: videos.slice(0, 5) 
      };
    } catch (e) {
      console.error(`Media extraction error for ${url}:`, e.message);
      return { images: [], videos: [] };
    }
  }

  // ========== CONTENT SCORING & SELECTION ==========

  scoreImages(images, topic) {
    return images
      .map((img, idx) => ({
        ...img,
        score: (100 - idx * 5) + (img.alt.toLowerCase().includes(topic.toLowerCase()) ? 50 : 0)
      }))
      .sort((a, b) => b.score - a.score);
  }

  // ========== CAROUSEL GENERATION ==========

  async generateCarouselSlides(topic, searchResults, media) {
    if (!this.openrouterKey) return null;

    // Extraer top 5 resultados como contexto
    const context = searchResults
      .slice(0, 5)
      .map(r => `- ${r.title}`)
      .join('\n');

    const prompt = `Create 5 carousel slides for Instagram about: "${topic}"

Based on these sources:
${context}

Generate 5 slide texts (concise, impactful):
Slide 1: Hook/intro (max 80 chars)
Slide 2: Key insight #1 (max 120 chars)
Slide 3: Key insight #2 (max 120 chars)
Slide 4: Trend/analysis (max 120 chars)
Slide 5: CTA + hashtags (max 100 chars)

Format as JSON array:
[
  { "slide": 1, "text": "...", "emoji": "🎯" },
  ...
]

ONLY JSON, no other text.`;

    try {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openrouterKey}`,
          'HTTP-Referer': 'https://maarmapa.eth.limo'
        },
        body: JSON.stringify({
          model: this.currentTextModel,
          max_tokens: 800,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const data = await r.json();
      const text = data.choices?.[0]?.message?.content || '';

      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    } catch (e) {
      console.error('Carousel generation error:', e.message);
      return null;
    }
  }

  // ========== VIDEO GENERATION (Multiple Options) ==========

  // Option 1: Grok (Generate carousel images)
  async generateCarouselImagesWithGrok(topic, slides) {
    if (!this.grokKey) return [];

    const images = [];
    for (let i = 0; i < Math.min(5, slides.length); i++) {
      const slide = slides[i];
      const prompt = `Create a visually stunning carousel slide image for: "${slide.text}"
      Topic: ${topic}
      Style: Modern, professional, Instagram-ready (1080x1350 portrait)
      Include the slide text as overlay: "${slide.text.slice(0, 50)}..."`;

      try {
        const r = await fetch('https://api.x.ai/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.grokKey}`
          },
          body: JSON.stringify({
            model: 'grok-imagine-image',
            prompt,
            n: 1,
            response_format: 'url'
          })
        });

        const data = await r.json();
        if (data.data?.[0]?.url) {
          images.push({ slide: i + 1, url: data.data[0].url });
        }
      } catch (e) {
        console.log(`Grok image ${i + 1} failed:`, e.message);
      }
    }
    return images;
  }

  // Option 2: Anthropic (Generate carousel images)
  async generateCarouselImagesWithAnthropic(topic, slides) {
    if (!this.anthropicKey) return [];

    const images = [];
    // Anthropic doesn't have image generation, so we'd use their vision API
    // This is more of a text description generator
    // For image generation, use Grok instead
    return images;
  }

  // Option 3: Runway (Generate video from image)
  async generateRunwayVideo(imageUrl, prompt) {
    if (!this.runwayKey) return null;

    try {
      const r = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.runwayKey}`,
          'X-Runway-Version': '2024-11-06'
        },
        body: JSON.stringify({
          model: 'gen4_turbo',
          promptImage: imageUrl,
          promptText: prompt,
          ratio: '720:1280',
          duration: 5
        })
      });

      const d = await r.json();
      if (!d.id) return null;

      // Poll for completion
      for (let i = 0; i < 30; i++) {
        await new Promise(res => setTimeout(res, 10000));
        const t = await (await fetch(`https://api.dev.runwayml.com/v1/tasks/${d.id}`, {
          headers: {
            'Authorization': `Bearer ${this.runwayKey}`,
            'X-Runway-Version': '2024-11-06'
          }
        })).json();

        if (t.status === 'SUCCEEDED') return t.output?.[0] || null;
        if (t.status === 'FAILED') return null;
      }

      return null;
    } catch (e) {
      console.error('Runway video error:', e.message);
      return null;
    }
  }

  // ========== UPLOAD TO R2 ==========

  async uploadMediaToR2(buffer, filename, contentType = 'image/jpeg') {
    try {
      const r2Url = `${this.r2Worker}/${filename}`;
      const res = await fetch(r2Url, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: buffer
      });

      if (res.ok) {
        const data = await res.json();
        return data.url || r2Url;
      }
      return null;
    } catch (e) {
      console.error('R2 upload error:', e.message);
      return null;
    }
  }

  // ========== MAIN FLOW ==========

  async generateWebPostCarousel(topic, monitor = null) {
    const result = {
      topic,
      status: 'pending',
      searchResults: [],
      media: { images: [], videos: [] },
      selectedImages: [],
      slides: [],
      videoUrl: null,
      r2Urls: [],
      tokensUsed: {}
    };

    try {
      // STEP 1: Web search
      console.log('🔍 Web search...');
      result.searchResults = await this.webSearch(topic);
      if (!result.searchResults.length) {
        result.status = 'error: no search results';
        return result;
      }

      // STEP 2: Extract media from top 5 results
      console.log('📸 Extracting media...');
      const mediaPromises = result.searchResults.slice(0, 5).map(r =>
        this.extractMediaFromUrl(r.url)
      );
      const allMedia = await Promise.all(mediaPromises);

      result.media.images = allMedia.flatMap(m => m.images);
      result.media.videos = allMedia.flatMap(m => m.videos);

      if (!result.media.images.length) {
        result.status = 'error: no images found';
        return result;
      }

      // STEP 3: Generate carousel slides (uses ~200 tokens OpenRouter)
      console.log('📝 Generating carousel...');
      result.slides = await this.generateCarouselSlides(topic, result.searchResults, result.media);

      // STEP 4: Select images (Grok-generated OR web-extracted)
      console.log('🖼️ Selecting carousel images...');
      
      if (this.imageGenerator === 'grok' && this.grokKey && result.slides) {
        // Generate images with Grok
        console.log('🎨 Generating carousel images with Grok...');
        const grokImages = await this.generateCarouselImagesWithGrok(topic, result.slides);
        result.selectedImages = grokImages.map(img => ({ url: img.url, alt: `Slide ${img.slide}` }));
        result.tokensUsed.grok = 50 * Math.min(5, result.slides.length);
      } else {
        // Use web-extracted images (already scored)
        const scored = this.scoreImages(result.media.images, topic);
        result.selectedImages = scored.slice(0, 5);
        result.tokensUsed.grok = 0;
      }

      // STEP 5: Generate video from best image (uses ~100 tokens Runway)
      if (result.selectedImages.length > 0) {
        console.log('🎬 Generating video with Runway...');
        const bestImage = result.selectedImages[0];
        const videoPrompt = `Create a dynamic, engaging video intro for: "${topic}". 
        Professional, modern, with subtle animations. Perfect for Instagram Reels.`;

        result.videoUrl = await this.generateRunwayVideo(bestImage.url, videoPrompt);
      }

      // STEP 6: Upload images to R2
      console.log('📤 Uploading to R2...');
      for (let i = 0; i < result.selectedImages.length; i++) {
        const img = result.selectedImages[i];
        try {
          const imgResponse = await fetch(img.url, { timeout: 15000 });
          if (imgResponse.ok) {
            const buffer = await imgResponse.buffer();
            const filename = `carousel/${topic.replace(/\s+/g, '-').toLowerCase()}-${i + 1}-${Date.now()}.jpg`;
            const r2Url = await this.uploadMediaToR2(buffer, filename);
            if (r2Url) result.r2Urls.push(r2Url);
          }
        } catch (e) {
          console.log(`Image ${i + 1} upload failed:`, e.message);
        }
      }

      // STEP 7: Track tokens
      result.tokensUsed.openrouter = 200; // carousel text generation
      if (monitor) {
        await monitor.trackUsage('openrouter', 200, `/webpost-carousel ${topic}`);
        if (result.tokensUsed.grok > 0) {
          await monitor.trackUsage('grok', result.tokensUsed.grok, `/webpost-carousel ${topic}`);
        }
      }

      result.status = 'success';
      return result;
    } catch (e) {
      result.status = `error: ${e.message}`;
      return result;
    }
  }
}

module.exports = WebPostCarouselGenerator;
