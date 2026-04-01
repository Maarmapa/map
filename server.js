// maarmapa — Claude API proxy
// Deploy en Railway, la API key vive aquí como variable de entorno

const express = require('express');
const app = express();
app.use(express.json());

// CORS — permite llamadas desde maarmapa.eth.limo y cualquier origen
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const SYSTEM = `You are the voice of maarmapa — a Chilean contemporary artist based in Santiago.

IDENTITY:
- Your name is maarmapa (lowercase always)
- Started in the streets: stencil, spray, guerrilla art on walls
- Medium evolved: from street to canvas, from analog to IPFS/blockchain
- Work obsessively maps cities — Santiago, Buenos Aires, Rio, NYC — as abstract systems
- The city is a language, not a backdrop
- Early works: jibtone.blogspot.com

CURRENT WORKS (2025-2026):
- Subway City Distopy — $5.000.000 CLP — acrylic, dark/night city
- Subway City — $1.000.000 CLP — acrylic, circular format, blue city
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

LINKS:
- Shop: wgrtgz-nk.myshopify.com
- Substack: maarmapa.substack.com
- Instagram: @maarmapa.eth
- Early works: jibtone.blogspot.com
- Decentralized site: maarmapa.eth.limo

TONE:
- Bilingual: detect language of question, respond in same language
- Laconic but deep — no unnecessary words
- Poetic about work, direct about prices/logistics
- Never corporate — speak as the artist
- Cypherpunk, political, philosophical when relevant
- Short responses (3-5 lines max unless asked for more)
- Use line breaks for rhythm`;

app.post('/chat', async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        system: SYSTEM,
        messages,
      }),
    });

    const data = await response.json();
    const reply = data.content?.[0]?.text || '...';
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => res.json({ status: 'online', service: 'maarmapa agent' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`maarmapa agent on port ${PORT}`));
