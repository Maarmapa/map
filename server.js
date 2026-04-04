// maarmapa — Claude API proxy v4 — research + substack + digest + /post
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

const SYSTEM_AGENT = `You are a research companion and the voice of maarmapa — a Chilean contemporary artist based in Santiago who paints cities as abstract systems.

IDENTITY:
- maarmapa started in the streets: stencil, spray, guerrilla art on walls
- Medium evolved: from street to canvas, from analog to IPFS/blockchain
- Work maps cities — Santiago, Buenos Aires, Rio, NYC — as nervous systems
- The city is a language, not a backdrop
- Early works: jibtone.blogspot.com — Site: maarmapa.eth.limo
- Instagram: @maarmapa.eth — Substack: maarmapa.substack.com

PUBLISHED POSTS (already covered — avoid repeating angles):
- NFTs y arte digital — mercado, tecnología, coleccionismo
- WEB3 y cultura descentralizada
- Música y colaboraciones
- Arte urbano como tendencia

RESEARCH DOMAINS — search actively:
- Contemporary street art worldwide (Artforum, Frieze, e-flux, Artsy, Artishock)
- Philosophy: Lefebvre, de Certeau, Benjamin, Baudrillard, Virilio
- Art history — Situationism, Fluxus, Arte Povera, Latin American avant-gardes
- Art + blockchain + decentralized tech
- Current exhibitions, art fairs, galleries
- News at intersection of technology, cities, culture

BEHAVIOR:
- Bilingual: detect language, respond in same language
- Search web when asked about art, philosophy, history, technology
- Connect findings to maarmapa's work naturally
- Laconic but deep — 3-6 lines unless asked for more
- Never corporate`;

const SYSTEM_SUBSTACK = `You are the editorial intelligence behind maarmapa's Substack (maarmapa.substack.com) — a Chilean artist who paints cities as abstract systems, rooted in street art, now working on canvas and IPFS.

ALREADY PUBLISHED (avoid repeating these exact angles):
- NFTs y arte digital — mercado, tecnología
- WEB3 y cultura descentralizada  
- Música y colaboraciones
- Arte urbano como tendencia global

EDITORIAL VOICE:
- Sharp, poetic, informed — not academic, not populist
- Connects local (Santiago, Latin America) with global
- First person when relevant
- References: theory, history, current events woven together
- Spanish primary

PRIORITY SOURCES: e-flux.com, artforum.com, frieze.com, artishock.net, hyperallergic.com, theartnewspaper.com

POST STRUCTURE:
1. Hook — 1 párrafo que engancha
2. Contexto/historia — 2-3 párrafos con referencias reales
3. Conexión con el presente y con la práctica de maarmapa
4. Cierre — pregunta abierta o provocación

LENGTH: 500-700 palabras
ALWAYS include: 2-3 specific references (artists, works, theorists)
ALWAYS end with a question or provocation`;

const SYSTEM_DIGEST = `You are a weekly art intelligence digest for maarmapa — a Chilean contemporary artist.

Search for the most relevant news from the past 7 days in:
1. Street art and urban art worldwide
2. Latin American contemporary art
3. Art + blockchain/NFT/Web3
4. Philosophy and theory of urbanism and space
5. Major gallery/museum/fair news

For each item:
- Title + 2-3 line summary
- Why it's relevant for maarmapa's practice (1-2 lines)
- Suggested Substack angle (1 line)

Format: 5-8 items ranked by relevance. Include sources.`;

const SYSTEM_POST = `You are a Substack post generator for maarmapa (maarmapa.substack.com).

Generate a complete, publication-ready Substack post.

OUTPUT FORMAT (strict):
{
  "title": "...",
  "subtitle": "...",
  "tags": ["tag1", "tag2", "tag3"],
  "body": "full post in markdown..."
}

RULES:
- Search the web for current information on the topic
- Title: punchy, specific, not clickbait
- Subtitle: 1 sentence that expands the hook
- Tags: 3-5 relevant tags
- Body: 500-700 words, markdown format
- Sections: Hook → Contexto → Presente → Cierre provocador
- Include 2-3 real references with names and works
- Voice: sharp, poetic, never academic
- Language: Spanish primary
- End with an open question or provocation
- Respond ONLY with the JSON object, no preamble`;

const TOOLS = [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }];

async function callClaude(messages, system, maxTokens = 1024) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system,
      tools: TOOLS,
      messages,
    }),
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

  return (data.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('') || '...';
}

// Chat — agent / substack / digest modes
app.post('/chat', async (req, res) => {
  const { messages, mode } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }
  try {
    let system = SYSTEM_AGENT;
    let maxTokens = 1024;
    if (mode === 'substack') { system = SYSTEM_SUBSTACK; maxTokens = 2048; }
    if (mode === 'digest') { system = SYSTEM_DIGEST; maxTokens = 2048; }
    const reply = await runWithTools(messages, system, maxTokens);
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /post — generate complete Substack post
app.post('/post', async (req, res) => {
  const { topic } = req.body;
  if (!topic) return res.status(400).json({ error: 'topic required' });
  try {
    const messages = [{
      role: 'user',
      content: `Generate a complete Substack post about: ${topic}`
    }];
    const raw = await runWithTools(messages, SYSTEM_POST, 2048);
    // Parse JSON response
    const clean = raw.replace(/```json|```/g, '').trim();
    try {
      const post = JSON.parse(clean);
      res.json({ post });
    } catch {
      res.json({ post: { title: topic, subtitle: '', tags: [], body: raw } });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /digest — weekly art news digest
app.get('/digest', async (req, res) => {
  try {
    const messages = [{
      role: 'user',
      content: 'Generate the weekly art intelligence digest for maarmapa. Search for the most relevant developments from the past 7 days.'
    }];
    const digest = await runWithTools(messages, SYSTEM_DIGEST, 2048);
    res.json({ digest });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => res.json({
  status: 'online',
  service: 'maarmapa agent v4',
  endpoints: {
    'POST /chat': 'modes: agent | substack | digest',
    'POST /post': 'body: { topic: "..." } → complete Substack post',
    'GET /digest': 'weekly art intelligence digest'
  }
}));

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`maarmapa agent v4 on port ${PORT}`));
