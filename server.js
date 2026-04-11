// maarmapa — Claude API proxy v6 stable
const express = require('express');
const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

let substackCache = { posts: [], lastFetch: 0 };

async function fetchSubstackRSS() {
  const now = Date.now();
  if (now - substackCache.lastFetch < 30 * 60 * 1000 && substackCache.posts.length) return substackCache.posts;
  try {
    const res = await fetch('https://maarmapa.substack.com/feed');
    const xml = await res.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    const posts = items.slice(0, 10).map(m => {
      const item = m[1];
      const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/))?.[1] || '';
      const desc = (item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || item.match(/<description>(.*?)<\/description>/))?.[1]?.replace(/<[^>]+>/g,'').slice(0,200) || '';
      return { title, desc };
    });
    substackCache = { posts, lastFetch: now };
    return posts;
  } catch (e) { return substackCache.posts; }
}

function buildSubstackContext(posts) {
  if (!posts.length) return '';
  return `\n\nPUBLISHED SUBSTACK POSTS:\n` + posts.map((p,i) => `${i+1}. "${p.title}" — ${p.desc}`).join('\n');
}

const INSTAGRAM_CONTEXT = `
INSTAGRAM ECOSYSTEM: @youngspacegallery @art.viewer @painterspainting @contemporaryartcurator @frieze_magazine @artforum @theartbystander @elenasoboleva @whos____who @artnews @ignant @jerrysaltz @matthewjhiggs @antwaunsargent @thegreatwomenartists @dianalnawi @mothflower @hello_artists @anotherkind @themuseumofmodernart @lacma @louisianamuseum @banksy @obeygiant @okudart @globepainter @streetartcities @globalstreetart`;

const BASE_SYSTEM = `You are a research companion and the voice of maarmapa — a Chilean contemporary artist based in Santiago who paints cities as abstract systems. Started in the streets (stencil, spray), evolved to canvas and IPFS/blockchain. Maps cities as nervous systems. The city is a language. Early works: jibtone.blogspot.com. Site: maarmapa.eth.limo. Instagram: @maarmapa.eth. Substack: maarmapa.substack.com.

WORKS (CLP): Subway City Distopy $5M, Subway City $1M, Connect $350K, Rio $250K, MiniCity $250K, SCL $500K, BairesPA $5M, City OG $6.7M, City Love $5M, Cities 0 $5M, Mario Bros Roses $50M, Strawberry Gummy Plant $7M, GlobeFish $9M.

Search web for street art, philosophy (Lefebvre, Benjamin, Baudrillard), art history (Situationism, Latin American avant-gardes), art+blockchain, exhibitions.
${INSTAGRAM_CONTEXT}
Bilingual. Laconic but deep. Never corporate.`;

const SUBSTACK_SYSTEM = `Editorial intelligence for maarmapa's Substack. Sharp, poetic. Spanish primary. Sources: e-flux.com, artforum.com, frieze.com, artishock.net. Structure: Hook → Contexto → Presente → Cierre provocador. 500-700 words. 2-3 real references.${INSTAGRAM_CONTEXT}`;

const DIGEST_SYSTEM = `Weekly art intelligence digest for maarmapa. Search past 7 days: street art, Latin American art, art+blockchain, urbanism philosophy, gallery news. Per item: title, 2-3 line summary, why relevant, Substack angle, Instagram accounts. 5-8 items ranked by relevance.${INSTAGRAM_CONTEXT}`;

const POST_SYSTEM = `You are a content generator for maarmapa — Chilean contemporary urban artist. Generate editorial content about art, culture, blockchain and cities. Search the web for real, current information about the topic.

OUTPUT strict JSON only, no preamble, no markdown fences:
{
  "title": "post title",
  "subtitle": "one line subtitle",
  "tags": ["tag1", "tag2", "tag3"],
  "body": "full Substack post in markdown, 500-700 words, Hook→Contexto→Presente→Cierre, end with open question",
  "thumbnail_prompt": "detailed image generation prompt in English for the post thumbnail, editorial/dark aesthetic, no people, conceptual",
  "instagram": {
    "caption": "short instagram caption in Spanish, max 150 chars, lowercase, end with relevant hashtags",
    "slides": [
      "Slide 1 text (hook, max 10 words)",
      "Slide 2 text",
      "Slide 3 text",
      "Slide 4 text",
      "Slide 5 text",
      "Slide 6 text (key question or insight)",
      "Slide 7 text (CTA or conclusion)"
    ]
  }
}

RULES:
- This is EDITORIAL content, not promotional. Do not mix with maarmapa artworks unless the topic is specifically about them.
- Search web for current facts, dates, names, context
- Spanish for body and instagram. English for thumbnail_prompt.
- Thumbnail must be conceptual, dark editorial aesthetic, no faces/people
- Instagram slides must be punchy, minimal text, designed to stop the scroll
- ONLY output valid JSON, nothing else`;

const TOOLS = [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }];

async function callClaude(messages, system, maxTokens = 1024) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: maxTokens, system, tools: TOOLS, messages }),
  });
  return res.json();
}

async function runWithTools(messages, system, maxTokens) {
  let data = await callClaude(messages, system, maxTokens);
  let loopMessages = [...messages];
  let iterations = 0;
  while (data.stop_reason === 'tool_use' && iterations < 5) {
    loopMessages.push({ role: 'assistant', content: data.content });
    const toolResults = data.content.filter(b => b.type === 'tool_use').map(b => ({ type: 'tool_result', tool_use_id: b.id, content: 'Search completed.' }));
    loopMessages.push({ role: 'user', content: toolResults });
    data = await callClaude(loopMessages, system, maxTokens);
    iterations++;
  }
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('') || '...';
}

app.post('/chat', async (req, res) => {
  const { messages, mode } = req.body;
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages array required' });
  try {
    const posts = await fetchSubstackRSS();
    const ctx = buildSubstackContext(posts);
    let system = BASE_SYSTEM + ctx, maxTokens = 1024;
    if (mode === 'substack') { system = SUBSTACK_SYSTEM + ctx; maxTokens = 2048; }
    if (mode === 'digest') { system = DIGEST_SYSTEM + ctx; maxTokens = 2048; }
    const reply = await runWithTools(messages, system, maxTokens);
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/post', async (req, res) => {
  const { topic } = req.body;
  if (!topic) return res.status(400).json({ error: 'topic required' });
  try {
    const posts = await fetchSubstackRSS();
    const ctx = buildSubstackContext(posts);
    const raw = await runWithTools([{ role: 'user', content: `Generate a complete Substack post about: ${topic}` }], POST_SYSTEM + ctx, 2048);
    const clean = raw.replace(/```json|```/g, '').trim();
    try { res.json({ post: JSON.parse(clean) }); }
    catch { res.json({ post: { title: topic, subtitle: '', tags: [], body: raw } }); }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/digest', async (req, res) => {
  try {
    const posts = await fetchSubstackRSS();
    const ctx = buildSubstackContext(posts);
    const digest = await runWithTools([{ role: 'user', content: 'Generate the weekly art intelligence digest. Search for the most relevant developments from the past 7 days.' }], DIGEST_SYSTEM + ctx, 2048);
    res.json({ digest });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/substack', async (req, res) => {
  res.json({ posts: await fetchSubstackRSS() });
});

app.get('/', (req, res) => res.json({
  status: 'online', service: 'maarmapa agent v6',
  endpoints: { 'POST /chat': 'agent|substack|digest', 'POST /post': '{topic}', 'GET /digest': 'weekly', 'GET /substack': 'posts' }
}));


// ── MARKETING / REDES SOCIALES ────────────────────────
const MARKETING_SYSTEM = `You are a creative marketing strategist for maarmapa — a Chilean contemporary urban artist. Search for the latest creative ideas, trends and strategies for visual artists on social media in 2026.

Focus on:
- Instagram, TikTok, YouTube Shorts strategies for visual artists
- Blockchain/NFT marketing for Latin American artists  
- Community building and storytelling for urban/street artists
- Content ideas that connect physical street art with digital presence
- Collaboration strategies with galleries, curators, collectors

MAARMAPA CONTEXT: Started in streets (stencil/spray), now canvas + IPFS/blockchain. Maps cities as nervous systems. Instagram @maarmapa.eth, Substack maarmapa.substack.com, Shop wgrtgz-nk.myshopify.com.

Respond in Spanish. Be specific, actionable and creative. Connect ideas to maarmapa's unique position at the intersection of street art, blockchain and Latin American urban culture.`;

app.post('/marketing', async (req, res) => {
  const { query } = req.body || {};
  const userQuery = query || 'mejores ideas creativas premiadas Cannes Lions marketing redes sociales 2026';
  try {
    const posts = await fetchSubstackRSS();
    const ctx = buildSubstackContext(posts);
    const [claudeReply, grokPulse] = await Promise.all([
      runWithTools([{ role: 'user', content: userQuery }], MARKETING_SYSTEM + ctx, 2048),
      callGrok(`Busca en X/Twitter las campanas de marketing mas creativas y virales de 2026: ${userQuery}`)
    ]);
    res.json({ reply: claudeReply, xPulse: grokPulse });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ── CONTENT FACTORY ──────────────────────────────────
const FACTORY_SYSTEM = `You are a content factory for maarmapa — Chilean contemporary urban artist and art intelligence voice. Generate complete editorial content packages about art, culture, blockchain and cities.

Search the web for current, real information about the topic before generating.

OUTPUT strict JSON only, no preamble, no markdown fences:
{
  "title": "compelling post title",
  "subtitle": "one sharp line",
  "tags": ["tag1", "tag2", "tag3"],
  "body": "full Substack post in markdown, 500-700 words, Spanish, Hook→Contexto→Presente→Cierre, 2-3 real references, end with open question",
  "thumbnail_prompt": "detailed English prompt for Grok image generation: Square 1:1 format editorial Instagram slide. Dark background. Strict center-safe text zone with 100px margins on ALL sides. [describe specific background image at 10-15% opacity, blurred, film grain, cinematic vignette]. Typography: top-left small caps label in dark gray. Large bold condensed Bebas Neue style text left-aligned in white fitting inside margins: [MAIN HEADLINE]. Bottom left small gray subtext. Bottom right T/07 faint. ALL text inside 100px safe margins. No watermarks. Dark cinematic editorial style.",
  "slides": [
    {
      "num": "01",
      "prompt": "Square 1:1 editorial Instagram slide. [full Grok image prompt with safe margins, background, typography, film grain, specific text for this slide]"
    },
    { "num": "02", "prompt": "..." },
    { "num": "03", "prompt": "..." },
    { "num": "04", "prompt": "..." },
    { "num": "05", "prompt": "..." },
    { "num": "06", "prompt": "..." },
    { "num": "07", "prompt": "..." }
  ],
  "instagram_caption": "short punchy caption in Spanish lowercase, max 150 chars, relevant hashtags at end"
}

RULES:
- Search web first for real facts, dates, quotes
- Editorial content only — do not mix with maarmapa artworks unless topic is specifically about them
- Each slide prompt must be self-contained and complete for Grok image generation
- Slides tell a story: Hook → Context → Data → Quote → Analysis → Key Question → CTA
- Slide 07 always ends with @maarmapa.eth handle
- ONLY output valid JSON`;

async function generateImages(slides) {
  if (!process.env.GROK_KEY) return slides.map(s => ({ ...s, url: null }));
  
  const results = await Promise.allSettled(
    slides.map(async (slide) => {
      try {
        const res = await fetch('https://api.x.ai/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': \`Bearer \${process.env.GROK_KEY}\`
          },
          body: JSON.stringify({
            model: 'grok-2-image',
            prompt: slide.prompt,
            n: 1,
            response_format: 'url'
          })
        });
        const data = await res.json();
        return { num: slide.num, prompt: slide.prompt, url: data.data?.[0]?.url || null };
      } catch(e) {
        return { num: slide.num, prompt: slide.prompt, url: null };
      }
    })
  );
  
  return results.map(r => r.status === 'fulfilled' ? r.value : { url: null });
}

app.post('/factory', async (req, res) => {
  const { topic } = req.body;
  if (!topic) return res.status(400).json({ error: 'topic required' });
  
  console.log('Factory generating for:', topic);
  
  try {
    // Step 1: Claude generates all content + prompts
    const posts = await fetchSubstackRSS();
    const ctx = buildSubstackContext(posts);
    const raw = await runWithTools(
      [{ role: 'user', content: \`Generate a complete content package about: \${topic}\` }],
      FACTORY_SYSTEM + ctx,
      4096
    );
    
    const clean = raw.replace(/\`\`\`json|\`\`\`/g, '').trim();
    let content;
    try {
      content = JSON.parse(clean);
    } catch(e) {
      return res.status(500).json({ error: 'JSON parse failed', raw: raw.slice(0, 500) });
    }
    
    // Step 2: Grok generates thumbnail + all 7 slide images in parallel
    console.log('Generating images with Grok...');
    const [thumbnailResult, slidesWithImages] = await Promise.all([
      // Thumbnail
      (async () => {
        try {
          const r = await fetch('https://api.x.ai/v1/images/generations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${process.env.GROK_KEY}\` },
            body: JSON.stringify({ model: 'grok-2-image', prompt: content.thumbnail_prompt, n: 1, response_format: 'url' })
          });
          const d = await r.json();
          return d.data?.[0]?.url || null;
        } catch(e) { return null; }
      })(),
      // 7 slides
      generateImages(content.slides || [])
    ]);
    
    res.json({
      topic,
      substack: {
        title: content.title,
        subtitle: content.subtitle,
        tags: content.tags,
        body: content.body
      },
      thumbnail_url: thumbnailResult,
      carousel: slidesWithImages,
      instagram_caption: content.instagram_caption,
      generated_at: new Date().toISOString()
    });
    
  } catch (err) {
    console.error('Factory error:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`maarmapa agent v6 on port ${PORT}`));

// ── GROK / X.AI ───────────────────────────────────────
async function callGrok(userMessage) {
  try {
    const res = await fetch('https://api.x.ai/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROK_KEY}` },
      body: JSON.stringify({
        model: 'grok-4-1-fast',
        tools: [{ type: 'web_search' }, { type: 'x_search' }],
        input: [
          { role: 'system', content: 'Art intelligence assistant for maarmapa — Chilean urban artist. Search X/Twitter and web for street art, urban art, Latin American art, art+blockchain news. Same language as query.' },
          { role: 'user', content: userMessage }
        ],
      }),
    });
    const text = await res.text();
    const data = JSON.parse(text);
    const output = data.output || [];
    return output.filter(b => b.type === 'message').flatMap(b => b.content || []).filter(c => c.type === 'output_text').map(c => c.text).join('')
      || output.map(b => b.content?.[0]?.text || '').join('')
      || data.error || '...';
  } catch(e) {
    console.error('Grok error:', e.message);
    return '...';
  }
}

app.post('/grok', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query required' });
  res.json({ reply: await callGrok(query), source: 'grok-4-1-fast + x_search' });
});

app.get('/digest/full', async (req, res) => {
  try {
    const posts = await fetchSubstackRSS();
    const ctx = buildSubstackContext(posts);
    const [claudeDigest, grokPulse] = await Promise.all([
      runWithTools([{ role: 'user', content: 'Generate the weekly art intelligence digest. Search for the most relevant developments from the past 7 days.' }], DIGEST_SYSTEM + ctx, 2048),
      callGrok('What are the most relevant conversations on X RIGHT NOW about: street art, urban art, Latin American art, art+blockchain? 4-5 key trends.')
    ]);
    res.json({ digest: claudeDigest, xPulse: grokPulse, sources: ['Claude + web search', 'Grok + X/Twitter'] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});