// maarmapa — Telegram Bot v7
// Claude + Grok + Runway + Seedance + DeepSeek + Shotstack + R2
const AGENT_URL = process.env.AGENT_URL || 'https://maarmapa-agent.onrender.com';
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENROUTER_KEY = process.env.OPENROUTER_KEY;
const SOUTHSIDE_AUDIO = 'https://pub-5dd65bdf9977446c93204c83d30ec735.r2.dev/SOUTH%20SIDE%20CRIMINI.mp3';
const R2_BASE = 'https://pub-5dd65bdf9977446c93204c83d30ec735.r2.dev/';
const R2_WORKER = 'https://maarmapa-media.mario-25d.workers.dev';

// Model config
const MODELS = {
  text: { fast: 'deepseek/deepseek-v4-flash', pro: 'deepseek/deepseek-v4-pro', gpt: 'openai/gpt-5.4' },
  video: { seedance_fast: 'bytedance/seedance-2.0-fast', seedance: 'bytedance/seedance-2.0', veo: 'google/veo-3.1' }
};
let currentTextModel = MODELS.text.fast;
let currentVideoModel = MODELS.video.seedance_fast;

// Clip store (in-memory per session)
const clipStore = {};
function saveClip(chatId, url) {
  if (!clipStore[chatId]) clipStore[chatId] = [];
  if (url && !clipStore[chatId].includes(url)) {
    clipStore[chatId].push(url);
    if (clipStore[chatId].length > 30) clipStore[chatId].shift();
  }
}
function getClips(chatId) { return clipStore[chatId] || []; }
function clearClips(chatId) { clipStore[chatId] = []; }

// Character bibles — Wu-Tang dark black magic
const BASE_STYLE = 'Hyper-cinematic dark anime. Katsuhiro Otomo Akira meets Wu-Tang Clan 36 Chambers. Cel-shading heavy brush ink textures. Mature ultra-dark occult. NOT kawaii NOT chibi. Black ink shadows. Black incense smoke. Film grain heavy. Black magic ritual energy. Blood moon. Only deep blacks blood crimsons tarnished gold shadow teal.';
const CITY_BG = 'Background: abandoned Shaolin monastery ruins in dark Santiago barrio night. Crumbling stone arches with faded Chinese ink paintings and Spanish graffiti tags. Thick black smoke at ground level. Single blood-red lantern far away. Andes mountain silhouette through storm clouds. Wet black cobblestones with ancient symbols. Only candlelight and blood-red moon through storm clouds.';
const ANDINO_P = 'ANDINO full PITCH MATTE BLACK ninja suit ONLY two calm predator eyes glowing faint crimson. Battle-scarred crimson red headphones over ninja hood. Ancient MPC drum machine at feet like ritual altar red runes glowing dark smoke rising. Monk-still posture. BACKGROUND center partially in shadow. Dark smoke curls around him.';
const PIERO_P = 'PIERO full CHARCOAL BLACK ninja suit aged worn texture ONLY sharp eyes behind thick-frame scarred glasses over mask. Holding black iron microphone upward like ritual weapon free hand Shaolin open-palm strike. FOREGROUND LEFT. Tarnished gold clan seal on chest. Shadow across half his face.';
const KINNY_P = 'KINNY full DEEP SHADOW ninja suit dark teal energy pulsing in markings like veins. ONLY fierce feral predator eyes. FOREGROUND RIGHT body coiled low explosive Shaolin stance knees bent weight forward one hand on wet ground other arm cocked back. Three obsidian shuriken on belt. Dark smoke at feet.';
const SQUAD_COMP = 'COMPOSITION: PIERO foreground left, KINNY foreground right, ANDINO center-background partially in shadow smaller. Three-point triangle depth. All fully visible inside safe margins. Blood red moon above. Heavy black smoke atmosphere.';

// Telegram helpers
async function tg(method, body) {
  const res = await fetch('https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/' + method, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  return (await res.json()).result;
}
async function send(chatId, text) { return (await tg('sendMessage', { chat_id: chatId, text, parse_mode: 'Markdown' }))?.message_id; }
async function edit(chatId, msgId, text) { try { await tg('editMessageText', { chat_id: chatId, message_id: msgId, text, parse_mode: 'Markdown' }); } catch(e) {} }
async function photo(chatId, url, caption) { try { await tg('sendPhoto', { chat_id: chatId, photo: url, caption }); } catch(e) {} }
async function video(chatId, url, caption) { try { await tg('sendVideo', { chat_id: chatId, video: url, caption }); saveClip(chatId, url); } catch(e) {} }
function bar(n, t) { const f = Math.round((n/t)*10); return '[' + '█'.repeat(f) + '░'.repeat(10-f) + '] ' + Math.round((n/t)*100) + '%'; }

// Grok image
async function grokImg(prompt) {
  if (!process.env.GROK_KEY) return null;
  try {
    const r = await fetch('https://api.x.ai/v1/images/generations', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.GROK_KEY },
      body: JSON.stringify({ model: 'grok-imagine-image', prompt, n: 1, response_format: 'url' })
    });
    return (await r.json()).data?.[0]?.url || null;
  } catch(e) { return null; }
}

// Runway
async function runwayVideo(imageUrl, prompt, duration) {
  if (!process.env.RUNWAY_KEY) return null;
  try {
    const r = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.RUNWAY_KEY, 'X-Runway-Version': '2024-11-06' },
      body: JSON.stringify({ model: 'gen4_turbo', promptImage: imageUrl, promptText: prompt, ratio: '720:1280', duration: duration || 5 })
    });
    const d = await (await r.text().then(JSON.parse.bind(JSON)));
    if (!d.id) return null;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 10000));
      const t = await (await fetch('https://api.dev.runwayml.com/v1/tasks/' + d.id, { headers: { 'Authorization': 'Bearer ' + process.env.RUNWAY_KEY, 'X-Runway-Version': '2024-11-06' } })).json();
      if (t.status === 'SUCCEEDED') return t.output?.[0] || null;
      if (t.status === 'FAILED') return null;
    }
  } catch(e) { return null; }
}

// Seedance via OpenRouter
async function seedanceVideo(prompt, imageUrl) {
  if (!OPENROUTER_KEY) return null;
  try {
    const body = { model: currentVideoModel, prompt, aspect_ratio: '9:16', duration: 5, resolution: '720p' };
    if (imageUrl) body.frame_images = [{ url: imageUrl, frame_type: 'first_frame' }];
    const r = await fetch('https://openrouter.ai/api/v1/videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + OPENROUTER_KEY, 'HTTP-Referer': 'https://maarmapa.eth.limo', 'X-Title': 'maarmapa' },
      body: JSON.stringify(body)
    });
    const text = await r.text();
    console.log('Seedance:', text.slice(0, 150));
    let d; try { d = JSON.parse(text); } catch(e) { return null; }
    if (!d.id) return null;
    const pollUrl = d.polling_url || ('https://openrouter.ai/api/v1/videos/' + d.id);
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 10000));
      const t = await (await fetch(pollUrl, { headers: { 'Authorization': 'Bearer ' + OPENROUTER_KEY } })).json();
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
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + OPENROUTER_KEY, 'HTTP-Referer': 'https://maarmapa.eth.limo' },
      body: JSON.stringify({ model: currentTextModel, max_tokens: 4096, messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt }] })
    });
    return (await r.json()).choices?.[0]?.message?.content || null;
  } catch(e) { return null; }
}

// R2 upload via Worker
async function uploadToR2(buffer, filename, contentType) {
  try {
    const r = await fetch(R2_WORKER + '/' + filename, {
      method: 'PUT', headers: { 'Content-Type': contentType || 'video/mp4' }, body: buffer
    });
    const d = await r.json();
    console.log('R2 upload:', d.url);
    return d.url || null;
  } catch(e) { console.error('R2 error:', e.message); return null; }
}

// Wake agent
async function wakeAgent(chatId, msgId) {
  for (let i = 0; i < 10; i++) {
    try {
      const t = await (await fetch(AGENT_URL + '/')).text();
      if (t.includes('maarmapa agent')) return true;
    } catch(e) {}
    await edit(chatId, msgId, '🏭 *factory*\n' + bar(1, 10) + '\n_Despertando agente ' + (i+1) + '/10..._');
    await new Promise(r => setTimeout(r, 8000));
  }
  return false;
}

// POST FACTORY
async function runFactory(chatId, topic) {
  const msgId = await send(chatId, '🏭 *maarmapa factory*\n' + bar(0, 10) + '\n_Iniciando..._');
  const awake = await wakeAgent(chatId, msgId);
  if (!awake) { await edit(chatId, msgId, '❌ Agente no responde.'); return; }
  await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(2, 10) + '\n_Generando post..._');

  let postData;
  try {
    const system = 'Eres escritor editorial para maarmapa artista urbano chileno. Genera posts completos Substack sobre arte cultura marketing blockchain ciudades. Devuelve SOLO JSON: {"title":"...","body":"...","instagram_caption":"...","thumbnail_prompt":"..."}';
    const raw = await deepseek('Genera post completo sobre: ' + topic, system);
    if (raw) {
      try { postData = JSON.parse(raw.replace(/```json|```/g, '').trim()); } catch(e) { postData = { title: topic, body: raw, instagram_caption: '' }; }
    }
    if (!postData) {
      const r = await fetch(AGENT_URL + '/post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic }) });
      postData = (await r.json()).post || (await r.json());
    }
  } catch(e) { await edit(chatId, msgId, '❌ Error: ' + e.message); return; }

  await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(3, 10) + '\n_✅ Texto listo_');

  const title = (postData.title || topic).slice(0, 120);
  const body = (postData.body || '').replace(/<cite[^>]*>[\s\S]*?<\/cite>/gi, '').replace(/#{1,3} [^\n]+\n?/g, '\n').replace(/\*\*/g, '').trim().slice(0, 900);
  const caption = (postData.instagram_caption || '').slice(0, 250);
  await send(chatId, '📝 *' + title + '*\n\n' + body + '...');
  if (caption) await send(chatId, '📌 _Caption:_\n' + caption);

  if (postData.thumbnail_prompt) {
    await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(4, 10) + '\n_🖼 Thumbnail..._');
    const t = await grokImg(postData.thumbnail_prompt);
    if (t) await photo(chatId, t, '🖼 Thumbnail');
  }

  const TL = postData.title || topic;
  const T = TL.toUpperCase().slice(0, 38);
  const slidePrompts = [
    'Square 1:1 editorial. Dark #080808. Safe 120px all sides. Ghost image 12% film grain. Bebas Neue white: ' + T + ' 3 lines. 01/07.',
    'Square 1:1 editorial. White #f5f5f0. Safe 120px. Bebas Neue black: key paradox about ' + TL + '. 02/07.',
    'Square 1:1 editorial. Dark. Safe 120px. Architecture 10% film grain. Vertical white line. Massive stat from ' + TL + '. 03/07.',
    'Square 1:1 editorial. Dark. Safe 120px. Quote mark 3%. Italic serif quote about ' + TL + '. Attribution. 04/07.',
    'Square 1:1 editorial. Dark. Safe 120px. 2x2 brutalist grid. Bold white concepts from ' + TL + '. 05/07.',
    'Square 1:1 editorial. White #f5f5f0. Safe 120px. Bebas Neue question about ' + TL + ' black italic gray. 06/07.',
    'Square 1:1 editorial. Dark. Safe 120px. Urban pattern 5%. Bebas Neue conclusion. @maarmapa.eth. Hashtags. 07/07.'
  ];
  const slideUrls = [];
  for (let i = 0; i < 7; i++) {
    await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(4 + i, 10) + '\n_📸 Slide ' + (i+1) + '/7..._');
    const u = await grokImg(slidePrompts[i]);
    if (u) { slideUrls.push(u); await photo(chatId, u, 'Slide ' + (i+1) + '/7'); }
  }

  let clips = 0;
  if (process.env.RUNWAY_KEY && slideUrls.length > 0) {
    const motions = ['Text slides left motion blur. Cinematic.', 'Text scales up blurs. Clean impact.', 'Numbers animate blur. Vertical line.', 'Quote fades upward smoke.', 'Grid cells flash sequential.', 'Letters scatter explosion.', 'Fade deeper black. Handle sharp.'];
    for (let i = 0; i < Math.min(slideUrls.length, 7); i++) {
      await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(9, 10) + '\n_🎬 Clip ' + (i+1) + '/' + slideUrls.length + '..._');
      const vid = await runwayVideo(slideUrls[i], motions[i], 3);
      if (vid) { await video(chatId, vid, '🎬 Clip ' + (i+1)); clips++; }
    }
  }
  await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(10, 10) + '\n✅ *Completado*');
  await send(chatId, '✅ *Listo*\n📸 Slides: ' + slideUrls.length + '\n🎬 Clips: ' + clips);
}

// ANIME FACTORY
async function runAnime(chatId, concept) {
  const msgId = await send(chatId, '🎬 *anime factory*\n' + bar(0, 10) + '\n_Iniciando..._');
  const BS = BASE_STYLE + ' ' + CITY_BG + ' 9:16 vertical ALL 120px safe margins.';
  const chars = [
    { character: 'Andino', role: 'Beatmaker', prompt: BS + ' ' + ANDINO_P + ' Full body character sheet front 3/4. White background.' },
    { character: 'Piero', role: 'MC', prompt: BS + ' ' + PIERO_P + ' Full body character sheet front 3/4. White background.' },
    { character: 'Kinny', role: 'Dancer', prompt: BS + ' ' + KINNY_P + ' Full body visible. White background.' }
  ];
  const scenePrompts = [
    BS + ' SHOT 1. ' + ANDINO_P + ' Rooftop 360 orbit low angle. Red lightning rain. Andes silhouette.',
    BS + ' SHOT 2. ' + PIERO_P + ' + ' + KINNY_P + ' Alley 180 arc. Steam grates. Kanji graffiti. Gold blue neon clash.',
    BS + ' SHOT 3. ' + SQUAD_COMP + ' ' + ANDINO_P + ' ' + PIERO_P + ' ' + KINNY_P + ' Triangle top-down. SOUTHSIDE red glitch text. Yin yang glowing. Ultimate poster.'
  ];
  const motions = [
    'Akira anime 360 orbit rising low angle. Red lightning. Rain streaks. Beat-driven.',
    'Dynamic 180 arc. Dancer spin motion blur. MC raises mic. Steam jets. Fast energy.',
    'Top-down drone descent fast. Energy burst expands. Neon ripples. White flash freeze.'
  ];
  await send(chatId, '🎨 *Squad:*\n1. *Andino* — Beatmaker\n2. *Piero* — MC\n3. *Kinny* — Dancer');
  for (let i = 0; i < chars.length; i++) {
    await edit(chatId, msgId, '🎬 *anime factory*\n' + bar(2+i, 10) + '\n_🎨 ' + chars[i].character + '..._');
    const u = await grokImg(chars[i].prompt);
    if (u) await photo(chatId, u, '🎨 ' + chars[i].character + ' — ' + chars[i].role);
  }
  const clips = [];
  for (let i = 0; i < 3; i++) {
    await edit(chatId, msgId, '🎬 *anime factory*\n' + bar(5+i, 10) + '\n_🎨 Shot ' + (i+1) + '/3 Grok..._');
    const su = await grokImg(scenePrompts[i]);
    if (su) {
      await photo(chatId, su, '🎬 Shot ' + (i+1) + '/3');
      await edit(chatId, msgId, '🎬 *anime factory*\n' + bar(6+i, 10) + '\n_🎬 Shot ' + (i+1) + '/3 Runway..._');
      const vid = await runwayVideo(su, motions[i], 5);
      if (vid) { clips.push(vid); await video(chatId, vid, '🎬 Shot ' + (i+1) + '/3'); }
    }
  }
  await edit(chatId, msgId, '🎬 *anime factory*\n' + bar(10, 10) + '\n✅ *Completado*');
  await send(chatId, '✅ *Anime listo*\n🎬 Clips: ' + clips.length + '/3');
}

// SQUAD MULTI-ANGLE
async function runSquad(chatId) {
  const msgId = await send(chatId, '🥷 *SQUAD factory*\n' + bar(0, 10) + '\n_Iniciando..._');
  const BS = BASE_STYLE + ' ' + CITY_BG + ' 9:16 vertical ALL 120px safe margins.';
  const angles = [
    { label: 'Kinny — Action', prompt: BS + ' ' + KINNY_P + ' FROZEN MID-AIR right leg full kick. THREE shuriken orbit. Speed lines all. Blue energy trails.', motion: 'Kinny mid-air kick ULTRA SLOW MOTION. Shuriken scatter. Teal energy explosion. Camera 180 arc.' },
    { label: 'Kinny — Low Angle', prompt: BS + ' ' + KINNY_P + ' EXTREME LOW ANGLE. Wide warrior stance both arms raised. Blue corona shockwave. Rain.', motion: 'Camera rises from ground. Blue corona expands. Shuriken orbit accelerates. Blood moon blazes.' },
    { label: 'Kinny — Portrait', prompt: BS + ' ' + KINNY_P + ' WAIST UP 3/4. Right hand spinning shuriken eye level. Blue energy crackling. Single neon blue light from left.', motion: 'Shuriken spins in slow motion. Blue energy crackles around fist. Camera slow push-in to eyes.' },
    { label: 'Andino — Beat', prompt: BS + ' ' + ANDINO_P + ' MEDIUM SHOT low angle. Both hands MPC mid-strike. Red energy pulses. Face bowed. Crimson particles float up.', motion: 'MPC pad strikes send red shockwaves through stone. Crimson particles float upward. Camera circles slowly.' },
    { label: 'Andino — Rooftop', prompt: BS + ' ' + ANDINO_P + ' FULL BODY rooftop edge. Right arm raised vinyl disc glowing red. Left arm balance. City below. Red storm sky.', motion: 'Camera slow push-in. Wind presses suit. Crimson headphones pulse. City neon below. Direct eye contact.' },
    { label: 'Piero — Battle', prompt: BS + ' ' + PIERO_P + ' HERO SHOT center. Microphone thrust toward camera gold energy beam. Palm strike. Wet cobblestones. Colonial archway gold neon.', motion: 'Gold energy beam expands. Stone walls crack. Rain drops freeze in shockwave. Camera rapid push-in to eyes.' },
    { label: 'Squad — Final', prompt: BS + ' EPIC WIDE. ' + SQUAD_COMP + ' ' + ANDINO_P + ' ' + PIERO_P + ' ' + KINNY_P + ' Three coronas red gold teal merge white. Yin yang ground. SOUTHSIDE red glitch top.', motion: 'All three advance in slow motion. Combined energy field. Massive white explosion. Freeze. SOUTHSIDE burns.' }
  ];
  const clips = [];
  for (let i = 0; i < angles.length; i++) {
    await edit(chatId, msgId, '🥷 *SQUAD factory*\n' + bar(i+1, angles.length+1) + '\n_🎨 ' + angles[i].label + '..._');
    const u = await grokImg(angles[i].prompt);
    if (u) {
      await photo(chatId, u, '🎨 ' + angles[i].label);
      await edit(chatId, msgId, '🥷 *SQUAD factory*\n' + bar(i+1, angles.length+1) + '\n_🎬 Runway: ' + angles[i].label + '..._');
      const vid = await runwayVideo(u, angles[i].motion, 5);
      if (vid) {
        await video(chatId, vid, '🎬 ' + angles[i].label);
        // Upload to R2
        try {
          const vr = await fetch(vid);
          const vb = await vr.arrayBuffer();
          const r2u = await uploadToR2(vb, 'squad_' + i + '_' + Date.now() + '.mp4', 'video/mp4');
          if (r2u) saveClip(chatId, r2u);
        } catch(e) {}
        clips.push(vid);
      }
    }
  }
  await edit(chatId, msgId, '🥷 *SQUAD factory*\n' + bar(10, 10) + '\n✅ *Completado*');
  await send(chatId, '✅ *Squad listo*\n🎨 ' + angles.length + ' imágenes\n🎬 ' + clips.length + ' clips\n_Usa /sync para mezclar con SOUTHSIDE_');
}

// SEEDANCE FACTORY
const SCENES = {
  'andino-intro':  'Wu-Tang dark anime. ANDINO solo. ' + BASE_STYLE + ' ' + CITY_BG + ' ' + ANDINO_P + ' Low angle looking up. MPC altar glowing red runes. Black smoke. Blood moon through broken arch. CAMERA rises slowly from ground. 9:16 ALL 120px.',
  'andino-battle': 'Wu-Tang dark anime. ANDINO solo. ' + BASE_STYLE + ' ' + CITY_BG + ' ' + ANDINO_P + ' Both hands striking MPC pads. Red energy beams firing from each pad. Elevated on broken ruins above dark city. CAMERA pulls back. 9:16 ALL 120px.',
  'andino-ritual': 'Wu-Tang dark anime. ANDINO solo. ' + BASE_STYLE + ' ' + CITY_BG + ' ' + ANDINO_P + ' Kneeling over MPC center yin-yang carved stone floor. Red energy flows through stone veins. Blood moon above. Top-down view. 9:16 ALL 120px.',
  'andino-finale': 'Wu-Tang dark anime. ANDINO solo. ' + BASE_STYLE + ' ' + CITY_BG + ' ' + ANDINO_P + ' Standing tall rooftop edge. Arms crossed. MPC at feet. Crimson headphones glowing. City below. Blood moon blazing. 9:16 ALL 120px.',
  'andino-street': 'Wu-Tang dark anime. ANDINO solo. ' + BASE_STYLE + ' ' + CITY_BG + ' ' + ANDINO_P + ' Walking toward camera through rain-soaked alley. MPC under arm. Steam rising. Colonial archway behind. 9:16 ALL 120px.',
  'piero-intro':   'Wu-Tang