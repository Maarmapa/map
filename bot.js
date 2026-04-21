// maarmapa — Telegram Bot v3
const AGENT_URL = process.env.AGENT_URL || 'https://maarmapa-agent.onrender.com';
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;

async function tg(method, body) {
  const res = await fetch('https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/' + method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const d = await res.json();
  return d.result;
}

async function send(chatId, text) {
  const r = await tg('sendMessage', { chat_id: chatId, text, parse_mode: 'Markdown' });
  return r?.message_id;
}

async function edit(chatId, msgId, text) {
  try { await tg('editMessageText', { chat_id: chatId, message_id: msgId, text, parse_mode: 'Markdown' }); } catch(e) {}
}

async function photo(chatId, url, caption) {
  try { await tg('sendPhoto', { chat_id: chatId, photo: url, caption }); } catch(e) {}
}

async function video(chatId, url, caption) {
  try { await tg('sendVideo', { chat_id: chatId, video: url, caption }); } catch(e) {}
}

function bar(n, total) {
  const f = Math.round((n/total)*10);
  return '[' + '█'.repeat(f) + '░'.repeat(10-f) + '] ' + Math.round((n/total)*100) + '%';
}

// Spinner que se actualiza cada 5 segundos mientras espera
async function withSpinner(chatId, msgId, label, promise) {
  const frames = ['⏳', '⌛'];
  let i = 0;
  const interval = setInterval(async () => {
    i++;
    await edit(chatId, msgId, frames[i % 2] + ' *' + label + '*\n_' + ['procesando', 'trabajando', 'calculando', 'buscando'][i % 4] + '..._');
  }, 5000);
  try {
    const result = await promise;
    clearInterval(interval);
    return result;
  } catch(e) {
    clearInterval(interval);
    throw e;
  }
}

// Grok image
async function grokImg(prompt) {
  if (!process.env.GROK_KEY) return null;
  try {
    const res = await fetch('https://api.x.ai/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.GROK_KEY },
      body: JSON.stringify({ model: 'grok-imagine-image', prompt, n: 1, response_format: 'url' })
    });
    const d = await res.json();
    return d.data?.[0]?.url || null;
  } catch(e) { return null; }
}

// Runway
async function runwayVideo(imageUrl, prompt) {
  if (!process.env.RUNWAY_KEY) return null;
  try {
    const res = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.RUNWAY_KEY, 'X-Runway-Version': '2024-11-06' },
      body: JSON.stringify({ model: 'gen4_turbo', promptImage: imageUrl, promptText: prompt, ratio: '720:1280', duration: 3 })
    });
    const text = await res.text();
    console.log('Runway:', text.slice(0, 150));
    let d; try { d = JSON.parse(text); } catch(e) { return null; }
    if (!d.id) { console.error('Runway no id:', JSON.stringify(d).slice(0,100)); return null; }
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 10000));
      const p = await fetch('https://api.dev.runwayml.com/v1/tasks/' + d.id, {
        headers: { 'Authorization': 'Bearer ' + process.env.RUNWAY_KEY, 'X-Runway-Version': '2024-11-06' }
      });
      const t = await p.json();
      console.log('Runway poll ' + i + ':', t.status);
      if (t.status === 'SUCCEEDED') return t.output?.[0] || null;
      if (t.status === 'FAILED') { console.error('Runway failed:', t.failure); return null; }
    }
  } catch(e) { return null; }
}

// Main factory
async function runFactory(chatId, topic) {
  const msgId = await send(chatId, '🏭 *maarmapa factory*\n' + bar(0, 10) + '\n_Iniciando..._');

  // 1. Wake agent
  await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(1, 10) + '\n_Despertando agente..._');
  let agentOk = false;
  for (let i = 0; i < 10; i++) {
    try {
      const r = await fetch(AGENT_URL + '/');
      const t = await r.text();
      if (t.includes('maarmapa agent')) { agentOk = true; break; }
    } catch(e) {}
    await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(1, 10) + '\n_Despertando agente ' + (i+1) + '/10..._');
    await new Promise(r => setTimeout(r, 8000));
  }

  if (!agentOk) {
    await edit(chatId, msgId, '❌ Agente no responde. Espera 1 min y reintenta.');
    return;
  }

  // 2. Generate post text
  await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(2, 10) + '\n_Claude generando texto..._');

  let postData;
  try {
    const fetchPost = fetch(AGENT_URL + '/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic })
    });

    // Update spinner while waiting
    const spinPromise = (async () => {
      const labels = ['Claude buscando', 'Claude escribiendo', 'Claude refinando', 'Claude terminando'];
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 8000));
        await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(2, 10) + '\n_' + labels[i % labels.length] + '..._');
      }
    })();

    const res = await fetchPost;
    const raw = await res.json();
    postData = raw.post || raw;
  } catch(e) {
    await edit(chatId, msgId, '❌ Error generando texto: ' + e.message);
    return;
  }

  await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(3, 10) + '\n✅ _Texto generado_');

  // Send text — clean cite tags and headers
  const title = (postData.title || topic).slice(0, 120);
  const body = (postData.body || '')
    .replace(/<cite[^>]*>[\s\S]*?<\/cite>/gi, '')
    .replace(/## [^\n]+\n?/g, '\n')
    .replace(/# [^\n]+\n?/g, '\n')
    .replace(/\*\*/g, '')
    .replace(/biena([^l])/g, 'bienal$1')
    .replace(/\s{3,}/g, '\n\n')
    .trim()
    .slice(0, 900);
  const caption = (postData.instagram_caption || '').replace(/<[^>]*>/g, '').slice(0, 250);
  await send(chatId, '📝 *' + title + '*\n\n' + body + '...');
  await new Promise(r => setTimeout(r, 500));
  if (caption) await send(chatId, '📌 _Caption:_\n' + caption);

  // 3. Thumbnail
  await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(4, 10) + '\n_Generando thumbnail..._');
  if (postData.thumbnail_prompt) {
    const thumbUrl = await grokImg(postData.thumbnail_prompt);
    if (thumbUrl) await photo(chatId, thumbUrl, '🖼 Thumbnail Substack');
  }

  // 4. Slides — use from API or generate defaults
  const slideUrls = [];
  const apiSlides = (postData.slides || []).map(s => s?.prompt).filter(Boolean);
  const t = (postData.title || topic).toUpperCase().slice(0, 40);
  const T = (postData.title || topic).toUpperCase().slice(0, 38);
  const TL = (postData.title || topic);
  const defaultPrompts = [
    'Square 1:1 format editorial Instagram slide. Dark background #080808. ALL text and elements MUST stay strictly inside a 120px safe margin from every edge — nothing touches the borders. Background: faint transparent ghost image related to ' + TL + ' at 12% opacity, slightly blurred, perfectly centered, subtle film grain and soft cinematic vignette. Inside top-left safe zone: small caps label in muted dark gray #333333. Inside safe zone left-aligned: bold condensed Bebas Neue white text massive 3 lines: ' + T + '. Inside bottom-left safe zone: small muted gray subtext. Inside bottom-right safe zone: 01/07 very faint gray. No watermarks, no text outside 120px margins. Dark cinematic mood high contrast contemporary editorial poster.',
    'Square 1:1 format editorial Instagram slide. Clean white off-white background #f5f5f0. ALL text strictly inside 120px safe margin from every edge. Background: faint large decorative symbol 4% opacity centered dark gray. Subtle film grain texture overlay. Inside safe zone left-aligned: bold condensed Bebas Neue black text massive 3-4 lines: key paradox or shocking fact about ' + T + '. Inside bottom-left safe zone: small caps caption light gray. Inside bottom-right safe zone: 02/07 faint gray. No watermarks, no text outside 120px margins. High contrast editorial magazine style.',
    'Square 1:1 format editorial Instagram slide. Near black background #080808. ALL text strictly inside 120px safe margin from every edge. Background: faint transparent architectural or cultural space image 10% opacity blurred film grain cinematic vignette. Thin vertical white line 2px on left side inside safe zone gradient fade top and bottom. Inside top-left safe zone: small caps dark gray label. Inside safe zone: massive bold Bebas Neue white number or stat enormous, below descriptor word large. Inside bottom safe zone: small gray descriptive text. Inside bottom-right: 03/07 faint. No watermarks. Dark cinematic.',
    'Square 1:1 format editorial Instagram slide. Near black background #080808. ALL text strictly inside 120px safe margin from every edge. Background: very faint large quotation mark symbol 3% opacity decorative top-left. Subtle film grain vignette. Inside safe zone vertically centered: large italic serif quote text light gray #cccccc — a real insightful quote about ' + TL + '. Inside bottom-left safe zone: small caps dark gray attribution. Inside bottom-right: 04/07 faint gray. No watermarks. Cinematic editorial mood.',
    'Square 1:1 format editorial Instagram slide. Near black background #080808. ALL elements strictly inside 120px safe margin from every edge. Subtle film grain overlay. Inside safe zone: 2x2 brutalist grid 4 equal dark gray cells #0d0d0d with 3px gap. Each cell has small caps label top and bold condensed white text concept from ' + TL + '. Grid completely inside 120px margins. No watermarks. Brutalist editorial dark design.',
    'Square 1:1 format editorial Instagram slide. Clean white off-white background #f5f5f0. ALL text strictly inside 120px safe margin from every edge. Subtle light film grain. Inside safe zone centered: massive bold condensed Bebas Neue 4 lines centered — provocative open question about ' + TL + ' alternating deep black and italic medium gray #666666. Below centered: small gray context text. Inside bottom-right: 06/07 very faint gray. No watermarks. Minimalist powerful typography poster style.',
    'Square 1:1 format editorial Instagram slide. Near black background #080808. ALL text strictly inside 120px safe margin from every edge. Background: very faint abstract city nervous system pattern 5% opacity light gray film grain cinematic vignette. Inside top-left safe zone: small caps dark gray REFLEXIÓN. Inside safe zone left-aligned: large bold Bebas Neue white text conclusion about ' + TL + ' 2-3 lines. Inside bottom-left safe zone: small dark gray @maarmapa.eth. Inside bottom-right safe zone: very dark gray stacked hashtags. No watermarks. Dark cinematic editorial finale.'
  
  ];
  const finalPrompts = apiSlides.length >= 7 ? apiSlides : defaultPrompts;
  for (let i = 0; i < Math.min(finalPrompts.length, 7); i++) {
    await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(4 + i, 10) + '\n_📸 Slide ' + (i+1) + '/7..._');
    const url = await grokImg(finalPrompts[i]);
    if (url) { slideUrls.push(url); await photo(chatId, url, 'Slide ' + (i+1) + '/7'); }
  }

  await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(9, 10) + '\n_' + slideUrls.length + ' slides listos_');

  // 5. Runway clips (optional)
  let clips = 0;
  if (process.env.RUNWAY_KEY && slideUrls.length > 0) {
     const motions = [
       'Instagram Reel editorial transition. Slide starts static and sharp — headline text fully legible. After 1 second: text slides out left with motion blur while new background element fades in. Typography always readable at start and end frames. Dark cinematic editorial. Coherent design throughout.',
       'Instagram Reel editorial transition. White slide starts sharp — black headline fully legible. After 1 second: text scales up dramatically and blurs out while slide brightens to overexposed white. Clean typographic impact. Start and end frames sharp and designed.',
       'Instagram Reel editorial transition. Dark slide starts static — number and stats fully legible. After 1 second: numbers animate counting up fast then blur. Vertical white line slides in from left with energy. Cinematic editorial motion. Legible at start and end.',
       'Instagram Reel editorial transition. Quote slide starts static — italic text fully readable centered. After 1 second: text fades and drifts upward slowly like smoke. Contemplative mood. Background deepens to black. Poetic editorial motion. Legible at start.',
       'Instagram Reel editorial transition. Grid slide starts static — all 4 cells legible. After 1 second: cells flash sequentially like a reveal animation. Each cell highlights then dims. Brutalist editorial rhythm. All text readable at start frame.',
       'Instagram Reel editorial transition. White slide starts static — question text fully legible centered. After 1 second: letters scatter outward from center like an explosion. Question mark stays last. Clean kinetic typography. Legible at start frame.',
       'Instagram Reel editorial transition. Dark finale slide starts static — handle and hashtags legible. After 1 second: background city pattern brightens and pulses. Text holds sharp. Slow cinematic fade. Editorial brand moment. @maarmapa.eth clear and readable throughout.'
     ];
    ];
    for (let i = 0; i < Math.min(slideUrls.length, 7); i++) {
      await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(9, 10) + '\n_🎬 Clip ' + (i+1) + '/' + slideUrls.length + ' Runway..._');
      const vid = await runwayVideo(slideUrls[i], motions[i]);
      if (vid) { await video(chatId, vid, '🎬 Clip ' + (i+1)); clips++; }
    }
  }

  await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(10, 10) + '\n✅ *Completado*');
  await send(chatId, '✅ *Listo*\n📸 Slides: ' + slideUrls.length + '\n🎬 Clips: ' + clips);
}

// Commands
async function handle(msg) {
  const chatId = msg.chat.id;
  const text = msg.text || '';

  if (text === '/start') {
    await send(chatId, '🎨 *maarmapa factory*\n\n`/post [tema]` — contenido completo\n`/buscar [query]` — busca en X/Twitter\n`/chat [pregunta]` — habla con el agente\n`/digest` — digest semanal');
    return;
  }


  if (text.startsWith('/anime ')) {
    const concept = text.replace('/anime ', '');
    runAnime(chatId, concept).catch(e => send(chatId, '❌ ' + e.message));
    return;
  }

  if (text.startsWith('/post ')) {
    runFactory(chatId, text.replace('/post ', '')).catch(e => send(chatId, '❌ ' + e.message));
    return;
  }

  if (text.startsWith('/buscar ')) {
    const query = text.replace('/buscar ', '');
    const msgId = await send(chatId, '🔍 _Buscando: ' + query + '..._');
    try {
      const res = await fetch(AGENT_URL + '/grok', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
      const d = await res.json();
      await edit(chatId, msgId, (d.reply || 'Sin resultados').slice(0, 4000));
    } catch(e) { await edit(chatId, msgId, '❌ ' + e.message); }
    return;
  }

  if (text.startsWith('/chat ')) {
    const q = text.replace('/chat ', '');
    const msgId = await send(chatId, '💬 _Pensando..._');
    try {
      const res = await fetch(AGENT_URL + '/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: q }] }) });
      const d = await res.json();
      await edit(chatId, msgId, (d.reply || '...').slice(0, 4000));
    } catch(e) { await edit(chatId, msgId, '❌ ' + e.message); }
    return;
  }

  if (text === '/digest') {
    const msgId = await send(chatId, '📰 _Generando digest..._');
    try {
      const res = await fetch(AGENT_URL + '/digest');
      const d = await res.json();
      await edit(chatId, msgId, (d.digest || 'Error').slice(0, 4000));
    } catch(e) { await edit(chatId, msgId, '❌ ' + e.message); }
    return;
  }

  if (text && !text.startsWith('/')) {
    await send(chatId, '💡 `/post ' + text.slice(0,30) + '` para contenido\n`/buscar ' + text.slice(0,30) + '` para noticias\n`/chat ' + text.slice(0,30) + '` para preguntar');
  }
}


// ── ANIME FACTORY ─────────────────────────────────────
async function runAnime(chatId, concept) {
  const msgId = await send(chatId, '🎬 *maarmapa anime factory*
[░░░░░░░░░░] 0%
_Iniciando..._');

  // Step 1: Claude genera personajes + prompts
  await edit(chatId, msgId, '🎬 *maarmapa anime factory*
[██░░░░░░░░] 20%
_Claude diseñando personajes..._');

  let characters;
  try {
    const res = await fetch(AGENT_URL + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: `Generate 3 anime character image prompts for this concept: "${concept}". 
        
        Return ONLY valid JSON array with 3 objects, no markdown:
        [
          {"character": "name", "role": "role description", "prompt": "detailed grok image prompt for 2D anime cel-shading character, thick black outlines, full body, white background, urban streetwear ninja style, dark palette with neon accents"},
          {"character": "name", "role": "role description", "prompt": "..."},
          {"character": "name", "role": "role description", "prompt": "..."}
        ]
        
        Each prompt must be detailed, in English, specify: 2D anime cel-shading, thick black outlines, full body character, white background, specific colors and accessories matching the concept.` }]
      })
    });
    const data = await res.json();
    const raw = (data.reply || '').replace(/```json|```/g, '').trim();
    characters = JSON.parse(raw);
  } catch(e) {
    await edit(chatId, msgId, '❌ Error generando personajes: ' + e.message);
    return;
  }

  await edit(chatId, msgId, '🎬 *maarmapa anime factory*
[████░░░░░░] 40%
_' + characters.length + ' personajes diseñados ✅_');
  await send(chatId, '🎨 *Personajes:*
' + characters.map((c,i) => (i+1) + '. *' + c.character + '* — ' + c.role).join('
'));

  // Step 2: Grok genera imágenes de los personajes
  const characterImages = [];
  for (let i = 0; i < characters.length; i++) {
    await edit(chatId, msgId, '🎬 *maarmapa anime factory*
[' + '█'.repeat(4+i) + '░'.repeat(6-i) + '] ' + (40+i*15) + '%
_🎨 Generando ' + characters[i].character + '..._');
    const url = await grokImg(characters[i].prompt);
    if (url) {
      characterImages.push({ ...characters[i], url });
      await photo(chatId, url, '🎨 ' + characters[i].character + ' — ' + characters[i].role);
    }
  }

  await edit(chatId, msgId, '🎬 *maarmapa anime factory*
[███████░░░] 70%
_' + characterImages.length + ' imágenes listas ✅_');

  // Step 3: Runway anima cada personaje
  const motionPrompts = [
    'Anime character animation. Character starts in static pose fully visible. After 1 second: dramatic movement begins — fast action with motion blur on limbs, energy lines radiating outward, cel-shading style maintained. Urban hip-hop energy. Beat-driven motion. Character stays in frame.',
    'Anime character animation. Character holds mic or instrument pose clearly visible. After 1 second: performance animation — head nodding to beat, arm gestures, steam/smoke effects appear around character. Cinematic urban noir mood. Fluid anime motion.',
    'Anime character animation. Character in ready stance fully visible. After 1 second: explosive movement — spin, jump or breakdance move with dramatic motion blur, particles and energy burst effects. High energy finale. Anime style maintained throughout.'
  ];

  const clips = [];
  for (let i = 0; i < Math.min(characterImages.length, 3); i++) {
    await edit(chatId, msgId, '🎬 *maarmapa anime factory*
[████████░░] ' + (70+i*10) + '%
_🎬 Animando ' + characterImages[i].character + ' con Runway..._');
    const vid = await runwayVideo(characterImages[i].url, motionPrompts[i]);
    if (vid) {
      clips.push(vid);
      await video(chatId, vid, '🎬 ' + characterImages[i].character);
    }
  }

  await edit(chatId, msgId, '🎬 *maarmapa anime factory*
[██████████] 100%
✅ *Completado*');
  await send(chatId, '✅ *Anime listo*

🎨 Personajes: ' + characterImages.length + '/3
🎬 Clips: ' + clips.length + '/3

_Une los clips en CapCut para el video final. Ratio: 720:1280_');
}

// Polling
async function poll() {
  console.log('maarmapa bot v3 started');
  let offset = 0;
  while (true) {
    try {
      const res = await fetch('https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/getUpdates?offset=' + offset + '&timeout=30');
      const d = await res.json();
      for (const u of d.result || []) {
        offset = u.update_id + 1;
        if (u.message) handle(u.message).catch(e => console.error('Handle error:', e.message));
      }
    } catch(e) {
      console.error('Poll error:', e.message);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

// HTTP server for Render
require('http').createServer((q, s) => { s.writeHead(200); s.end('ok'); }).listen(process.env.PORT || 3000);
poll();