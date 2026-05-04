// WEBPOST MODULE v1 — Web Search + Image Extraction + No Grok
// Comando: /webpost <topic> — busca web, extrae imágenes, genera post

const cheerio = require('cheerio');

class WebPostGenerator {
  constructor(openrouterKey, telegramToken, r2Worker) {
    this.openrouterKey = openrouterKey;
    this.telegramToken = telegramToken;
    this.r2Worker = r2Worker;
    this.currentTextModel = 'deepseek/deepseek-v4-flash';
  }

  // 1. Web search usando Grokpedia (X.AI search API)
  async webSearch(query) {
    try {
      // Usar Grokpedia (X.AI search, no requiere tokens de imagen)
      if (!process.env.GROK_KEY) {
        throw new Error('GROK_KEY not configured');
      }

      const response = await fetch('https://api.x.ai/v1/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROK_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: query,
          max_results: 10,
          search_depth: 'basic'
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Grokpedia error:', error);
        throw new Error('Grokpedia search failed');
      }

      const data = await response.json();
      let results = [];

      if (data.results && Array.isArray(data.results)) {
        results = data.results.map((item, idx) => ({
          title: item.title || 'Untitled',
          url: item.url || '#',
          snippet: item.content || item.snippet || '',
          index: idx + 1
        }));
      }

      if (results.length === 0) {
        throw new Error('No search results from Grokpedia');
      }

      return results.slice(0, 10);
    } catch (e) {
      console.error('Grokpedia search error:', e.message);
      // Fallback a Wikipedia si Grok falla
      try {
        const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&srsearch=${encodeURIComponent(query)}&list=search`;
        const wikiResponse = await fetch(wikiUrl);
        const wikiData = await wikiResponse.json();
        
        if (wikiData.query?.search && wikiData.query.search.length > 0) {
          return wikiData.query.search.slice(0, 10).map((item, idx) => ({
            title: item.title,
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title)}`,
            snippet: item.snippet.replace(/<[^>]*>/g, '').slice(0, 150),
            index: idx + 1
          }));
        }
      } catch (wikiError) {
        console.log('Wikipedia fallback also failed');
      }
      
      // Last resort
      return [
        {
          title: `${query} - Google Search`,
          url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
          index: 1
        }
      ];
    }
  }

  // 2. Extraer imágenes de una URL
  async extractImagesFromUrl(url) {
    try {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      };

      const response = await fetch(url, { headers, timeout: 10000 });
      if (!response.ok) return [];

      const html = await response.text();
      const $ = cheerio.load(html);

      let images = [];
      
      // Buscar imágenes en <img> tags
      $('img').each((i, el) => {
        if (images.length >= 15) return false;
        
        const src = $(el).attr('src') || $(el).attr('data-src');
        const alt = $(el).attr('alt') || '';
        
        if (src && (src.includes('http') || src.startsWith('/'))) {
          // Filtrar imágenes pequeñas o ads
          if (!src.includes('ad') && !src.includes('icon') && !src.includes('logo')) {
            images.push({
              url: src.startsWith('http') ? src : new URL(src, url).href,
              alt: alt.slice(0, 100),
              source: url
            });
          }
        }
      });

      return images.slice(0, 10); // Top 10
    } catch (e) {
      console.error(`Image extraction error for ${url}:`, e.message);
      return [];
    }
  }

  // 3. Score imágenes por relevancia
  scoreImages(images, searchTopic) {
    return images.map((img, idx) => {
      let score = 100 - (idx * 5); // Posición matters
      
      // Bonus si alt text contiene keywords
      if (img.alt.toLowerCase().includes(searchTopic.toLowerCase())) {
        score += 50;
      }
      
      // Penalidad si se ve como logo/icon
      if (img.alt.toLowerCase().includes('logo') || img.alt.toLowerCase().includes('icon')) {
        score -= 30;
      }
      
      return { ...img, score };
    }).sort((a, b) => b.score - a.score);
  }

  // 4. Generar narrativa con DeepSeek
  async generateNarrative(topic, searchResults) {
    if (!this.openrouterKey) return null;

    const sources = searchResults.slice(0, 5).map(r => `- ${r.title}`).join('\n');
    
    const prompt = `Escribe un post de Instagram IMPACTANTE y conciso sobre: "${topic}"

Basado en:
${sources}

Requisitos:
- Max 220 caracteres
- Tono: profesional pero creativo
- Include 3-4 hashtags relevantes
- Emoji al inicio
- Call-to-action subtle
- NO repetir "post" o "contenido"

SOLO EL POST, nada más.`;

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
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const data = await r.json();
      return data.choices?.[0]?.message?.content || null;
    } catch (e) {
      console.error('DeepSeek narrative error:', e.message);
      return null;
    }
  }

  // 5. Descargar y subir imagen a R2
  async uploadImageToR2(imageUrl, filename) {
    try {
      const imgResponse = await fetch(imageUrl, { timeout: 15000 });
      if (!imgResponse.ok) return null;

      const buffer = await imgResponse.buffer();
      
      const r2Url = `${this.r2Worker}/posts/${filename}`;
      const uploadRes = await fetch(r2Url, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: buffer
      });

      if (uploadRes.ok) {
        const data = await uploadRes.json();
        return data.url || r2Url;
      }
      return null;
    } catch (e) {
      console.error('Image upload error:', e.message);
      return null;
    }
  }

  // 6. Generar post completo
  async generateWebPost(topic, monitor = null) {
    const result = {
      topic,
      searchResults: [],
      images: [],
      topImages: [],
      narrative: null,
      r2Urls: [],
      status: 'pending',
      tokensUsed: {}
    };

    try {
      // PASO 1: Web search
      result.searchResults = await this.webSearch(topic);
      if (!result.searchResults.length) {
        result.status = 'error: no search results';
        return result;
      }

      // PASO 2: Extraer imágenes de top 5 resultados
      const imagePromises = result.searchResults.slice(0, 5).map(r =>
        this.extractImagesFromUrl(r.url)
      );
      const allImages = await Promise.all(imagePromises);
      result.images = allImages.flat();

      if (!result.images.length) {
        result.status = 'error: no images found';
        return result;
      }

      // PASO 3: Score y seleccionar top 5 imágenes
      const scored = this.scoreImages(result.images, topic);
      result.topImages = scored.slice(0, 5);

      // PASO 4: Generar narrativa
      result.narrative = await this.generateNarrative(topic, result.searchResults);

      // PASO 5: Subir imágenes a R2
      for (let i = 0; i < result.topImages.length; i++) {
        const img = result.topImages[i];
        const filename = `${topic.replace(/\s+/g, '-').toLowerCase()}-${i + 1}-${Date.now()}.jpg`;
        const r2Url = await this.uploadImageToR2(img.url, filename);
        if (r2Url) {
          result.r2Urls.push(r2Url);
        }
      }

      // PASO 6: Track tokens (solo DeepSeek)
      if (monitor) {
        await monitor.trackUsage('openrouter', 150, `/webpost ${topic}`);
      }

      result.status = 'success';
      result.tokensUsed.openrouter = 150;

      return result;
    } catch (e) {
      result.status = `error: ${e.message}`;
      return result;
    }
  }
}

module.exports = WebPostGenerator;
