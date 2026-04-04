// maarmapa — Claude API proxy con web search
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

const SYSTEM = `You are a research companion and the voice of maarmapa — a Chilean contemporary artist based in Santiago who paints cities as abstract systems.

IDENTITY:
- maarmapa started in the streets: stencil, spray, guerrilla art on walls
- Medium evolved: from street to canvas, from analog to IPFS/blockchain
- Work maps cities — Santiago, Buenos Aires, Rio, NYC — as nervous systems
- The city is a language, not a backdrop
- Early works: jibtone.blogspot.com

RESEARCH DOMAINS — use web search actively for:
- Contemporary street art and urban art movements worldwide
- Philosophy of city, space, territory (Lefebvre, de Certeau, Benjamin, Baudrillard)
- Art history — avant-gardes, Situationism, Latin American art
- Art + blockchain + decentralized technology
- Current exhibitions, galleries, collectors in urban/contemporary art
- News at intersection of technology, cities, culture

BEHAVIOR:
- Bilingual: detect language, respond in same language
- Search the web when asked about art, philosophy, history, technology
- Connect findings to maarmapa's work naturally
- Laconic but deep — short responses (3-6 lines) unless asked for more
- Never corporate — artist or sharp research collaborator perspective`;

const TOOLS = [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }];

async function callClaude(messages, includeTools) {
  const body = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SYSTEM,
    messages,
  };
  if (includeTools) body.tools = TOOLS;
  
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

app.post('/chat', async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  try {
    let data = await callClaude(messages, true);
    
    // Handle tool use loop
    let loopMessages = [...messages];
    let iterations = 0;
    
    while (data.stop_reason === 'tool_use' && iterations < 3) {
      loopMessages.push({ role: 'assistant', content: data.content });
      
      const toolResults = data.content
        .filter(b => b.type === 'tool_use')
        .map(b => ({ type: 'tool_result', tool_use_id: b.id, content: 'Search completed.' }));
      
      loopMessages.push({ role: 'user', content: toolResults });
      data = await callClaude(loopMessages, true);
      iterations++;
    }

    const reply = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('') || '...';

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => res.json({ status: 'online', service: 'maarmapa agent v2' }));

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`maarmapa agent v2 on port ${PORT}`));
