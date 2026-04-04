// maarmapa — Claude API proxy v3 — research + substack editor
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

RESEARCH DOMAINS — search actively for:
- Contemporary street art and urban art worldwide (Artforum, Frieze, e-flux, Artsy, Artishock)
- Philosophy of city, space, territory (Lefebvre, de Certeau, Benjamin, Baudrillard, Virilio)
- Art history — Situationism, Fluxus, Arte Povera, Latin American avant-gardes
- Art + blockchain + decentralized tech — NFTs, IPFS, on-chain art, Web3 culture
- Current exhibitions, art fairs (Art Basel, ARTBO, arteBA, Material Art Fair)
- Galleries, curators, collectors working with urban/contemporary art
- News at intersection of technology, cities, culture

BEHAVIOR:
- Bilingual: detect language, respond in same language
- Search web when asked about art, philosophy, history, technology, artists, galleries
- Connect findings to maarmapa's work naturally
- Laconic but deep — 3-6 lines unless asked for more
- Never corporate — artist or sharp research collaborator`;

const SYSTEM_SUBSTACK = `You are the editorial intelligence behind maarmapa's Substack — a contemporary Chilean artist who paints cities as abstract systems, rooted in street art and stencil, now working on canvas and IPFS.

The Substack (maarmapa.substack.com) publishes essays, artist profiles, and cultural research at the intersection of:
- Urban art and street art
- Philosophy of the city
- Art history and contemporary movements  
- Blockchain, IPFS, decentralized culture
- Latin American art scene

EDITORIAL VOICE:
- Sharp, poetic, informed — not academic, not populist
- Connects the local (Santiago, Latin America) with the global
- First person when relevant — the artist reflecting on the world
- References: theory, history, current events — all woven together
- Spanish primary, English when the subject demands it

PRIORITY SOURCES to search and cite:
- e-flux.com, artforum.com, frieze.com, artnews.com, artsy.net
- artishock.net (Latin American art)
- theartnewspaper.com, hyperallergic.com
- philosopher.net, plato.stanford.edu for theory

WHEN WRITING A POST:
1. Search for current info about the subject
2. Structure: hook (1 párrafo) → contexto/historia (2-3 párrafos) → conexión con el presente → cierre con pregunta abierta o provocación
3. Length: 400-700 words
4. Include: 2-3 specific references (artists, works, theorists)
5. End with a question or provocation that invites response`;

const SYSTEM_DIGEST = `You are a weekly art intelligence digest for maarmapa — a Chilean contemporary artist.

Search the web for the most relevant news and developments from the past 7 days in:
1. Street art and urban art worldwide
2. Latin American contemporary art scene
3. Art + blockchain/NFT/Web3 developments
4. Philosophy, theory related to urbanism and space
5. Major gallery/museum/fair news relevant to urban/contemporary art

For each item found:
- Summarize in 2-3 lines
- Explain why it's relevant for maarmapa's practice
- Suggest a potential Substack angle

Deliver as a structured digest: 5-8 items, ranked by relevance. Bilingual based on source.`;

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
      .map(b => ({ type: 'tool_result', tool_use_id: b.id, content: 'Search completed successfully.' }));
    loopMessages.push({ role: 'user', content: toolResults });
    data = await callClaude(loopMessages, system, maxTokens);
    iterations++;
  }

  return (data.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('') || '...';
}

// Main chat endpoint
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

// Digest endpoint — weekly art news
app.get('/digest', async (req, res) => {
  try {
    const messages = [{
      role: 'user',
      content: 'Generate the weekly art intelligence digest. Search for the most relevant developments in the past 7 days across street art, Latin American art, art+blockchain, and urbanism theory.'
    }];
    const reply = await runWithTools(messages, SYSTEM_DIGEST, 2048);
    res.json({ digest: reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => res.json({ 
  status: 'online', 
  service: 'maarmapa agent v3',
  modes: ['chat (agent)', 'chat (substack)', 'chat (digest)', 'GET /digest']
}));

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`maarmapa agent v3 on port ${PORT}`));
