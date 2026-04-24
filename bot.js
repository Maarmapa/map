// maarmapa — Telegram Bot v5
// Claude + Grok + Runway + Seedance + DeepSeek
const AGENT_URL = process.env.AGENT_URL || 'https://maarmapa-agent.onrender.com';
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENROUTER_KEY = process.env.OPENROUTER_KEY;

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
async function sendDoc(chatId, url, caption) {
  try { await tg('sendDocument', { chat_id: chatId, document: url, caption }); } catch(e) {}
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
  } catch(e) { console.error('Grok error:', e.message); return null; }
}

// ── RUNWAY ────────────────────────────────────────────
async function runwayVideo(imageUrl, prompt, duration) {
  if (!process.env.RUNWAY_KEY) return null;
  try {
    const res = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.RUNWAY_KEY, 'X-Runway-Version': '2024-11-06' },
      body: JSON.stringify({ model: 'gen4_turbo', promptImage: imageUrl, promptText: prompt, ratio: '720:1280', duration: duration || 3 })
    });
    const text = await res.text();
    let d; try { d = JSON.parse(text); } catch(e) { return null; }
    if (!d.id) { console.error('Runway no id:', JSON.stringify(d).slice(0, 100)); return null; }
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 10000));
      const p = await fetch('https://api.dev.runwayml.com/v1/tasks/' + d.id, {
        headers: { 'Authorization': 'Bearer ' + process.env.RUNWAY_KEY, 'X-Runway-Version': '2024-11-06' }
      });
      const t = await p.json();
      if (t.status === 'SUCCEEDED') return t.output?.[0] || null;
      if (t.status === 'FAILED') { console.error('Runway failed:', t.failure); return null; }
    }
    return null;
  } catch(e) { console.error('Runway error:', e.message); return null; }
}

// ── SEEDANCE via OPENROUTER ───────────────────────────
async function seedanceVideo(prompt, imageUrl, audioUrl) {
  if (!OPENROUTER_KEY) return null;
  try {
    const body = {
      model: 'bytedance/seedance-2.0-fast',
      prompt,
      duration: 8,
      aspect_ratio: '9:16',
      resolution: '1080p'
    };
    if (imageUrl) body.image_url = imageUrl;
    if (audioUrl) body.audio_url = audioUrl;

    const res = await fetch('https://openrouter.ai/api/v1/videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + OPENROUTER_KEY }
    });
    const d = await res.json();
    if (!d.id) { console.error('Seedance no id:', JSON.stringify(d).slice(0,200)); return null; }

    // Poll
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 10000));
      const p = await fetch('https://openrouter.ai/api/v1/videos/' + d.id, {
        headers: { 'Authorization': 'Bearer ' + OPENROUTER_KEY }
      });
      const t = await p.json();
      console.log('Seedance poll:', t.status);
      if (t.status === 'succeeded') return t.output?.url || null;
      if (t.status === 'failed') return null;
    }
    return null;
  } catch(e) { console.error('Seedance error:', e.message); return null; }
}

// ── DEEPSEEK via OPENROUTER ───────────────────────────
async function deepseek(prompt, system) {
  if (!OPENROUTER_KEY) return null;
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + OPENROUTER_KEY },
      body: JSON.stringify({
        model: 'deepseek/deepseek-v4-pro',
        max_tokens: 4096,
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt }
        ]
      })
    });
    const d = await res.json();
    return d.choices?.[0]?.message?.content || null;
  } catch(e) { console.error('DeepSeek error:', e.message); return null; }
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
  if (!awake) { await edit(chatId, msgId, '❌ Agente no responde. Intenta en 1 minuto.'); return; }

  await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(2, 10) + '\n_Generando post..._');

  let postData;
  try {
    // Try DeepSeek first (cheaper), fallback to agent
    const dsSystem = 'Eres un escritor editorial experto para maarmapa — artista urbano chileno contemporáneo. Genera posts completos para Substack sobre arte, cultura, marketing, blockchain y ciudades. Busca información real y actual. Escribe en español, estilo editorial inteligente. Devuelve JSON: {"title":"...","body":"...","instagram_caption":"...","thumbnail_prompt":"..."}';
    let raw = await deepseek('Genera un post completo de Substack sobre: ' + topic, dsSystem);

    if (raw) {
      try {
        raw = raw.replace(/```json|```/g, '').trim();
        postData = JSON.parse(raw);
        await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(3, 10) + '\n_✅ Post generado con DeepSeek_');
      } catch(e) { postData = { title: topic, body: raw, instagram_caption: '' }; }
    } else {
      // Fallback to agent
      const res = await fetch(AGENT_URL + '/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic })
      });
      const r = await res.json();
      postData = r.post || r;
      await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(3, 10) + '\n_✅ Post generado_');
    }
  } catch(e) { await edit(chatId, msgId, '❌ Error: ' + e.message); return; }

  // Send text
  const title = (postData.title || topic).slice(0, 120);
  const body = (postData.body || '')
    .replace(/<cite[^>]*>[\s\S]*?<\/cite>/gi, '')
    .replace(/## [^\n]+\n?/g, '\n').replace(/# [^\n]+\n?/g, '\n')
    .replace(/\*\*/g, '').replace(/\s{3,}/g, '\n\n').trim().slice(0, 900);
  const caption = (postData.instagram_caption || '').replace(/<[^>]*>/g, '').slice(0, 250);
  await send(chatId, '📝 *' + title + '*\n\n' + body + '...');
  if (caption) await send(chatId, '📌 _Caption:_\n' + caption);

  // Thumbnail
  await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(4, 10) + '\n_🖼 Thumbnail..._');
  if (postData.thumbnail_prompt) {
    const thumbUrl = await grokImg(postData.thumbnail_prompt);
    if (thumbUrl) await photo(chatId, thumbUrl, '🖼 Thumbnail Substack');
  }

  // 7 Slides
  const T = (postData.title || topic).toUpperCase().slice(0, 38);
  const TL = postData.title || topic;
  const defaultPrompts = [
    'Square 1:1 editorial Instagram. Dark #080808. Safe zone 120px all sides. Ghost image related to ' + TL + ' 12% opacity film grain vignette. Bebas Neue white left-aligned: ' + T + ' 3 lines massive. 01/07 faint. Dark cinematic editorial.',
    'Square 1:1 editorial Instagram. White #f5f5f0. Safe zone 120px all sides. Film grain. Bebas Neue black: key paradox about ' + TL + ' 3 lines massive. 02/07. High contrast editorial.',
    'Square 1:1 editorial Instagram. Dark. Safe zone 120px all sides. Architecture 10% opacity film grain. Vertical white line left. Massive Bebas Neue white stat from ' + TL + '. 03/07. Dark cinematic.',
    'Square 1:1 editorial Instagram. Dark. Safe zone 120px all sides. Quotation mark 3% opacity. Italic serif quote light gray about ' + TL + '. Attribution small dark gray. 04/07. Cinematic.',
    'Square 1:1 editorial Instagram. Dark. Safe zone 120px all sides. 2x2 brutalist grid 4 dark cells. Bold white condensed key concepts from ' + TL + '. 05/07. Brutalist.',
    'Square 1:1 editorial Instagram. White #f5f5f0. Safe zone 120px all sides. Centered Bebas Neue 4 lines provocative question about ' + TL + ' black and italic gray. 06/07. Minimalist.',
    'Square 1:1 editorial Instagram. Dark. Safe zone 120px all sides. Urban pattern 5% opacity. Bebas Neue white conclusion 2 lines. @maarmapa.eth bottom left. Hashtags bottom right. 07/07.'
  ];
  const slideUrls = [];
  for (let i = 0; i < 7; i++) {
    await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(4 + i, 10) + '\n_📸 Slide ' + (i + 1) + '/7..._');
    const url = await grokImg(defaultPrompts[i]);
    if (url) { slideUrls.push(url); await photo(chatId, url, 'Slide ' + (i + 1) + '/7'); }
  }

  // Runway clips
  let clips = 0;
  if (process.env.RUNWAY_KEY && slideUrls.length > 0) {
    const motions = [
      'Instagram Reel. Static then text slides left with motion blur. Dark cinematic.',
      'Editorial reel. White slide sharp. Text scales up blurs out. Clean impact.',
      'Dark slide. Numbers animate fast then blur. Vertical line slides in.',
      'Quote fades drifts upward like smoke. Contemplative mood.',
      'Grid cells flash sequentially. Brutalist rhythm.',
      'Letters scatter outward explosion. Kinetic typography.',
      'Fade deeper black. Background pulses. @maarmapa.eth sharp. Cinematic finale.'
    ];
    for (let i = 0; i < Math.min(slideUrls.length, 7); i++) {
      await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(9, 10) + '\n_🎬 Clip ' + (i + 1) + '/' + slideUrls.length + ' Runway..._');
      const vid = await runwayVideo(slideUrls[i], motions[i], 3);
      if (vid) { await video(chatId, vid, '🎬 Clip ' + (i + 1)); clips++; }
    }
  }

  await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(10, 10) + '\n✅ *Completado*');
  await send(chatId, '✅ *Listo*\n📸 Slides: ' + slideUrls.length + '\n🎬 Clips: ' + clips);
}

// ── ANIME FACTORY ─────────────────────────────────────
const BASE_CHAR = 'Hyper-cinematic anime. Katsuhiro Otomo Akira aesthetic. Cel-shading thick bold ink outlines. Mature dark gritty. NOT kawaii NOT chibi NOT cute. Hard dramatic shadows.';
const ANDINO_P = BASE_CHAR + ' ANDINO — full black ninja suit, ONLY calm eyes visible, crimson red headphones over ninja hood, MPC drum machine strapped to forearm glowing red. Crimson red neon. Red circle clan symbol.';
const PIERO_P = BASE_CHAR + ' PIERO — full dark navy ninja suit, ONLY sharp eyes behind round glasses over mask, microphone raised as weapon. Gold neon. Gold diamond clan symbol.';
const KINNY_P = BASE_CHAR + ' KINNY — full teal ninja suit, ONLY fierce intense eyes, electric blue lightning markings on arms and legs. EXPLOSIVE: right leg full kick extended, left arm back right arm forward, THREE shuriken orbiting, speed lines everywhere. Electric blue. Lightning bolt clan symbol.';

async function runAnime(chatId, concept) {
  const msgId = await send(chatId, '🎬 *anime factory*\n' + bar(0, 10) + '\n_Iniciando..._');

  const BASE_STYLE = 'Hyper-cinematic anime still frame. Katsuhiro Otomo Akira aesthetic. Cel-shading thick bold ink outlines. Mature dark gritty. NOT kawaii NOT chibi. Hard shadows film grain. Dystopian city — Tokyo Osaka Kyoto density fused with Andes silhouette on horizon and Spanish colonial archway glimpsed — kanji and Spanish neon signs mixed, wet cobblestones, electric storm. Vertical 9:16. ALL inside 120px safe margins. No cropping.';

  const scenePrompts = [
    BASE_STYLE + ' SHOT 1. ' + ANDINO_P + ' Rooftop low angle 360. Neon red lightning. Rain. Andes silhouette behind.',
    BASE_STYLE + ' SHOT 2. ' + PIERO_P + ' + ' + KINNY_P + ' Alley 180 arc. Steam grates. Kanji graffiti walls. Gold blue neon clash.',
    BASE_STYLE + ' SHOT 3. All three triangle formation top-down. ANDINO left PIERO center KINNY right mid-kick. Yin yang glowing ground. SOUTH SIDE CRIMINI red glitch text top. Ultimate poster.'
  ];

  const motions = [
    'Akira anime. Camera orbits 360 rising from low angle. Red lightning strikes. Rain streaks. Beat-driven.',
    'Dynamic 180 arc. Dancer spin accelerates motion blur. MC raises mic. Steam jets slow motion. Fast energy.',
    'Top-down drone descent fast. Energy burst expands. Neon ripples. White flash freeze. Title glitches red.'
  ];

  await edit(chatId, msgId, '🎬 *anime factory*\n' + bar(2, 10) + '\n_Generando personajes..._');

  // Character sheets
  const chars = [
    { character: 'Andino', role: 'Beatmaker', prompt: ANDINO_P + ' Full body character sheet front and 3/4. White background.' },
    { character: 'Piero', role: 'MC', prompt: PIERO_P + ' Full body character sheet front and 3/4. White background.' },
    { character: 'Kinny', role: 'Dancer', prompt: KINNY_P + ' Full body clearly visible. White background.' }
  ];

  await send(chatId, '🎨 *Squad:*\n1. *Andino* — Beatmaker\n2. *Piero* — MC\n3. *Kinny* — Dancer');

  for (let i = 0; i < chars.length; i++) {
    await edit(chatId, msgId, '🎬 *anime factory*\n' + bar(2 + i, 10) + '\n_🎨 ' + chars[i].character + '..._');
    const url = await grokImg(chars[i].prompt);
    if (url) await photo(chatId, url, '🎨 ' + chars[i].character + ' — ' + chars[i].role);
  }

  // 3 cinematic scenes
  const clips = [];
  for (let i = 0; i < 3; i++) {
    await edit(chatId, msgId, '🎬 *anime factory*\n' + bar(5 + i, 10) + '\n_🎨 Shot ' + (i + 1) + '/3 Grok..._');
    const sceneUrl = await grokImg(scenePrompts[i]);
    if (sceneUrl) {
      await photo(chatId, sceneUrl, '🎬 Shot ' + (i + 1) + '/3');
      await edit(chatId, msgId, '🎬 *anime factory*\n' + bar(6 + i, 10) + '\n_🎬 Shot ' + (i + 1) + '/3 Runway..._');
      const vid = await runwayVideo(sceneUrl, motions[i], 5);
      if (vid) { clips.push(vid); await video(chatId, vid, '🎬 Shot ' + (i + 1) + '/3'); }
    }
  }

  await edit(chatId, msgId, '🎬 *anime factory*\n' + bar(10, 10) + '\n✅ *Completado*');
  await send(chatId, '✅ *Anime listo*\n🎬 Clips: ' + clips.length + '/3\n_Une en CapCut para el video final._');
}

// ── SQUAD MULTI-ANGLE ─────────────────────────────────
async function runSquad(chatId) {
  const msgId = await send(chatId, '🥷 *SQUAD factory*\n' + bar(0, 10) + '\n_Iniciando..._');

  const BASE = 'Hyper-cinematic anime still frame. Katsuhiro Otomo Akira aesthetic. Cel-shading thick bold ink outlines. Mature dark gritty. NOT kawaii NOT chibi. Hard shadows film grain. Dystopian city Tokyo Osaka Kyoto fused with Andes silhouette and Spanish colonial archway, kanji and Spanish neon mixed, wet cobblestones electric storm. Vertical 9:16. ALL inside 120px safe margins. No cropping.';

  const angles = [
    { label: 'Kinny — Action', prompt: BASE + ' ' + KINNY_P + ' FROZEN MID-AIR right leg full roundhouse kick, diagonal power line. THREE shuriken orbit. Speed lines all directions. Electric blue trails. Dramatic underlighting.' },
    { label: 'Kinny — Low Angle', prompt: BASE + ' ' + KINNY_P + ' EXTREME LOW ANGLE from ground. Wide warrior stance both arms raised 45deg. Blue corona shockwave. Shuriken wide arc. Rain falling. Mountain silhouette behind.' },
    { label: 'Kinny — Portrait', prompt: BASE + ' ' + KINNY_P + ' WAIST UP 3/4. Right hand spinning shuriken eye level motion blur blue energy crackling. Single neon blue light from left. Wet stone wall neon sign behind.' },
    { label: 'Andino — Beat', prompt: BASE + ' ' + ANDINO_P + ' MEDIUM SHOT low angle. Both hands on MPC mid-strike red energy pulses. Face bowed concentration. Crimson particles float up like incense. Red neon rain outside window.' },
    { label: 'Andino — Rooftop', prompt: BASE + ' ' + ANDINO_P + ' FULL BODY rooftop edge wind pressing suit. Right arm raised holding vinyl disc glowing red weapon. Left arm balance. City below mountain silhouette red storm sky. Extreme silhouette.' },
    { label: 'Piero — Battle', prompt: BASE + ' ' + PIERO_P + ' HERO SHOT center. Microphone thrust toward camera gold energy beam from tip. Other hand open palm strike. Wet cobblestones. Colonial archway gold neon behind. Steam manholes. Puddle reflection.' },
    { label: 'Squad — Final', prompt: BASE + ' EPIC WIDE. ' + ANDINO_P + ' left. ' + PIERO_P + ' center. ' + KINNY_P + ' right. Triangle formation ALL inside 120px. Three coronas red gold blue merge white center. Yin yang glowing ground. SOUTH SIDE CRIMINI red glitch top.' }
  ];

  const clips = [];
  for (let i = 0; i < angles.length; i++) {
    await edit(chatId, msgId, '🥷 *SQUAD factory*\n' + bar(i + 1, angles.length + 1) + '\n_🎨 ' + angles[i].label + '..._');
    const url = await grokImg(angles[i].prompt);
    if (url) {
      await photo(chatId, url, '🎨 ' + angles[i].label);
      await edit(chatId, msgId, '🥷 *SQUAD factory*\n' + bar(i + 1, angles.length + 1) + '\n_🎬 Runway: ' + angles[i].label + '..._');
      const vid = await runwayVideo(url, 'Akira anime. Character animation dramatic movement speed lines neon glow. Camera slow push-in. Dark dystopian atmosphere. Beat-driven energy.', 3);
      if (vid) { clips.push(vid); await video(chatId, vid, '🎬 ' + angles[i].label); }
    }
  }

  await edit(chatId, msgId, '🥷 *SQUAD factory*\n' + bar(10, 10) + '\n✅ *Completado*');
  await send(chatId, '✅ *Squad listo*\n🎨 ' + angles.length + ' imágenes\n🎬 ' + clips.length + ' clips\n_Une en CapCut._');
}

// ── SEEDANCE FACTORY ──────────────────────────────────
async function runSeedance(chatId, concept, imageUrl) {
  const msgId = await send(chatId, '🌱 *Seedance factory*\n' + bar(0, 10) + '\n_Iniciando..._');

  if (!OPENROUTER_KEY) {
    await edit(chatId, msgId, '❌ OPENROUTER_KEY no configurada en Render.');
    return;
  }

  await edit(chatId, msgId, '🌱 *Seedance factory*\n' + bar(3, 10) + '\n_Generando video con Seedance 2.0..._');

  const prompt = concept || 'Cinematic anime ninja squad in dystopian city. Wu-Tang Shaolin aesthetic. Dark neon atmosphere. Beat-driven motion.';
  const vid = await seedanceVideo(prompt, imageUrl, null);

  if (vid) {
    await edit(chatId, msgId, '🌱 *Seedance factory*\n' + bar(10, 10) + '\n✅ *Completado*');
    await video(chatId, vid, '🎬 Seedance 2.0');
  } else {
    await edit(chatId, msgId, '❌ Seedance no generó el video. Verifica créditos en OpenRouter.');
  }
}

// ── COMMANDS ──────────────────────────────────────────
async function handle(msg) {
  const chatId = msg.chat.id;
  const text = msg.text || '';

  // Photo → download → Runway
  if (msg.photo) {
    const p = msg.photo[msg.photo.length - 1];
    const caption = msg.caption || '';
    const msgId = await send(chatId, '📸 Foto recibida — descargando...');
    try {
      // Get file path from Telegram
      const fileRes = await fetch('https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/getFile?file_id=' + p.file_id);
      const fileData = await fileRes.json();
      const filePath = fileData.result?.file_path;
      const telegramUrl = 'https://api.telegram.org/file/bot' + TELEGRAM_TOKEN + '/' + filePath;

      // Download image from Telegram
      const imgRes = await fetch(telegramUrl);
      const imgBuffer = await imgRes.arrayBuffer();
      const base64 = Buffer.from(imgBuffer).toString('base64');
      const dataUrl = 'data:image/jpeg;base64,' + base64;

      const motionPrompt = caption || 'Slow 360 product rotation. Professional studio lighting. Dark background subtle neon reflection. Smooth continuous rotation. Commercial product video.';

      await edit(chatId, msgId, '🎬 Runway generando... (~2 min)');

      // Send to Runway as base64
      const res = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.RUNWAY_KEY, 'X-Runway-Version': '2024-11-06' },
        body: JSON.stringify({ model: 'gen4_turbo', promptImage: dataUrl, promptText: motionPrompt, ratio: '720:1280', duration: 5 })
      });
      const text = await res.text();
      let d; try { d = JSON.parse(text); } catch(e) { await edit(chatId, msgId, '❌ Runway error: ' + text.slice(0,100)); return; }
      if (!d.id) { await edit(chatId, msgId, '❌ Runway: ' + JSON.stringify(d).slice(0,150)); return; }

      // Poll
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 10000));
        const poll = await fetch('https://api.dev.runwayml.com/v1/tasks/' + d.id, {
          headers: { 'Authorization': 'Bearer ' + process.env.RUNWAY_KEY, 'X-Runway-Version': '2024-11-06' }
        });
        const t = await poll.json();
        if (t.status === 'SUCCEEDED') {
          const vid = t.output?.[0];
          if (vid) { await video(chatId, vid, '🎬 Video listo'); await edit(chatId, msgId, '✅ Listo'); }
          return;
        }
        if (t.status === 'FAILED') { await edit(chatId, msgId, '❌ Runway falló: ' + (t.failure || '')); return; }
        await edit(chatId, msgId, '🎬 Runway procesando... ' + (i * 10) + 's');
      }
      await edit(chatId, msgId, '❌ Timeout — intenta de nuevo.');
    } catch(e) { await edit(chatId, msgId, '❌ Error: ' + e.message); }
    return;
  }

  if (text === '/start') {
    await send(chatId, '🎨 *maarmapa factory v5*\n\n`/post [tema]` — post completo\n`/anime [concepto]` — video anime squad\n`/squad` — multi-ángulo Andino+Piero+Kinny\n`/seedance [concepto]` — Seedance 2.0\n`/buscar [query]` — noticias X/Twitter\n`/chat [pregunta]` — agente\n`/digest` — digest semanal\n📸 *Manda una foto* — Runway la anima');
    return;
  }

  if (text.startsWith('/post ')) {
    runFactory(chatId, text.replace('/post ', '')).catch(e => send(chatId, '❌ ' + e.message));
    return;
  }

  if (text.startsWith('/anime ') || text === '/anime') {
    const concept = text.replace('/anime', '').trim() || 'south side crimini';
    runAnime(chatId, concept).catch(e => send(chatId, '❌ ' + e.message));
    return;
  }

  if (text === '/squad') {
    runSquad(chatId).catch(e => send(chatId, '❌ ' + e.message));
    return;
  }

  if (text.startsWith('/seedance')) {
    const concept = text.replace('/seedance', '').trim();
    runSeedance(chatId, concept, null).catch(e => send(chatId, '❌ ' + e.message));
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
      // Try DeepSeek first
      const reply = await deepseek(q, 'Eres maarmapa — artista urbano chileno contemporáneo con conocimiento profundo de arte, cultura, blockchain y ciudades. Responde en español.');
      if (reply) { await edit(chatId, msgId, reply.slice(0, 4000)); return; }
      // Fallback to agent
      const res = await fetch(AGENT_URL + '/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: q }] }) });
      const d = await res.json();
      await edit(chatId, msgId, (d.reply || '...').slice(0, 4000));
    } catch(e) { await edit(chatId, msgId, '❌ ' + e.message); }
    return;
  }

  if (text === '/digest') {
    const msgId = await send(chatId, '📰 _Generando digest..._');
    try {
      const reply = await deepseek('Genera un digest semanal de las noticias más importantes de arte contemporáneo, marketing viral, blockchain y AI de esta semana. Busca información actual. Formato: título + 5-7 noticias con descripción breve. En español.', null);
      if (reply) { await edit(chatId, msgId, reply.slice(0, 4000)); return; }
      const res = await fetch(AGENT_URL + '/digest');
      const d = await res.json();
      await edit(chatId, msgId, (d.digest || 'Error').slice(0, 4000));
    } catch(e) { await edit(chatId, msgId, '❌ ' + e.message); }
    return;
  }

  if (text && !text.startsWith('/')) {
    await send(chatId, '💡 `/post ' + text.slice(0, 25) + '` — post\n`/anime ' + text.slice(0, 25) + '` — anime\n`/buscar ' + text.slice(0, 25) + '` — noticias\n`/chat ' + text.slice(0, 25) + '` — pregunta');
  }
}

// ── POLLING ───────────────────────────────────────────
async function poll() {
  console.log('maarmapa bot v5 started — Claude+Grok+Runway+Seedance+DeepSeek');
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

require('http').createServer((q, s) => { s.writeHead(200); s.end('maarmapa bot v5 online'); }).listen(process.env.PORT || 3000);
poll();git add bot.js
git commit -m "fix photo handler base64 runway"
git push origin main