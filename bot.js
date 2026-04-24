// maarmapa — Telegram Bot v6
// Claude + Grok + Runway + Seedance + DeepSeek V4 + Veo 3.1
const AGENT_URL = process.env.AGENT_URL || 'https://maarmapa-agent.onrender.com';
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENROUTER_KEY = process.env.OPENROUTER_KEY;
const SOUTH_SIDE_AUDIO = 'https://pub-5dd65bdf9977446c93204c83d30ec735.r2.dev/SOUTH_SIDE_CRIMINI.mp3';

// Model config
const MODELS = {
  text: {
    fast: 'deepseek/deepseek-v4-flash',
    pro: 'deepseek/deepseek-v4-pro',
    gpt: 'openai/gpt-5.4',
    default: 'deepseek/deepseek-v4-flash'
  },
  video: {
    seedance_fast: 'bytedance/seedance-2.0-fast',
    seedance: 'bytedance/seedance-2.0',
    veo: 'google/veo-3.1',
    default: 'bytedance/seedance-2.0-fast'
  }
};
let currentTextModel = MODELS.text.default;
let currentVideoModel = MODELS.video.default;

// Character bibles
const BASE_CHAR = 'Hyper-cinematic anime Katsuhiro Otomo Akira aesthetic cel-shading thick bold ink outlines. Mature dark gritty NOT kawaii NOT chibi NOT cute. Hard dramatic shadows.';
const ANDINO_P = BASE_CHAR + ' ANDINO full black ninja suit ONLY calm eyes visible crimson red headphones over hood MPC drum machine strapped to forearm glowing red. Crimson red neon. Red circle clan symbol.';
const PIERO_P = BASE_CHAR + ' PIERO full dark navy ninja suit ONLY sharp eyes behind round glasses over mask microphone raised as weapon. Gold neon. Gold diamond clan symbol.';
const KINNY_P = BASE_CHAR + ' KINNY full teal ninja suit ONLY fierce intense eyes electric blue lightning markings on arms and legs. EXPLOSIVE right leg full kick extended left arm back right arm forward THREE shuriken orbiting speed lines everywhere. Electric blue. Lightning bolt clan symbol.';

// Telegram helpers
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
    if (!d.id) return null;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 10000));
      const p = await fetch('https://api.dev.runwayml.com/v1/tasks/' + d.id, {
        headers: { 'Authorization': 'Bearer ' + process.env.RUNWAY_KEY, 'X-Runway-Version': '2024-11-06' }
      });
      const t = await p.json();
      if (t.status === 'SUCCEEDED') return t.output?.[0] || null;
      if (t.status === 'FAILED') return null;
    }
    return null;
  } catch(e) { return null; }
}

// Seedance via OpenRouter
async function seedanceVideo(prompt, imageUrl) {
  if (!OPENROUTER_KEY) return null;
  try {
    const body = { model: currentVideoModel, prompt, aspect_ratio: '9:16', duration: 5, resolution: '720p' };
    if (imageUrl) body.frame_images = [{ url: imageUrl, frame_type: 'first_frame' }];
    const res = await fetch('https://openrouter.ai/api/v1/videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + OPENROUTER_KEY, 'HTTP-Referer': 'https://maarmapa.eth.limo', 'X-Title': 'maarmapa' },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    console.log('Seedance response:', text.slice(0, 200));
    let d; try { d = JSON.parse(text); } catch(e) { return null; }
    if (!d.id) { console.error('No id:', JSON.stringify(d)); return null; }
    const pollUrl = d.polling_url || ('https://openrouter.ai/api/v1/videos/' + d.id);
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 10000));
      const p = await fetch(pollUrl, { headers: { 'Authorization': 'Bearer ' + OPENROUTER_KEY } });
      const t = await p.json();
      console.log('Seedance poll ' + i + ':', t.status);
      if (t.status === 'completed') return 'https://openrouter.ai/api/v1/videos/' + d.id + '/content?index=0';
      if (t.status === 'failed') return null;
    }
    return null;
  } catch(e) { console.error('Seedance error:', e.message); return null; }
}

// DeepSeek via OpenRouter
async function deepseek(prompt, system) {
  if (!OPENROUTER_KEY) return null;
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + OPENROUTER_KEY, 'HTTP-Referer': 'https://maarmapa.eth.limo', 'X-Title': 'maarmapa' },
      body: JSON.stringify({
        model: currentTextModel,
        max_tokens: 4096,
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt }
        ]
      })
    });
    const d = await res.json();
    return d.choices?.[0]?.message?.content || null;
  } catch(e) { return null; }
}

// Wake agent
async function wakeAgent(chatId, msgId) {
  for (let i = 0; i < 10; i++) {
    try {
      const r = await fetch(AGENT_URL + '/');
      const t = await r.text();
      if (t.includes('maarmapa agent')) return true;
    } catch(e) {}
    await edit(chatId, msgId, '🏭 *factory*\n' + bar(1, 10) + '\n_Despertando agente ' + (i + 1) + '/10..._');
    await new Promise(r => setTimeout(r, 8000));
  }
  return false;
}

// POST FACTORY
async function runFactory(chatId, topic) {
  const msgId = await send(chatId, '🏭 *maarmapa factory*\n' + bar(0, 10) + '\n_Iniciando..._');
  const awake = await wakeAgent(chatId, msgId);
  if (!awake) { await edit(chatId, msgId, '❌ Agente no responde.'); return; }
  await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(2, 10) + '\n_Generando post con ' + currentTextModel.split('/')[1] + '..._');

  let postData;
  try {
    const dsSystem = 'Eres escritor editorial para maarmapa — artista urbano chileno. Genera posts completos para Substack sobre arte, cultura, marketing, blockchain y ciudades. Responde JSON: {"title":"...","body":"...","instagram_caption":"...","thumbnail_prompt":"..."}';
    let raw = await deepseek('Genera post completo sobre: ' + topic, dsSystem);
    if (raw) {
      try { postData = JSON.parse(raw.replace(/```json|```/g, '').trim()); }
      catch(e) { postData = { title: topic, body: raw, instagram_caption: '' }; }
    }
    if (!postData) {
      const res = await fetch(AGENT_URL + '/post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic }) });
      const r = await res.json();
      postData = r.post || r;
    }
  } catch(e) { await edit(chatId, msgId, '❌ Error: ' + e.message); return; }

  await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(3, 10) + '\n_✅ Texto listo_');

  const title = (postData.title || topic).slice(0, 120);
  const body = (postData.body || '').replace(/<cite[^>]*>[\s\S]*?<\/cite>/gi, '').replace(/## [^\n]+\n?/g, '\n').replace(/\*\*/g, '').trim().slice(0, 900);
  const caption = (postData.instagram_caption || '').slice(0, 250);
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
  const slidePrompts = [
    'Square 1:1 editorial Instagram. Dark #080808. Safe zone 120px all sides. Ghost image 12% opacity film grain vignette. Bebas Neue white: ' + T + ' 3 lines massive. 01/07 faint. Dark cinematic.',
    'Square 1:1 editorial Instagram. White #f5f5f0. Safe zone 120px. Film grain. Bebas Neue black: key paradox about ' + TL + ' 3 lines. 02/07. High contrast editorial.',
    'Square 1:1 editorial Instagram. Dark. Safe zone 120px. Architecture 10% film grain. Vertical white line. Massive Bebas Neue white stat from ' + TL + '. 03/07.',
    'Square 1:1 editorial Instagram. Dark. Safe zone 120px. Quote mark 3%. Italic serif light gray about ' + TL + '. Attribution dark gray. 04/07.',
    'Square 1:1 editorial Instagram. Dark. Safe zone 120px. 2x2 brutalist grid. Bold white condensed concepts from ' + TL + '. 05/07.',
    'Square 1:1 editorial Instagram. White #f5f5f0. Safe zone 120px. Bebas Neue 4 lines question about ' + TL + ' black italic gray. 06/07.',
    'Square 1:1 editorial Instagram. Dark. Safe zone 120px. Urban pattern 5%. Bebas Neue white conclusion. @maarmapa.eth bottom left. Hashtags right. 07/07.'
  ];
  const slideUrls = [];
  for (let i = 0; i < 7; i++) {
    await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(4 + i, 10) + '\n_📸 Slide ' + (i + 1) + '/7..._');
    const url = await grokImg(slidePrompts[i]);
    if (url) { slideUrls.push(url); await photo(chatId, url, 'Slide ' + (i + 1) + '/7'); }
  }

  // Runway clips
  let clips = 0;
  if (process.env.RUNWAY_KEY && slideUrls.length > 0) {
    const motions = ['Text slides left motion blur. Cinematic.', 'Text scales up blurs. Clean impact.', 'Numbers animate blur. Vertical line.', 'Quote fades upward smoke.', 'Grid cells flash sequential.', 'Letters scatter explosion.', 'Fade deeper black. Handle sharp.'];
    for (let i = 0; i < Math.min(slideUrls.length, 7); i++) {
      await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(9, 10) + '\n_🎬 Clip ' + (i + 1) + '/' + slideUrls.length + '..._');
      const vid = await runwayVideo(slideUrls[i], motions[i], 3);
      if (vid) { await video(chatId, vid, '🎬 Clip ' + (i + 1)); clips++; }
    }
  }

  await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(10, 10) + '\n✅ *Completado*');
  await send(chatId, '✅ *Listo*\n📸 Slides: ' + slideUrls.length + '\n🎬 Clips: ' + clips);
}

// ANIME FACTORY
async function runAnime(chatId, concept) {
  const msgId = await send(chatId, '🎬 *anime factory*\n' + bar(0, 10) + '\n_Iniciando..._');
  const BASE_STYLE = 'Hyper-cinematic anime Katsuhiro Otomo Akira aesthetic. Cel-shading thick ink outlines. Mature dark NOT kawaii. Dystopian city Tokyo Osaka fused Andes silhouette Spanish colonial archway wet cobblestones neon signs. 9:16 vertical ALL 120px safe margins.';
  const chars = [
    { character: 'Andino', role: 'Beatmaker', prompt: ANDINO_P + ' Full body character sheet front 3/4. White background.' },
    { character: 'Piero', role: 'MC', prompt: PIERO_P + ' Full body character sheet front 3/4. White background.' },
    { character: 'Kinny', role: 'Dancer', prompt: KINNY_P + ' Full body visible. White background.' }
  ];
  const scenePrompts = [
    BASE_STYLE + ' SHOT 1. ' + ANDINO_P + ' Rooftop 360 orbit low angle. Red lightning rain. Andes silhouette.',
    BASE_STYLE + ' SHOT 2. ' + PIERO_P + ' + ' + KINNY_P + ' Alley 180 arc. Steam grates. Kanji graffiti. Gold blue neon.',
    BASE_STYLE + ' SHOT 3. All three triangle top-down. SOUTH SIDE CRIMINI red glitch text. Yin yang glowing. Ultimate poster.'
  ];
  const motions = [
    'Akira anime. 360 orbit rising low angle. Red lightning. Rain streaks. Beat-driven.',
    '180 arc. Dancer spin motion blur. MC raises mic. Steam jets. Fast energy.',
    'Top-down drone descent. Energy burst. Neon ripples. White flash freeze. Title glitches.'
  ];

  await send(chatId, '🎨 *Squad:*\n1. *Andino* — Beatmaker\n2. *Piero* — MC\n3. *Kinny* — Dancer');
  for (let i = 0; i < chars.length; i++) {
    await edit(chatId, msgId, '🎬 *anime factory*\n' + bar(2 + i, 10) + '\n_🎨 ' + chars[i].character + '..._');
    const url = await grokImg(chars[i].prompt);
    if (url) await photo(chatId, url, '🎨 ' + chars[i].character + ' — ' + chars[i].role);
  }
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
  await send(chatId, '✅ *Anime listo*\n🎬 Clips: ' + clips.length + '/3');
}

// SQUAD MULTI-ANGLE
async function runSquad(chatId) {
  const msgId = await send(chatId, '🥷 *SQUAD factory*\n' + bar(0, 10) + '\n_Iniciando..._');
  const BASE = 'Hyper-cinematic anime Katsuhiro Otomo Akira aesthetic. Cel-shading thick ink outlines. Mature dark NOT kawaii. Dystopian Tokyo Osaka fused Andes silhouette Spanish colonial archway wet cobblestones neon signs. 9:16 vertical ALL 120px safe margins.';
  const angles = [
    { label: 'Kinny — Action', prompt: BASE + ' ' + KINNY_P + ' FROZEN MID-AIR right leg full kick diagonal power. THREE shuriken orbit. Speed lines all directions. Blue energy trails. Dramatic underlighting.' },
    { label: 'Kinny — Low Angle', prompt: BASE + ' ' + KINNY_P + ' EXTREME LOW ANGLE from ground. Wide warrior stance both arms raised. Blue corona shockwave. Shuriken wide arc. Rain. Mountain silhouette.' },
    { label: 'Kinny — Portrait', prompt: BASE + ' ' + KINNY_P + ' WAIST UP 3/4. Right hand spinning shuriken eye level. Blue energy crackling. Single neon blue light from left. Wet stone wall behind.' },
    { label: 'Andino — Beat', prompt: BASE + ' ' + ANDINO_P + ' MEDIUM SHOT low angle. Both hands on MPC red energy pulses. Face bowed concentration. Crimson particles float up. Red neon rain window behind.' },
    { label: 'Andino — Rooftop', prompt: BASE + ' ' + ANDINO_P + ' FULL BODY rooftop edge. Right arm raised vinyl disc glowing red. Left arm balance. City below mountain silhouette red storm sky.' },
    { label: 'Piero — Battle', prompt: BASE + ' ' + PIERO_P + ' HERO SHOT center. Microphone thrust toward camera gold energy beam. Other hand open palm strike. Wet cobblestones. Colonial archway gold neon. Steam manholes.' },
    { label: 'Squad — Final', prompt: BASE + ' EPIC WIDE. ' + ANDINO_P + ' left. ' + PIERO_P + ' center. ' + KINNY_P + ' right. Triangle ALL inside 120px. Three coronas red gold blue merge white. Yin yang ground. SOUTH SIDE CRIMINI red glitch top.' }
  ];
  const clips = [];
  for (let i = 0; i < angles.length; i++) {
    await edit(chatId, msgId, '🥷 *SQUAD factory*\n' + bar(i + 1, angles.length + 1) + '\n_🎨 ' + angles[i].label + '..._');
    const url = await grokImg(angles[i].prompt);
    if (url) {
      await photo(chatId, url, '🎨 ' + angles[i].label);
      await edit(chatId, msgId, '🥷 *SQUAD factory*\n' + bar(i + 1, angles.length + 1) + '\n_🎬 Runway: ' + angles[i].label + '..._');
      const vid = await runwayVideo(url, 'Akira anime character animation dramatic movement speed lines neon glow. Slow push-in. Dark dystopian. Beat-driven.', 3);
      if (vid) { clips.push(vid); await video(chatId, vid, '🎬 ' + angles[i].label); }
    }
  }
  await edit(chatId, msgId, '🥷 *SQUAD factory*\n' + bar(10, 10) + '\n✅ *Completado*');
  await send(chatId, '✅ *Squad listo*\n🎨 ' + angles.length + ' imágenes\n🎬 ' + clips.length + ' clips');
}

// SEEDANCE FACTORY
async function runSeedance(chatId, concept, imageUrl) {
  const msgId = await send(chatId, '🌱 *Seedance factory*\n' + bar(0, 10) + '\n_Iniciando..._');
  if (!OPENROUTER_KEY) { await edit(chatId, msgId, '❌ OPENROUTER_KEY no configurada.'); return; }
  const prompt = concept || 'Cinematic anime ninja squad dystopian Santiago Chile Akira aesthetic dark neon rain Wu-Tang Shaolin energy 3 ninja warriors beatmaker MC dancer epic cinematics beat-driven motion';

  // Generate Grok reference image if no imageUrl provided
  let firstFrame = imageUrl;
  if (!firstFrame) {
    await edit(chatId, msgId, '🌱 *Seedance factory*\n' + bar(2, 10) + '\n_🎨 Generando frame con Grok..._');
    const squadPrompt = 'Hyper-cinematic anime Katsuhiro Otomo Akira aesthetic cel-shading thick ink. Mature dark NOT kawaii. Dystopian city Tokyo fused Andes silhouette wet cobblestones neon. 9:16 vertical ALL 120px safe margins. ' + ANDINO_P + ' left. ' + PIERO_P + ' center mic raised. ' + KINNY_P + ' right mid-air kick. Triangle formation. Yin yang glowing ground. SOUTH SIDE CRIMINI red glitch text top. Epic anime poster.';
    firstFrame = await grokImg(squadPrompt);
    if (firstFrame) await photo(chatId, firstFrame, '🎨 Frame referencia');
  }

  await edit(chatId, msgId, '🌱 *Seedance factory*\n' + bar(4, 10) + '\n_🎬 ' + currentVideoModel.split('/')[1] + ' generando..._');
  const vid = await seedanceVideo(prompt, firstFrame);

  if (vid) {
    await edit(chatId, msgId, '🌱 *Seedance factory*\n' + bar(9, 10) + '\n_📥 Descargando..._');
    try {
      const vidRes = await fetch(vid, { headers: { 'Authorization': 'Bearer ' + OPENROUTER_KEY } });
      const vidBuffer = await vidRes.arrayBuffer();
      const form = new FormData();
      form.append('chat_id', String(chatId));
      form.append('video', new Blob([vidBuffer], { type: 'video/mp4' }), 'south_side_crimini.mp4');
      form.append('caption', '🎬 ' + currentVideoModel.split('/')[1] + ' — South Side Crimini');
      await fetch('https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/sendVideo', { method: 'POST', body: form });
      await edit(chatId, msgId, '🌱 *Seedance factory*\n' + bar(10, 10) + '\n✅ *Completado*');
    } catch(e) {
      await edit(chatId, msgId, '✅ Video listo:\n' + vid);
    }
  } else {
    await edit(chatId, msgId, '❌ No generó video. Verifica créditos en openrouter.ai');
  }
}

// COMMAND HANDLER
async function handle(msg) {
  const chatId = msg.chat.id;
  const text = msg.text || '';

  // Photo → Runway
  if (msg.photo) {
    const p = msg.photo[msg.photo.length - 1];
    const caption = msg.caption || '';
    const msgId = await send(chatId, '📸 Foto recibida — enviando a Runway...');
    try {
      const fileRes = await fetch('https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/getFile?file_id=' + p.file_id);
      const fileData = await fileRes.json();
      const imageUrl = 'https://api.telegram.org/file/bot' + TELEGRAM_TOKEN + '/' + fileData.result?.file_path;
      const imgRes = await fetch(imageUrl);
      const imgBuffer = await imgRes.arrayBuffer();
      const dataUrl = 'data:image/jpeg;base64,' + Buffer.from(imgBuffer).toString('base64');
      const motionPrompt = caption || 'Slow 360 product rotation. Professional studio lighting. Dark background subtle neon reflection. Smooth continuous rotation. Commercial product video.';
      await edit(chatId, msgId, '🎬 Runway generando... (~2 min)');
      const res = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.RUNWAY_KEY, 'X-Runway-Version': '2024-11-06' },
        body: JSON.stringify({ model: 'gen4_turbo', promptImage: dataUrl, promptText: motionPrompt, ratio: '720:1280', duration: 5 })
      });
      const t = await res.text();
      let d; try { d = JSON.parse(t); } catch(e) { await edit(chatId, msgId, '❌ Error: ' + t.slice(0,100)); return; }
      if (!d.id) { await edit(chatId, msgId, '❌ Runway: ' + JSON.stringify(d).slice(0,150)); return; }
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 10000));
        const poll = await fetch('https://api.dev.runwayml.com/v1/tasks/' + d.id, {
          headers: { 'Authorization': 'Bearer ' + process.env.RUNWAY_KEY, 'X-Runway-Version': '2024-11-06' }
        });
        const task = await poll.json();
        if (task.status === 'SUCCEEDED') { await video(chatId, task.output?.[0], '🎬 Video listo'); await edit(chatId, msgId, '✅ Listo'); return; }
        if (task.status === 'FAILED') { await edit(chatId, msgId, '❌ Runway falló.'); return; }
        await edit(chatId, msgId, '🎬 Runway... ' + (i * 10) + 's');
      }
    } catch(e) { await edit(chatId, msgId, '❌ Error: ' + e.message); }
    return;
  }

  if (text === '/start') {
    await send(chatId, '🎨 *maarmapa factory v6*\n\n`/post [tema]` — post completo\n`/anime [concepto]` — video anime squad\n`/squad` — multi-ángulo squad\n`/seedance [concepto]` — Seedance+Grok\n`/model` — cambiar modelo AI\n`/buscar [query]` — noticias X\n`/chat [pregunta]` — agente\n`/digest` — digest semanal\n📸 *Foto* — Runway la anima');
    return;
  }

  if (text.startsWith('/post ')) {
    runFactory(chatId, text.replace('/post ', '')).catch(e => send(chatId, '❌ ' + e.message));
    return;
  }

  if (text.startsWith('/anime') || text === '/anime') {
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

  if (text.startsWith('/model')) {
    const arg = text.replace('/model', '').trim().toLowerCase();
    if (arg === 'fast' || arg === 'flash') { currentTextModel = MODELS.text.fast; await send(chatId, '✅ Texto: *DeepSeek V4 Flash*'); }
    else if (arg === 'pro') { currentTextModel = MODELS.text.pro; await send(chatId, '✅ Texto: *DeepSeek V4 Pro*'); }
    else if (arg === 'gpt') { currentTextModel = MODELS.text.gpt; await send(chatId, '✅ Texto: *GPT-5.4*'); }
    else if (arg === 'veo') { currentVideoModel = MODELS.video.veo; await send(chatId, '✅ Video: *Veo 3.1*'); }
    else if (arg === 'seedance') { currentVideoModel = MODELS.video.seedance; await send(chatId, '✅ Video: *Seedance 2.0*'); }
    else if (arg === 'seedance-fast') { currentVideoModel = MODELS.video.seedance_fast; await send(chatId, '✅ Video: *Seedance 2.0 Fast*'); }
    else { await send(chatId, '📋 *Modelos:*\n\n*Texto:*\n`/model fast` — DeepSeek V4 Flash\n`/model pro` — DeepSeek V4 Pro\n`/model gpt` — GPT-5.4\n\n*Video:*\n`/model seedance-fast` — Seedance Fast\n`/model seedance` — Seedance 2.0\n`/model veo` — Veo 3.1\n\n_Texto: ' + currentTextModel + '_\n_Video: ' + currentVideoModel + '_'); }
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
      const reply = await deepseek(q, 'Eres maarmapa — artista urbano chileno con conocimiento de arte, cultura, blockchain y ciudades. Responde en español.');
      if (reply) { await edit(chatId, msgId, reply.slice(0, 4000)); return; }
      const res = await fetch(AGENT_URL + '/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: q }] }) });
      const d = await res.json();
      await edit(chatId, msgId, (d.reply || '...').slice(0, 4000));
    } catch(e) { await edit(chatId, msgId, '❌ ' + e.message); }
    return;
  }

  if (text === '/digest') {
    const msgId = await send(chatId, '📰 _Generando digest..._');
    try {
      const reply = await deepseek('Genera digest semanal de noticias de arte contemporáneo, marketing viral, blockchain y AI esta semana. 5-7 noticias con descripción. En español.', null);
      if (reply) { await edit(chatId, msgId, reply.slice(0, 4000)); return; }
      const res = await fetch(AGENT_URL + '/digest');
      const d = await res.json();
      await edit(chatId, msgId, (d.digest || 'Error').slice(0, 4000));
    } catch(e) { await edit(chatId, msgId, '❌ ' + e.message); }
    return;
  }

  if (text && !text.startsWith('/')) {
    await send(chatId, '💡 `/post ' + text.slice(0, 20) + '` — post\n`/anime ' + text.slice(0, 20) + '` — anime\n`/buscar ' + text.slice(0, 20) + '` — noticias');
  }
}

// POLLING
async function poll() {
  console.log('maarmapa bot v6 — DeepSeek V4 + Grok + Runway + Seedance + Veo 3.1');
  let offset = 0;
  while (true) {
    try {
      const res = await fetch('https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/getUpdates?offset=' + offset + '&timeout=30');
      const d = await res.json();
      for (const u of d.result || []) {
        offset = u.update_id + 1;
        if (u.message) handle(u.message).catch(e => console.error('Error:', e.message));
      }
    } catch(e) {
      console.error('Poll error:', e.message);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

require('http').createServer((q, s) => { s.writeHead(200); s.end('maarmapa bot v6 online'); }).listen(process.env.PORT || 3000);
poll();