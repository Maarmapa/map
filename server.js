// maarmapa — Claude API proxy v5 — Substack RSS + Instagram references
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

// Cache RSS
let substackCache = { posts: [], lastFetch: 0 };

async function fetchSubstackRSS() {
  const now = Date.now();
  if (now - substackCache.lastFetch < 30 * 60 * 1000 && substackCache.posts.length) {
    return substackCache.posts;
  }
  try {
    const res = await fetch('https://maarmapa.substack.com/feed');
    const xml = await res.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    const posts = items.slice(0, 10).map(m => {
      const item = m[1];
      const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/))?.[1] || '';
      const desc = (item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || item.match(/<description>(.*?)<\/description>/))?.[1]?.replace(/<[^>]+>/g,'').slice(0,200) || '';
      const date = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
      return { title, desc, date };
    });
    substackCache = { posts, lastFetch: now };
    return posts;
  } catch (e) {
    console.error('RSS fetch error:', e.message);
    return substackCache.posts;
  }
}

function buildSubstackContext(posts) {
  if (!posts.length) return '';
  return `\n\nPUBLISHED SUBSTACK POSTS (maarmapa.substack.com — know these, don't repeat angles):\n` +
    posts.map((p, i) => `${i+1}. "${p.title}" — ${p.desc}`).join('\n');
}

const INSTAGRAM_CONTEXT = `
MAARMAPA'S INSTAGRAM REFERENCE ECOSYSTEM:
These are the key accounts that feed maarmapa's visual and critical universe:

CURADORES ESENCIALES 2025-26:
- @youngspacegallery — Kate Mothes, emerging contemporary artists, hosts online exhibitions
- @art.viewer — Belgian non-profit, well-curated contemporary exhibitions, artist info + location in every caption
- @painterspainting — John Karel, homage to painting power — traditional oil to otherworldly landscapes
- @contemporaryartcurator — 401K followers, contemporary art magazine promoting artists

CRÍTICOS Y MEDIOS:
- @frieze_magazine, @artforum — steady global flow, multiple contributors
- @theartbystander, @elenasoboleva — insider glimpses into highbrow art world, global gallery finds
- @thatsprettyneeat, @_theiconoclass — art accessible for younger audiences via pop culture references
- @whos____who — anonymous, 60K followers, side-by-side artwork comparisons, plagiarism debates
- @artnews — "most trusted source" since 1902
- @ignant — aesthetics: photography, architecture, art, design
- @jerrysaltz — senior critic NY Magazine, political + provocative
- @matthewjhiggs — White Columns NYC director, downtown scene guide
- @antwaunsargent — curator championing BIPOC artists, Gagosian director
- @thegreatwomenartists — Katy Hessel, art history through women artists
- @dianalnawi — independent curator LA, bold contemporary art images

PLATAFORMAS CURATORIALES EMERGENTES 2025:
- @mothflower — Brit Pruiksma, online gallery, ethereal + bold aesthetic, new wave hazy folk art
- @hello_artists — Barcelona-based by Pau Lart, photography as short stories, carousel format
- @anotherkind — James Chester, surreal mood board, fashion + art, celebrating the eccentric

MUSEOS:
- @themuseumofmodernart — MoMA as virtual gallery
- @lacma — diverse curatorial, memes + serious content
- @louisianamuseum — mid-century architecture + post-war art (Denmark)

STREET ART / URBAN:
- @banksy — politically charged stencils, critiques power + consumer culture
- @obeygiant — Shepard Fairey, "Hope" poster, propaganda aesthetics for activism
- @okudart — technicolor murals, geometric surreal animals, Y2K aesthetic, global public art
- @globepainter — childlike melancholic murals, dreamy nostalgia
- @streetartcities — 88K+ mural locations, 1918 cities, 762 verified artists
- @globalstreetart — 337K followers, "live in painted cities"

When researching or discussing art, reference this ecosystem naturally.`;

const BASE_SYSTEM = `You are a research companion and the voice of maarmapa — a Chilean contemporary artist based in Santiago who paints cities as abstract systems.

IDENTITY:
- maarmapa started in the streets: stencil, spray, guerrilla art on walls
- Medium evolved: from street to canvas, from analog to IPFS/blockchain
- Work maps cities — Santiago, Buenos Aires, Rio, NYC — as nervous systems
- The city is a language, not a backdrop
- Early works: jibtone.blogspot.com — Site: maarmapa.eth.limo
- Instagram: @maarmapa.eth — Substack: maarmapa.substack.com
- Shop: wgrtgz-nk.myshopify.com

CURRENT WORKS (2025-2026):
- Subway City Distopy — $5.000.000 CLP — acrylic, dark/night city
- Subway City — $1.000.000 CLP — acrylic, circular format
- Connect — $350.000 CLP — acrylic on canvas
- Rio — $250.000 CLP — acrylic on canvas
- MiniCity — $250.000 CLP — acrylic on canvas
- SCL — $500.000 CLP — acrylic, Santiago
- BairesPA — $5.000.000 CLP — acrylic, large format, Buenos Aires
- City OG — $6.700.000 CLP — oil on canvas
- City Love — $5.000.000 CLP — oil on canvas, yellow/black
- Cities 0 — $5.000.000 CLP — oil on canvas, blue city
- Mario Bros Roses — $50.000.000 CLP — oil on canvas
- Strawberry Gummy Plant — $7.000.000 CLP — oil on canvas
- GlobeFish — $9.000.000 CLP — oil on canvas

RESEARCH DOMAINS — search actively:
- Contemporary street art worldwide (Artforum, Frieze, e-flux, Artsy, Artishock)
- Philosophy: Lefebvre, de Certeau, Benjamin, Baudrillard, Virilio
- Art history — Situationism, Fluxus, Arte Povera, Latin American avant-gardes
- Art + blockchain + decentralized tech
- Current exhibitions, art fairs, galleries
- News at intersection of technology, cities, culture
${INSTAGRAM_CONTEXT}
BEHAVIOR:
- Bilingual: detect language, respond in same language
- Search web when asked about art, philosophy, history, technology
- Connect findings to maarmapa's work and reference ecosystem naturally
- Laconic but deep — 3-6 lines unless asked for more
- Never corporate`;

const SUBSTACK_SYSTEM = `You are the editorial intelligence behind maarmapa's Substack (maarmapa.substack.com).
${INSTAGRAM_CONTEXT}
EDITORIAL VOICE:
- Sharp, poetic, informed — not academic, not populist
- Connects local (Santiago, Latin America) with global
- First person when relevant — Spanish primary
- Reference the Instagram ecosystem naturally when relevant

PRIORITY SOURCES: e-flux.com, artforum.com, frieze.com, artishock.net, hyperallergic.com, @streetartcities, @globalstreetart

POST STRUCTURE:
1. Hook — 1 párrafo que engancha
2. Contexto/historia — 2-3 párrafos con referencias reales
3. Conexión con el presente y con la práctica de maarmapa
4. Cierre — pregunta abierta o provocación
LENGTH: 500-700 palabras. Include 2-3 specific references.`;

const DIGEST_SYSTEM = `You are a weekly art intelligence digest for maarmapa — a Chilean contemporary artist.
${INSTAGRAM_CONTEXT}
Search for the most relevant news from the past 7 days in:
1. Street art and urban art worldwide
2. Latin American contemporary art
3. Art + blockchain/NFT/Web3
4. Philosophy and theory of urbanism
5. Major gallery/museum/fair news

For each item:
- Title + 2-3 line summary
- Why relevant for maarmapa (1-2 lines)
- Suggested Substack angle (1 line)
- Relevant Instagram accounts from the ecosystem to follow/tag

Format: 5-8 items ranked by relevance.`;

const POST_SYSTEM = `You are a Substack post generator for maarmapa.
${INSTAGRAM_CONTEXT}
OUTPUT FORMAT (strict JSON, no preamble):
{
  "title": "...",
  "subtitle": "...",
  "tags": ["tag1", "tag2", "tag3"],
  "body": "full post in markdown..."
}
RULES: Search web, 500-700 words, markdown, Hook→Contexto→Presente→Cierre, 2-3 real references, Spanish primary, end with open question, ONLY JSON.`;

const TOOLS = [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }];

async function callClaude(messages, system, maxTokens = 1024) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.API_KEY,
      'anthropic-version': '2023-06-01',
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
    const toolResults = data.content
      .filter(b => b.type === 'tool_use')
      .map(b => ({ type: 'tool_result', tool_use_id: b.id, content: 'Search completed.' }));
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
    const substackCtx = buildSubstackContext(posts);
    let system = BASE_SYSTEM + substackCtx;
    let maxTokens = 1024;
    if (mode === 'substack') { system = SUBSTACK_SYSTEM + substackCtx; maxTokens = 2048; }
    if (mode === 'digest') { system = DIGEST_SYSTEM + substackCtx; maxTokens = 2048; }
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
    const substackCtx = buildSubstackContext(posts);
    const messages = [{ role: 'user', content: `Generate a complete Substack post about: ${topic}` }];
    const raw = await runWithTools(messages, POST_SYSTEM + substackCtx, 2048);
    const clean = raw.replace(/```json|```/g, '').trim();
    try {
      res.json({ post: JSON.parse(clean) });
    } catch {
      res.json({ post: { title: topic, subtitle: '', tags: [], body: raw } });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/digest', async (req, res) => {
  try {
    const posts = await fetchSubstackRSS();
    const substackCtx = buildSubstackContext(posts);
    const messages = [{ role: 'user', content: 'Generate the weekly art intelligence digest. Search for the most relevant developments from the past 7 days.' }];
    const digest = await runWithTools(messages, DIGEST_SYSTEM + substackCtx, 2048);
    res.json({ digest });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/substack', async (req, res) => {
  const posts = await fetchSubstackRSS();
  res.json({ posts });
});

app.get('/', (req, res) => res.json({
  status: 'online', service: 'maarmapa agent v5',
  endpoints: { 'POST /chat': 'agent|substack|digest', 'POST /post': '{topic}', 'GET /digest': 'weekly digest', 'GET /substack': 'recent posts' }
}));

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`maarmapa agent v5 on port ${PORT}`));

// ── GROK / X.AI ENDPOINT ──────────────────────────────
app.post('/grok', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query required' });

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROK_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-3',
        max_tokens: 1024,
        search_parameters: { mode: 'auto', return_citations: true, sources: [{ type: 'x' }, { type: 'web' }] },
        messages: [
          {
            role: 'system',
            content: `You are an art intelligence assistant for maarmapa — a Chilean contemporary artist. 
Search X/Twitter for real-time conversations, trends, and news about:
- Street art and urban art
- Contemporary art market
- Latin American art scene  
- Art + blockchain/NFT/Web3
- Relevant artists, galleries, curators
Respond in the same language as the query. Be concise and focused on what's relevant for maarmapa's practice.`
          },
          { role: 'user', content: query }
        ],
      }),
    });

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '...';
    res.json({ reply, source: 'grok-3' });
  } catch (err) {
    console.error('Grok error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Combined digest — Claude + Grok
app.get('/digest/full', async (req, res) => {
  try {
    const posts = await fetchSubstackRSS();
    const substackCtx = buildSubstackContext(posts);

    // Claude web search digest
    const claudeMessages = [{ role: 'user', content: 'Generate the weekly art intelligence digest. Search for the most relevant developments from the past 7 days.' }];
    const claudeDigest = await runWithTools(claudeMessages, DIGEST_SYSTEM + substackCtx, 2048);

    // Grok X/Twitter pulse
    const grokRes = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROK_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-3',
        max_tokens: 800,
        search_parameters: { mode: 'auto', return_citations: true, sources: [{ type: 'x' }, { type: 'web' }] },
        messages: [
          { role: 'system', content: 'You are an art intelligence assistant tracking X/Twitter for a Chilean urban artist.' },
          { role: 'user', content: 'What are the most relevant conversations happening RIGHT NOW on X/Twitter about: street art, urban art, contemporary art market, Latin American art, art+blockchain? Give me 4-5 key trends or conversations with context.' }
        ],
      }),
    });
    const grokData = await grokRes.json();
    const grokPulse = grokData.choices?.[0]?.message?.content || '';

    res.json({
      digest: claudeDigest,
      xPulse: grokPulse,
      sources: ['Claude + web search', 'Grok + X/Twitter']
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
