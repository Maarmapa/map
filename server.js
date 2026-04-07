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

const POST_SYSTEM = `Substack post generator for maarmapa. OUTPUT strict JSON only:
{"title":"...","subtitle":"...","tags":["tag1","tag2"],"body":"markdown..."}
Search web. 500-700 words. Hook→Contexto→Presente→Cierre. 2-3 real references. Spanish. End with question.${INSTAGRAM_CONTEXT}`;

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

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`maarmapa agent v6 on port ${PORT}`));