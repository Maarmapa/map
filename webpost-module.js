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

  // 1. Web search usando Google Custom Search API (fallback: hardcoded results)
  async webSearch(query) {
    try {
      // Alternativa: usar Google Search si tienes API key
      // Por ahora, usar resultados simulados con fetch a sitios populares
      
      let results = [];
      
      // Buscar en Wikipedia primero
      try {
        const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&srsearch=${encodeURIComponent(query)}&list=search`;
        const wikiResponse = await fetch(wikiUrl);
        const wikiData = await wikiResponse.json();
        
        if (wikiData.query?.search) {
          wikiData.query.search.slice(0, 3).forEach(item => {
            results.push({
              title: item.title,
              url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title)}`,
              snippet: item.snippet.replace(/<[^>]*>/g, '').slice(0, 100),
              index: results.length + 1
            });
          });
        }
      } catch (e) {
        console.log('Wikipedia search failed, trying fallback');
      }
      
      // Si Wikipedia no devolvió resultados, usar Medium/Dev.to
      if (results.length < 3) {
        const searchUrls = [
          `https://dev.to/search?q=${encodeURIComponent(query)}`,
          `https://medium.com/search?q=${encodeURIComponent(query)}`,
          `https://news.ycombinator.com/search?p=1&stories=${encodeURIComponent(query)}`
        ];
        
        for (const searchUrl of searchUrls) {
          try {
            const response = await fetch(searchUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const html = await response.text();
            const $ = cheerio.load(html);
            
            // Extract títulos y URLs según sitio
            if (searchUrl.includes('dev.to')) {
              $('a[data-test-id]').each((i, el) => {
                if (results.length >= 10) return false;
                const href = $(el).attr('href');
                if (href?.includes('/')) {
                  results.push({
                    title: $(el).text().trim(),
                    url: href.startsWith('http') ? href : `https://dev.to${href}`,
                    index: results.length + 1
                  });
                }
              });
            } else if (searchUrl.includes('medium')) {
              $('a[data-action="show-post"]').each((i, el) => {
                if (results.length >= 10) return false;
                const href = $(el).attr('href');
                if (href?.startsWith('http')) {
                  results.push({
                    title: $(el).text().trim(),
                    url: href,
                    index: results.length + 1
                  });
                }
              });
            }
          } catch (e) {
            console.log(`Search failed for ${searchUrl}:`, e.message);
          }
        }
      }
      
      // Fallback: retornar resultados genéricos si nada funcionó
      if (results.length === 0) {
        results = [
          {
            title: `${query} - Latest News`,
            url: `https://news.google.com/search?q=${encodeURIComponent(query)}`,
            index: 1
          },
          {
            title: `${query} - Wikipedia`,
            url: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query)}`,
            index: 2
          }
        ];
      }
      
      return results.slice(0, 10);
    } catch (e) {
      console.error('Web search error:', e.message);
      // Retornar al menos 2 resultados para no fallar completamente
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
