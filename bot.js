// maarmapa — Telegram Bot v4
const AGENT_URL = process.env.AGENT_URL || 'https://maarmapa-agent.onrender.com';
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;

// ── TELEGRAM ──────────────────────────────────────────
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
  const f = Math.round((n / total) * 10);
  return '[' + '█'.repeat(f) + '░'.repeat(10 - f) + '] ' + Math.round((n / total) * 100) + '%';
}

// ── GROK IMAGE ────────────────────────────────────────
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

// ── RUNWAY ────────────────────────────────────────────
async function runwayVideo(imageUrl, prompt) {
  if (!process.env.RUNWAY_KEY) return null;
  try {
    const res = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.RUNWAY_KEY,
        'X-Runway-Version': '2024-11-06'
      },
      body: JSON.stringify({ model: 'gen4_turbo', promptImage: imageUrl, promptText: prompt, ratio: '720:1280', duration: 3 })
    });
    const text = await res.text();
    console.log('Runway:', text.slice(0, 150));
    let d;
    try { d = JSON.parse(text); } catch(e) { return null; }
    if (!d.id) { console.error('Runway no id:', JSON.stringify(d).slice(0, 100)); return null; }
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
    return null;
  } catch(e) { console.error('Runway error:', e.message); return null; }
}

// ── WAKE AGENT ────────────────────────────────────────
async function wakeAgent(chatId, msgId) {
  for (let i = 0; i < 10; i++) {
    try {
      const r = await fetch(AGENT_URL + '/');
      const t = await r.text();
      if (t.includes('maarmapa agent')) return true;
    } catch(e) {}
    await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(1, 10) + '\n_Despertando agente ' + (i + 1) + '/10..._');
    await new Promise(r => setTimeout(r, 8000));
  }
  return false;
}

// ── POST FACTORY ──────────────────────────────────────
async function runFactory(chatId, topic) {
  const msgId = await send(chatId, '🏭 *maarmapa factory*\n' + bar(0, 10) + '\n_Iniciando..._');

  const awake = await wakeAgent(chatId, msgId);
  if (!awake) {
    await edit(chatId, msgId, '❌ Agente no responde. Intenta en 1 minuto.');
    return;
  }

  await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(2, 10) + '\n_Claude generando texto..._');

  let postData;
  try {
    const fetchPost = fetch(AGENT_URL + '/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic })
    });
    const labels = ['Claude buscando', 'Claude escribiendo', 'Claude refinando', 'Claude terminando'];
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 8000));
      await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(2, 10) + '\n_' + labels[i % labels.length] + '..._');
      try {
        const res = await fetchPost;
        const raw = await res.json();
        postData = raw.post || raw;
        break;
      } catch(e) {}
    }
    if (!postData) {
      const res = await fetchPost;
      const raw = await res.json();
      postData = raw.post || raw;
    }
  } catch(e) {
    await edit(chatId, msgId, '❌ Error: ' + e.message);
    return;
  }

  await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(3, 10) + '\n_✅ Texto listo_');

  const title = (postData.title || topic).slice(0, 120);
  const body = (postData.body || '')
    .replace(/<cite[^>]*>[\s\S]*?<\/cite>/gi, '')
    .replace(/## [^\n]+\n?/g, '\n')
    .replace(/# [^\n]+\n?/g, '\n')
    .replace(/\*\*/g, '')
    .replace(/\s{3,}/g, '\n\n')
    .trim()
    .slice(0, 900);
  const caption = (postData.instagram_caption || '').replace(/<[^>]*>/g, '').slice(0, 250);

  await send(chatId, '📝 *' + title + '*\n\n' + body + '...');
  await new Promise(r => setTimeout(r, 500));
  if (caption) await send(chatId, '📌 _Caption:_\n' + caption);

  // Thumbnail
  await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(4, 10) + '\n_Generando thumbnail..._');
  if (postData.thumbnail_prompt) {
    const thumbUrl = await grokImg(postData.thumbnail_prompt);
    if (thumbUrl) await photo(chatId, thumbUrl, '🖼 Thumbnail Substack');
  }

  // Slides
  const slideUrls = [];
  const apiSlides = (postData.slides || []).map(s => s?.prompt).filter(Boolean);
  const T = (postData.title || topic).toUpperCase().slice(0, 38);
  const TL = (postData.title || topic);
  const defaultPrompts = [
    'Square 1:1 format editorial Instagram slide. Dark background #080808. ALL text strictly inside 120px safe margin from every edge. Background: faint ghost image related to ' + TL + ' 12% opacity blurred film grain cinematic vignette. Top-left small caps dark gray ARTE CONTEMPORANEO ABRIL 2026. Bold condensed Bebas Neue white text left-aligned: ' + T + ' 3 lines massive. Bottom left small muted gray subtext. Bottom right 01/07 faint. No watermarks. Dark cinematic editorial.',
    'Square 1:1 format editorial Instagram slide. White background #f5f5f0. ALL text strictly inside 120px safe margin. Background: faint decorative symbol 4% opacity dark gray. Film grain. Bold condensed Bebas Neue black text left-aligned: key paradox about ' + TL + ' 3 lines massive. Bottom left small caps light gray. Bottom right 02/07 faint. No watermarks. High contrast editorial.',
    'Square 1:1 format editorial Instagram slide. Near black background. ALL text strictly inside 120px safe margin. Background: faint architecture 10% opacity film grain vignette. Thin vertical white line left side. Top small caps dark gray. Massive Bebas Neue white: key stat or number from ' + TL + '. Bottom small gray text. 03/07 faint. Dark cinematic.',
    'Square 1:1 format editorial Instagram slide. Near black background. ALL text strictly inside 120px safe margin. Background: faint quotation mark 3% opacity. Film grain. Large italic serif quote light gray centered about ' + TL + '. Bottom attribution small caps dark gray. 04/07 faint. Cinematic editorial.',
    'Square 1:1 format editorial Instagram slide. Near black background. ALL inside 120px safe margins. Film grain. 2x2 brutalist grid 4 dark gray cells 3px gap. Each cell: small label, bold condensed white text key concept from ' + TL + '. No watermarks. Brutalist editorial.',
    'Square 1:1 format editorial Instagram slide. White background #f5f5f0. ALL text strictly inside 120px safe margin. Light film grain. Centered: massive Bebas Neue 4 lines — provocative question about ' + TL + ' alternating black and italic gray. Below small gray text. 06/07 faint. Minimalist powerful.',
    'Square 1:1 format editorial Instagram slide. Near black background. ALL text strictly inside 120px safe margin. Background: faint urban pattern 5% opacity film grain vignette. Top left small caps REFLEXION. Bold Bebas Neue white: final statement 2 lines. Bottom left @maarmapa.eth dark gray. Bottom right hashtags very dark. 07/07. Dark cinematic finale.'
  ];
  const finalPrompts = apiSlides.length >= 7 ? apiSlides : defaultPrompts;

  for (let i = 0; i < Math.min(finalPrompts.length, 7); i++) {
    await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(4 + i, 10) + '\n_📸 Slide ' + (i + 1) + '/7..._');
    const url = await grokImg(finalPrompts[i]);
    if (url) { slideUrls.push(url); await photo(chatId, url, 'Slide ' + (i + 1) + '/7'); }
  }

  await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(9, 10) + '\n_' + slideUrls.length + ' slides listos_');

  // Runway clips
  let clips = 0;
  if (process.env.RUNWAY_KEY && slideUrls.length > 0) {
    const motions = [
      'Instagram Reel editorial. Slide starts static fully legible. Text slides out left with motion blur after 1s. Dark cinematic editorial.',
      'Editorial reel. White slide sharp. Text scales up dramatically then blurs. Clean typographic impact.',
      'Editorial reel. Dark slide static legible. Numbers animate fast then blur. Vertical line slides in with energy.',
      'Editorial reel. Quote static readable. Text fades upward like smoke. Contemplative cinematic mood.',
      'Editorial reel. Grid static legible. Cells flash sequentially. Brutalist editorial rhythm.',
      'Editorial reel. White slide static. Letters scatter outward like explosion. Kinetic typography.',
      'Editorial reel. Dark finale. Background pulses. Text sharp throughout. @maarmapa.eth clear. Cinematic fade.'
    ];
    for (let i = 0; i < Math.min(slideUrls.length, 7); i++) {
      await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(9, 10) + '\n_🎬 Clip ' + (i + 1) + '/' + slideUrls.length + ' Runway..._');
      const vid = await runwayVideo(slideUrls[i], motions[i]);
      if (vid) { await video(chatId, vid, '🎬 Clip ' + (i + 1)); clips++; }
    }
  }

  await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(10, 10) + '\n✅ *Completado*');
  await send(chatId, '✅ *Listo*\n📸 Slides: ' + slideUrls.length + '\n🎬 Clips: ' + clips);
}

// ── ANIME FACTORY ─────────────────────────────────────
async function runAnime(chatId, concept) {
  const msgId = await send(chatId, '🎬 *maarmapa anime factory*\n' + bar(0, 10) + '\n_Iniciando..._');

  await edit(chatId, msgId, '🎬 *maarmapa anime factory*\n' + bar(1, 10) + '\n_Despertando agente..._');
  const awake = await wakeAgent(chatId, msgId);
  if (!awake) {
    await edit(chatId, msgId, '❌ Agente no responde.');
    return;
  }

  await edit(chatId, msgId, '🎬 *maarmapa anime factory*\n' + bar(2, 10) + '\n_Claude diseñando personajes..._');

   // CHARACTER BIBLES — Shaolin Ninja Distópico Tokio/Kyoto 80s
   const BASE_CHAR = 'Hyper-detailed anime illustration. Katsuhiro Otomo Akira meets Ninja Gaiden meets Shaw Brothers kung fu films. Cel-shading thick bold ink outlines. Full body character sheet front and 3/4 view. White background. Mature dark gritty cinematic style. NOT kawaii NOT chibi NOT cute. Hard dramatic shadows. Dystopian 1980s Tokyo Kyoto Osaka neon atmosphere embedded in character design.';
   const characters = [
     {
       character: 'Andino',
       role: 'Beatmaker Ninja',
       prompt: BASE_CHAR + ' ANDINO — full black ninja suit covering entire body and face, only eyes visible, crimson red clan markings on chest and arms, oversized red headphones worn over ninja hood, portable MPC drum machine strapped to forearm like a weapon. Calm focused assassin expression through mask. Athletic warrior build. Shuriken stars attached to belt. Crimson red neon accent color. Clan symbol: red circle on chest.'
     },
     {
       character: 'Piero',
       role: 'MC Ninja',
       prompt: BASE_CHAR + ' PIERO — full dark navy ninja suit covering entire body and face, only sharp eyes visible behind round wire glasses worn over mask, gold clan markings on shoulders, holding microphone like a ceremonial weapon raised high. Slim agile warrior build. Scrolls and throwing stars at waist. Gold neon accent color. Clan symbol: gold diamond on chest. Battle stance, one hand forward.'
     },
     {
       character: 'Kinny',
       role: 'Dancer Ninja',
       prompt: BASE_CHAR + ' KINNY — full deep teal ninja suit covering entire body and face, only fierce eyes visible, electric blue clan markings on legs and arms, athletic explosive build, mid-air breakdance kick pose — one leg extended, arms out, pure kinetic energy. Shuriken stars orbiting around him. Electric blue neon accent. Clan symbol: blue lightning bolt on chest. Maximum dynamic movement.'
     }
   ];
  await edit(chatId, msgId, '🎬 *maarmapa anime factory*\n' + bar(3, 10) + '\n_' + characters.length + ' personajes ✅_');
  await send(chatId, '🎨 *Personajes:*\n' + characters.map((c, i) => (i + 1) + '. *' + c.character + '* — ' + c.role).join('\n'));

  // Grok genera imágenes
  const characterImages = [];
  for (let i = 0; i < characters.length; i++) {
    await edit(chatId, msgId, '🎬 *maarmapa anime factory*\n' + bar(3 + i, 10) + '\n_🎨 ' + characters[i].character + '..._');
    const url = await grokImg(characters[i].prompt);
    if (url) {
      characterImages.push({ ...characters[i], url });
      await photo(chatId, url, '🎨 ' + characters[i].character + ' — ' + characters[i].role);
    }
  }

  await edit(chatId, msgId, '🎬 *maarmapa anime factory*\n' + bar(7, 10) + '\n_' + characterImages.length + ' imágenes listas ✅_');

  // Runway anima
  // 3 CINEMATIC SCENES — Wu-Tang x Shaolin x Ninja Gaiden x Akira
  // Each scene uses character bibles for consistency
  const BASE_STYLE = 'Hyper-detailed anime. Katsuhiro Otomo Akira meets Ninja Gaiden meets Shaw Brothers. Cel-shading thick bold ink outlines. Mature dark gritty cinematic. NOT kawaii NOT chibi NOT cute. Hard shadows film grain. Dystopian 1980s Tokyo Kyoto Osaka — neon kanji signs, rain-soaked stone streets, pagoda rooftops meets cyberpunk towers, paper lanterns mixed with neon billboards, ancient temple gates under electric rain. Vertical 9:16 format. ALL elements strictly inside 120px safe margin every edge. No cropping.';
  const scenePrompts = [
    BASE_STYLE + ' SHOT 1 — ANDINO THE BEATMAKER NINJA. Low angle orbit shot. Full black ninja suit face covered, crimson red headphones over ninja hood, MPC strapped to forearm glowing red. Crouching on ancient temple rooftop in dystopian Kyoto, neon kanji signs and pagoda towers below in the rain, red lightning strikes. Shuriken stars orbiting around him slowly. Camera rotates 360 degrees around him at low angle. Crimson red neon light. Epic cinematic IMAX quality.',
    BASE_STYLE + ' SHOT 2 — PIERO AND KINNY NINJA ACTION. 180 degree tracking arc. PIERO: dark navy ninja suit face covered, glasses over mask, microphone raised as weapon — center frame. KINNY: teal ninja suit face covered, mid-air explosive breakdance kick, shuriken stars orbiting, motion blur speed lines. Both fully inside safe margins. Rain-soaked narrow Osaka stone alley at night, paper lanterns overhead, neon kanji billboards on walls reflecting on wet cobblestones. Gold and electric blue neon clash. Ancient temple gate visible at end of alley. Epic kinetic warrior energy.',
    BASE_STYLE + ' SHOT 3 — SOUTH SIDE CRIMINI SQUAD FINALE. Epic top-down descent. ANDINO + PIERO + KINNY — all in full ninja suits — tight triangle on ancient wet stone plaza, neon reflections rippling, shuriken stars spinning around all three. Piero raises fist — massive energy corona burst. Shaolin dragon symbol glowing in the stone beneath them. Yin yang symbol expanding outward. Massive bold red glitch kanji typography SOUTH SIDE CRIMINI 南 centered inside safe zone. Dystopian Tokyo pagoda towers surrounding the plaza. Ultimate anime poster.'
  ];

  // Runway motion prompts — Wu-Tang energy, Akira cinematics
  const motions = [
    'Akira-style cinematic. Camera orbits slowly around the beatmaker in a 360-degree arc, rising from low angle. Red neon lightning strikes dramatically once. Rain particles streak across frame. MPC drum machine glows red. Urban city below pulses with neon. Beat-driven rhythmic camera movement. Hard cuts on the beat.',
    'Dynamic 180-degree tracking arc. Camera sweeps fast around both characters. Dancer spin accelerates with extreme motion blur. MC raises mic higher as camera passes. Steam jets from grates in slow motion bursts. Kanji graffiti on walls illuminated briefly by passing spotlight. Fast Wu-Tang hip-hop energy. Rapid kinetic movement.',
    'Epic top-down drone descent. Camera plunges fast from high above. Three warriors below get larger as camera falls. Energy burst corona expands outward in rings. Neon reflections ripple on wet asphalt. Shaolin symbol glows beneath feet. White flash freeze frame. Title text SOUTH SIDE CRIMINI glitches in red. Anime poster hold.'
  ];

  const clips = [];
  for (let i = 0; i < 3; i++) {
    await edit(chatId, msgId, '🎬 *maarmapa anime factory*\n' + bar(7 + i, 10) + '\n_🎨 Shot ' + (i + 1) + '/3 — Grok generando escena..._');
    const sceneUrl = await grokImg(scenePrompts[i]);
    if (sceneUrl) {
      await photo(chatId, sceneUrl, '🎨 Shot ' + (i + 1) + '/3');
      await edit(chatId, msgId, '🎬 *maarmapa anime factory*\n' + bar(7 + i, 10) + '\n_🎬 Shot ' + (i + 1) + '/3 — Runway animando..._');
      const vid = await runwayVideo(sceneUrl, motions[i]);
      if (vid) { clips.push(vid); await video(chatId, vid, '🎬 Shot ' + (i + 1) + '/3'); }
    }
  }

  await edit(chatId, msgId, '🎬 *maarmapa anime factory*\n' + bar(10, 10) + '\n✅ *Completado*');
  await send(chatId, '✅ *Anime listo*\n🎨 Personajes: ' + characterImages.length + '/3\n🎬 Clips: ' + clips.length + '/3\n_Une en CapCut para el video final._');
}

// ── COMMANDS ──────────────────────────────────────────
async function handle(msg) {
  const chatId = msg.chat.id;
  const text = msg.text || '';

  if (text === '/start') {
    await send(chatId, '🎨 *maarmapa factory*\n\n`/post [tema]` — contenido completo\n`/anime [concepto]` — video anime\n`/buscar [query]` — noticias\n`/chat [pregunta]` — agente\n`/digest` — digest semanal');
    return;
  }

  if (text.startsWith('/post ')) {
    runFactory(chatId, text.replace('/post ', '')).catch(e => send(chatId, '❌ ' + e.message));
    return;
  }

  if (text.startsWith('/anime ')) {
    runAnime(chatId, text.replace('/anime ', '')).catch(e => send(chatId, '❌ ' + e.message));
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
    await send(chatId, '💡 `/post ' + text.slice(0, 30) + '` — contenido\n`/anime ' + text.slice(0, 30) + '` — video\n`/buscar ' + text.slice(0, 30) + '` — noticias');
  }
}

// ── POLLING ───────────────────────────────────────────
async function poll() {
  console.log('maarmapa bot v4 started');
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

// ── HTTP SERVER ───────────────────────────────────────
require('http').createServer((q, s) => { s.writeHead(200); s.end('maarmapa bot v4 online'); }).listen(process.env.PORT || 3000);
poll();