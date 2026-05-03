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
  'piero-intro':   'Wu-Tang dark anime. PIERO solo. ' + BASE_STYLE + ' ' + CITY_BG + ' ' + PIERO_P + ' Stepping from total darkness into single candlelight. Glasses catch light first. Iron microphone raised. Gold smoke rising from tip. Stone corridor. 9:16 ALL 120px.',
  'piero-battle':  'Wu-Tang dark anime. PIERO solo. ' + BASE_STYLE + ' ' + CITY_BG + ' ' + PIERO_P + ' Battle stance rain-soaked alley. Microphone thrust forward. Gold energy beam erupting. Shockwave cracking stone walls. 9:16 ALL 120px.',
  'piero-ritual':  'Wu-Tang dark anime. PIERO solo. ' + BASE_STYLE + ' ' + CITY_BG + ' ' + PIERO_P + ' Standing center ancient stone circle. Microphone touching ground like ceremonial staff. Gold energy flowing from blood moon through mic into stone. 9:16 ALL 120px.',
  'piero-finale':  'Wu-Tang dark anime. PIERO solo. ' + BASE_STYLE + ' ' + CITY_BG + ' ' + PIERO_P + ' Direct confrontation facing camera. Microphone raised 45 degrees toward lens. Massive gold corona forming above. 9:16 ALL 120px.',
  'piero-street':  'Wu-Tang dark anime. PIERO solo. ' + BASE_STYLE + ' ' + CITY_BG + ' ' + PIERO_P + ' Leaning against wet graffiti wall under broken lamplight. Microphone hanging loose. Eyes sharp watching something off camera. 9:16 ALL 120px.',
  'kinny-intro':   'Wu-Tang dark anime. KINNY solo. ' + BASE_STYLE + ' ' + CITY_BG + ' ' + KINNY_P + ' Drops from above frame landing in perfect Shaolin crouch on wet stone. Three obsidian shuriken appear orbiting one by one. Teal energy pulses through suit. 9:16 ALL 120px.',
  'kinny-battle':  'Wu-Tang dark anime. KINNY solo. ' + BASE_STYLE + ' ' + CITY_BG + ' ' + KINNY_P + ' FROZEN MID-AIR peak of spinning aerial kick. Right leg fully extended. THREE shuriken in orbit. Teal energy corona blazing. Speed lines. 9:16 ALL 120px.',
  'kinny-ritual':  'Wu-Tang dark anime. KINNY solo. ' + BASE_STYLE + ' ' + CITY_BG + ' ' + KINNY_P + ' Kneeling in center carved stone circle. Three shuriken placed as offerings. Teal energy pulsing through suit veins. Blood moon above. Top-down view. 9:16 ALL 120px.',
  'kinny-finale':  'Wu-Tang dark anime. KINNY solo. ' + BASE_STYLE + ' ' + CITY_BG + ' ' + KINNY_P + ' Standing facing camera. Three shuriken orbiting. Weight forward coiled. Direct fierce eye contact. Massive teal energy building. 9:16 ALL 120px.',
  'kinny-street':  'Wu-Tang dark anime. KINNY solo. ' + BASE_STYLE + ' ' + CITY_BG + ' ' + KINNY_P + ' Drops from rooftop onto wet Santiago cobblestones. Steam surrounds landing. Low angle. Andes silhouette behind in storm sky. 9:16 ALL 120px.',
  intro:   BASE_STYLE + ' ' + CITY_BG + ' ' + SQUAD_COMP + ' ' + ANDINO_P + ' ' + PIERO_P + ' ' + KINNY_P + ' All three emerging from darkness. Blood moon. Yin yang ground. SOUTHSIDE red glitch. 9:16 ALL 120px.',
  battle:  BASE_STYLE + ' ' + CITY_BG + ' ' + SQUAD_COMP + ' ' + ANDINO_P + ' ' + PIERO_P + ' ' + KINNY_P + ' All three in battle action. Energy beams red gold teal crossing. SOUTHSIDE. 9:16 ALL 120px.',
  ritual:  BASE_STYLE + ' ' + CITY_BG + ' ' + SQUAD_COMP + ' ' + ANDINO_P + ' ' + PIERO_P + ' ' + KINNY_P + ' Triangle yin yang stone floor blood moon. Three coronas merging. SOUTHSIDE. 9:16 ALL 120px.',
  finale:  BASE_STYLE + ' ' + CITY_BG + ' ' + SQUAD_COMP + ' ' + ANDINO_P + ' ' + PIERO_P + ' ' + KINNY_P + ' All three advancing toward camera. Massive combined energy burst. SOUTHSIDE. 9:16 ALL 120px.',
  street:  BASE_STYLE + ' ' + CITY_BG + ' ' + SQUAD_COMP + ' ' + ANDINO_P + ' ' + PIERO_P + ' ' + KINNY_P + ' Santiago alley 3am all three emerging from steam. Colonial archway. Andes. Blood moon. SOUTHSIDE. 9:16 ALL 120px.',

  // NAME REVEAL scenes — character name burns into frame like SOUTHSIDE
  'andino-name':  BASE_STYLE + ' ' + CITY_BG + ' ' + ANDINO_P + ' Full body dramatic low angle. Dark smoke surrounds him. MPC runes pulsing red. Massive bold distressed glitch typography spelling exactly ANDINO in blood crimson red — same exact style font weight and glitch effect as SOUTHSIDE title card — positioned in UPPER THIRD of frame above character head. Blood moon above. Andes silhouette. 9:16 ALL 120px safe margins.',
  'piero-name':   BASE_STYLE + ' ' + CITY_BG + ' ' + PIERO_P + ' Full body center frame. Gold energy corona forming above. Iron microphone raised. Massive bold distressed glitch typography — THE TEXT MUST READ EXACTLY: first line "PIERO" second line "LA ROCCA" — spelled P-I-E-R-O and L-A-R-O-C-C-A — in blood crimson red — same exact style font weight and glitch effect as SOUTHSIDE title card — positioned in UPPER THIRD of frame above character head. Stone walls crack. 9:16 ALL 120px safe margins.',
  'kinny-name':   BASE_STYLE + ' ' + CITY_BG + ' ' + KINNY_P + ' Mid-air frozen kick. Three shuriken orbiting. Teal energy blazing. Massive bold distressed glitch typography spelling exactly IlKINNY in blood crimson red — same exact style font weight and glitch effect as SOUTHSIDE title card — positioned in UPPER THIRD of frame above character head. Speed lines everywhere. 9:16 ALL 120px safe margins.',
  'squad-name':   BASE_STYLE + ' ' + CITY_BG + ' ' + SQUAD_COMP + ' ' + ANDINO_P + ' ' + PIERO_P + ' ' + KINNY_P + ' All three in triangle formation advancing toward camera. Three energy coronas red gold teal merging into white at center. Blood moon blazing above. Yin yang erupting from wet ground. Heavy black smoke. No text no typography. Pure cinematic power. 9:16 ALL 120px.'
};

async function runSeedance(chatId, concept) {
  const msgId = await send(chatId, '🌱 *Seedance factory*\n' + bar(0, 10) + '\n_Iniciando..._');
  if (!OPENROUTER_KEY) { await edit(chatId, msgId, '❌ OPENROUTER_KEY no configurada.'); return; }

  const sceneKey = concept?.toLowerCase().trim();
  const prompt = SCENES[sceneKey] || concept || SCENES.intro;

  await edit(chatId, msgId, '🌱 *Seedance factory*\n' + bar(2, 10) + '\n_🎨 Generando frame referencia Grok..._');
  const refImg = await grokImg(prompt.slice(0, 500));
  if (refImg) await photo(chatId, refImg, '🎨 Frame referencia');

  await edit(chatId, msgId, '🌱 *Seedance factory*\n' + bar(4, 10) + '\n_🎬 ' + currentVideoModel.split('/')[1] + ' generando..._');
  const vid = await seedanceVideo(prompt, null);

  if (vid) {
    await edit(chatId, msgId, '🌱 *Seedance factory*\n' + bar(8, 10) + '\n_📥 Descargando y subiendo a R2..._');
    try {
      const vr = await fetch(vid, { headers: { 'Authorization': 'Bearer ' + OPENROUTER_KEY } });
      const vb = await vr.arrayBuffer();
      const filename = 'seedance_' + (sceneKey || 'clip') + '_' + Date.now() + '.mp4';
      const r2u = await uploadToR2(vb, filename, 'video/mp4');
      const clipUrl = r2u || vid;
      saveClip(chatId, clipUrl);
      const form = new FormData();
      form.append('chat_id', String(chatId));
      form.append('video', new Blob([vb], { type: 'video/mp4' }), filename);
      form.append('caption', '🎬 Seedance — ' + (sceneKey || 'clip') + (r2u ? ' ✅ R2' : ''));
      await fetch('https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/sendVideo', { method: 'POST', body: form });
      await edit(chatId, msgId, '🌱 *Seedance factory*\n' + bar(10, 10) + '\n✅ *Completado — guardado para /sync*');
    } catch(e) {
      await edit(chatId, msgId, '✅ Video listo: ' + vid);
    }
  } else {
    await edit(chatId, msgId, '❌ No generó video. Verifica créditos en openrouter.ai');
  }
}

// RUNWAY CINEMATIC SCENES
const RUNWAY_SCENES = {
  'andino-intro':   { img: BASE_STYLE + ' ' + CITY_BG + ' ' + ANDINO_P + ' Low angle. MPC altar red runes. Blood moon broken arch. 9:16 ALL 120px.', motion: 'Camera rises slowly from ground toward ANDINO. Red runes pulse. Black smoke drifts upward. Blood moon intensifies. Dark ritual energy builds.' },
  'andino-battle':  { img: BASE_STYLE + ' ' + CITY_BG + ' ' + ANDINO_P + ' Both hands MPC mid-strike. Red energy beams. Elevated broken ruins. 9:16 ALL 120px.', motion: 'Camera pulls back revealing full scale. MPC strikes send red shockwaves. Debris swirls. Crimson light pulses with beat.' },
  'andino-ritual':  { img: BASE_STYLE + ' ' + CITY_BG + ' ' + ANDINO_P + ' Kneeling MPC center yin-yang stone floor. Red energy through stone veins. Blood moon. Top-down. 9:16 ALL 120px.', motion: 'Top-down camera descends slowly. Red energy pulses through stone carvings like blood. Yin-yang brightens. Ancient ritual builds.' },
  'andino-finale':  { img: BASE_STYLE + ' ' + CITY_BG + ' ' + ANDINO_P + ' Standing rooftop edge. Arms crossed. MPC at feet. Crimson headphones glowing. Blood moon. 9:16 ALL 120px.', motion: 'Camera slow push-in. Wind presses suit. Crimson headphones pulse. Direct eye contact through mask. Absolute stillness of a master.' },
  'andino-street':  { img: BASE_STYLE + ' ' + CITY_BG + ' ' + ANDINO_P + ' Walking toward camera rain-soaked alley. MPC under arm. Steam. Colonial archway. 9:16 ALL 120px.', motion: 'Long lens compression ANDINO walks toward camera through rain. Each step red ripple through puddles. Steam parts. Unstoppable approach.' },
  'piero-intro':    { img: BASE_STYLE + ' ' + CITY_BG + ' ' + PIERO_P + ' Stepping from darkness into candlelight. Glasses catch light. Iron microphone raised. Gold smoke from tip. Stone corridor. 9:16 ALL 120px.', motion: 'PIERO materializes from pure darkness. Gold smoke rises from mic tip. Camera slow push-in. Glasses glint gold. Voice of the clan.' },
  'piero-battle':   { img: BASE_STYLE + ' ' + CITY_BG + ' ' + PIERO_P + ' Battle stance rain alley. Mic thrust forward. Gold energy beam. Shockwave cracking walls. 9:16 ALL 120px.', motion: 'Gold energy beam expands with force. Stone walls crack. Rain freezes in shockwave. Camera rapid push-in to eyes behind glasses.' },
  'piero-ritual':   { img: BASE_STYLE + ' ' + CITY_BG + ' ' + PIERO_P + ' Center stone circle. Mic as ceremonial staff. Gold energy from blood moon through mic into stone. 9:16 ALL 120px.', motion: 'Gold light from blood moon through PIERO into mic. Stone carvings illuminate gold outward. Camera circles slowly. Ancient power.' },
  'piero-finale':   { img: BASE_STYLE + ' ' + CITY_BG + ' ' + PIERO_P + ' Facing camera. Mic raised toward lens. Gold corona forming above. 9:16 ALL 120px.', motion: 'PIERO raises mic directly at camera slow motion. Gold corona expands massively. Camera pushed back by force. White gold flash.' },
  'piero-street':   { img: BASE_STYLE + ' ' + CITY_BG + ' ' + PIERO_P + ' Leaning graffiti wall broken lamplight. Mic hanging. Eyes watching. 9:16 ALL 120px.', motion: 'PIERO pushes off wall fluid motion toward camera. Gold builds around mic each step. He stops center. Gold shockwave ripples.' },
  'kinny-intro':    { img: BASE_STYLE + ' ' + CITY_BG + ' ' + KINNY_P + ' Drops from above landing Shaolin crouch wet stone. Three shuriken appear orbiting. Teal energy pulses. 9:16 ALL 120px.', motion: 'KINNY drops into frame lands in stillness. Three shuriken materialize orbit in sequence. Teal energy pulses through markings. Coiled readiness.' },
  'kinny-battle':   { img: BASE_STYLE + ' ' + CITY_BG + ' ' + KINNY_P + ' FROZEN mid-air peak spinning kick. Leg fully extended. THREE shuriken orbit. Teal corona blazing. Speed lines. 9:16 ALL 120px.', motion: 'Time resumes from frozen peak ULTRA SLOW MOTION. Leg completes arc motion blur. Shuriken scatter. Teal explosion from body. Camera 180 rotation.' },
  'kinny-ritual':   { img: BASE_STYLE + ' ' + CITY_BG + ' ' + KINNY_P + ' Kneeling stone circle. Three shuriken as offerings. Teal pulsing. Blood moon. Top-down. 9:16 ALL 120px.', motion: 'Teal energy pulses through KINNY in breathing rhythm. Shuriken rotate slowly like satellites. He stands arms raised. Teal corona explodes upward.' },
  'kinny-finale':   { img: BASE_STYLE + ' ' + CITY_BG + ' ' + KINNY_P + ' Facing camera. Three shuriken orbiting. Weight forward. Direct eye contact. Massive teal energy building. 9:16 ALL 120px.', motion: 'One slow step forward. Shuriken orbit accelerates. Teal corona expands with each breath. Camera pushed backward. Massive teal explosion freeze.' },
  'kinny-street':   { img: BASE_STYLE + ' ' + CITY_BG + ' ' + KINNY_P + ' Drops rooftop wet Santiago cobblestones. Steam surrounds. Low angle. Andes behind. 9:16 ALL 120px.', motion: 'Landing teal shockwave ripples. Camera looks up as KINNY rises to full height. Shuriken orbit. Walks through steam toward camera.' },
  intro:   { img: BASE_STYLE + ' ' + CITY_BG + ' ' + SQUAD_COMP + ' All three emerging from darkness. Blood moon. SOUTHSIDE. 9:16 ALL 120px.', motion: 'All three materialize from darkness. Energy coronas ignite. Camera pulls back. Blood moon blazes. Yin yang erupts. SOUTHSIDE burns.' },
  battle:  { img: BASE_STYLE + ' ' + CITY_BG + ' ' + SQUAD_COMP + ' All three battle simultaneously. Red gold teal crossing. SOUTHSIDE. 9:16 ALL 120px.', motion: 'All three unleash simultaneously. Red gold teal energy beams cross center. Camera pulls back fast. Pure power.' },
  ritual:  { img: BASE_STYLE + ' ' + CITY_BG + ' ' + SQUAD_COMP + ' Triangle yin yang floor blood moon. Three coronas merging. 9:16 ALL 120px.', motion: 'Three coronas merge into white light. Yin yang expands. Camera descends from above. Ancient ritual complete.' },
  finale:  { img: BASE_STYLE + ' ' + CITY_BG + ' ' + SQUAD_COMP + ' All three advancing camera. Combined energy burst. SOUTHSIDE. 9:16 ALL 120px.', motion: 'All three advance slow motion. Combined energy pushes camera back. Massive white explosion. Freeze. SOUTHSIDE.' },
  street:  { img: BASE_STYLE + ' ' + CITY_BG + ' ' + SQUAD_COMP + ' Santiago alley 3am steam. Colonial archway. 9:16 ALL 120px.', motion: 'All three emerge from steam walk toward camera through rain. Each step colored energy ripple. Stop simultaneously. Camera orbits 360.' }
};

async function runRunwayScene(chatId, sceneKey) {
  const msgId = await send(chatId, '🎬 *Runway factory*\n' + bar(0, 10) + '\n_Escena: ' + sceneKey + '..._');
  const scene = RUNWAY_SCENES[sceneKey];
  if (!scene) { await edit(chatId, msgId, '❌ Escena no encontrada. Usa `/runway` para ver opciones.'); return; }
  await edit(chatId, msgId, '🎬 *Runway factory*\n' + bar(3, 10) + '\n_🎨 Grok generando imagen..._');
  const imgUrl = await grokImg(scene.img);
  if (!imgUrl) { await edit(chatId, msgId, '❌ Grok no generó imagen.'); return; }
  await photo(chatId, imgUrl, '🎨 Frame: ' + sceneKey);
  await edit(chatId, msgId, '🎬 *Runway factory*\n' + bar(6, 10) + '\n_🎬 Runway animando..._');
  const vid = await runwayVideo(imgUrl, scene.motion, 5);
  if (vid) {
    await video(chatId, vid, '🎬 Runway — ' + sceneKey);
    await edit(chatId, msgId, '🎬 *Runway factory*\n' + bar(9, 10) + '\n_☁️ Subiendo a R2..._');
    try {
      const vr = await fetch(vid);
      const vb = await vr.arrayBuffer();
      const filename = 'runway_' + sceneKey.replace('-', '_') + '_' + Date.now() + '.mp4';
      const r2u = await uploadToR2(vb, filename, 'video/mp4');
      if (r2u) saveClip(chatId, r2u);
    } catch(e) { saveClip(chatId, vid); }
    await edit(chatId, msgId, '🎬 *Runway factory*\n' + bar(10, 10) + '\n✅ *Completado — guardado para /sync*');
  } else {
    await edit(chatId, msgId, '❌ Runway no generó el clip.');
  }
}

// SHOTSTACK SYNC
async function runSync(chatId, clipUrls) {
  const msgId = await send(chatId, '🎵 *Sync factory*\n' + bar(0, 10) + '\n_Iniciando..._');
  const SHOTSTACK_KEY = process.env.SHOTSTACK_KEY;
  if (!SHOTSTACK_KEY) { await edit(chatId, msgId, '❌ SHOTSTACK_KEY no configurada.'); return; }
  if (!clipUrls || clipUrls.length === 0) { await edit(chatId, msgId, '❌ No hay clips. Usa /syncr2 primero.'); return; }

  await edit(chatId, msgId, '🎵 *Sync factory*\n' + bar(3, 10) + '\n_Construyendo timeline con ' + clipUrls.length + ' clips..._');

  // BPM sync — 103 BPM — drop at second 2
  const BPM = 103;
  const beat = 60 / BPM;           // 0.583s per beat
  const bar2 = beat * 2;           // 1.165s — 2 beats
  const bar4 = beat * 4;           // 2.33s — 4 beats
  const bar8 = beat * 8;           // 4.66s — 8 beats
  const bar16 = beat * 16;         // 9.32s — 16 beats
  const DROP = 2.0;                // drop at second 2

  // Mixed cuts — first cut lands on drop at second 2
  // Each clip has a trim offset to start from most dynamic moment (1.5s in)
  const TRIM = 2.0; // skip first 2s of each clip — hit dynamic moment
  const MAX_CLIP = 4.5; // clips are 5s, cap at 4.5s to avoid freeze on last frame
  const durations = clipUrls.map((_, i) => {
    if (i === 0) return Math.min(DROP, MAX_CLIP);          // first clip — drop
    if (i === clipUrls.length - 1) return Math.min(bar8, MAX_CLIP); // last clip — 8 beats max 4.5s
    return Math.min(bar4, MAX_CLIP);                       // middle clips — 4 beats max 4.5s
  });

  // Calculate start times
  const starts = [];
  let t = 0;
  durations.forEach(d => { starts.push(parseFloat(t.toFixed(3))); t += d; });
  console.log('BPM sync: drop at ' + DROP + 's, total: ' + parseFloat(t.toFixed(2)) + 's, clips: ' + clipUrls.length);

  const timeline = {
    soundtrack: { src: SOUTHSIDE_AUDIO, volume: 1 },
    tracks: [{
      clips: clipUrls.map((url, i) => ({
        asset: { type: 'video', src: url, volume: 0, trim: i === 0 ? 0 : TRIM },
        start: starts[i],
        length: parseFloat(durations[i].toFixed(3)),
        transition: { in: i === 0 ? 'fadeFast' : 'none', out: i === clipUrls.length - 1 ? 'fadeFast' : 'none' },
        fit: 'crop'
      }))
    }],
    background: '#000000'
  };

  console.log('BPM sync: ' + clipUrls.length + ' clips, total duration: ' + parseFloat(t.toFixed(2)) + 's');

  try {
    const sr = await fetch('https://api.shotstack.io/edit/stage/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': SHOTSTACK_KEY },
      body: JSON.stringify({ timeline, output: { format: 'mp4', resolution: 'hd', aspectRatio: '9:16', fps: 25 } })
    });
    const sd = await sr.json();
    console.log('Shotstack submit:', JSON.stringify(sd).slice(0, 200));
    if (!sd.response?.id) { await edit(chatId, msgId, '❌ Shotstack error: ' + JSON.stringify(sd).slice(0, 200)); return; }

    const renderId = sd.response.id;
    await edit(chatId, msgId, '🎵 *Sync factory*\n' + bar(5, 10) + '\n_Renderizando..._');

    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 10000));
      const pr = await fetch('https://api.shotstack.io/edit/stage/render/' + renderId, { headers: { 'x-api-key': SHOTSTACK_KEY } });
      const pd = await pr.json();
      const status = pd.response?.status;
      const url = pd.response?.url;
      console.log('Shotstack poll ' + i + ':', status);
      await edit(chatId, msgId, '🎵 *Sync factory*\n' + bar(5 + Math.min(i, 4), 10) + '\n_Renderizando ' + (i*10) + 's..._');
      if (status === 'done' && url) {
        await edit(chatId, msgId, '🎵 *Sync factory*\n' + bar(9, 10) + '\n_📥 Descargando..._');
        try {
          const vr = await fetch(url);
          const vb = await vr.arrayBuffer();
          const form = new FormData();
          form.append('chat_id', String(chatId));
          form.append('video', new Blob([vb], { type: 'video/mp4' }), 'southside_final.mp4');
          form.append('caption', '🎵 SOUTHSIDE — ' + clipUrls.length + ' clips BPM 103');
          await fetch('https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/sendVideo', { method: 'POST', body: form });
        } catch(e) {
          console.error('Send error:', e.message);
          await tg('sendMessage', { chat_id: chatId, text: '📥 Video listo: ' + url });
        }
        await edit(chatId, msgId, '🎵 *Sync factory*\n' + bar(10, 10) + '\n✅ *Video final listo*');
        return;
      }
      if (status === 'failed') { await edit(chatId, msgId, '❌ Shotstack render falló: ' + (typeof pd.response?.error === 'string' ? pd.response.error : JSON.stringify(pd.response?.error || pd))); return; }
    }
    await edit(chatId, msgId, '❌ Timeout.');
  } catch(e) { await edit(chatId, msgId, '❌ Error: ' + e.message); }
}

// BOYKOT FACTORY
const BOYKOT_STYLE = 'Editorial Instagram for Boykot.cl Chilean art supply store. Brand: black background #000000 acid yellow-green #CCFF00 accent. Clean minimal product editorial. Urban art supplies. Target: artists illustrators muralists designers Chile.';

async function runBoykotPost(chatId, topic) {
  const msgId = await send(chatId, '🎨 *Boykot factory*\n' + bar(0, 10) + '\n_Iniciando..._');
  await edit(chatId, msgId, '🎨 *Boykot factory*\n' + bar(2, 10) + '\n_Generando contenido..._');
  const system = 'Eres community manager Boykot.cl tienda materiales artisticos chilena. Genera contenido Instagram espanol tono cercano apasionado por el arte. Devuelve SOLO JSON: {"caption":"...","hashtags":"...","slide_prompts":["p1","p2","p3"]}';
  let postData;
  try {
    const raw = await deepseek('Genera contenido Instagram Boykot.cl sobre: ' + topic, system);
    if (raw) postData = JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch(e) { postData = null; }
  if (!postData) {
    postData = {
      caption: topic + ' — disponible en Boykot.cl',
      hashtags: '#boykot #artesupplies #chile #arte #pintura #ilustracion #diseno',
      slide_prompts: [
        'Product hero ' + topic + ' black background #CCFF00 rim lighting. Minimal editorial.',
        'Detail close-up ' + topic + ' macro. High contrast black #CCFF00.',
        'Lifestyle dark studio artist using ' + topic + '. Chilean urban art. #CCFF00 accent.'
      ]
    };
  }
  await edit(chatId, msgId, '🎨 *Boykot factory*\n' + bar(3, 10) + '\n_Copy listo_');
  await send(chatId, '📝 *Caption Boykot:*\n\n' + postData.caption + '\n\n' + postData.hashtags);
  const slides = postData.slide_prompts || [];
  const carouselUrls = [];
  for (let i = 0; i < Math.min(slides.length, 3); i++) {
    await edit(chatId, msgId, '🎨 *Boykot factory*\n' + bar(4+i, 10) + '\n_📸 Carrusel ' + (i+1) + '/3..._');
    const u = await grokImg('Square 1:1. Safe 100px all sides. ' + BOYKOT_STYLE + ' ' + slides[i] + ' ALL inside 100px. No watermarks.');
    if (u) { carouselUrls.push(u); await photo(chatId, u, 'Carrusel ' + (i+1) + '/3 — Boykot.cl'); }
  }
  const reelUrls = [];
  for (let i = 0; i < Math.min(slides.length, 3); i++) {
    await edit(chatId, msgId, '🎨 *Boykot factory*\n' + bar(7+i, 10) + '\n_🎬 Reel ' + (i+1) + '/3..._');
    const u = await grokImg('Vertical 9:16. Safe 120px all sides. ' + BOYKOT_STYLE + ' ' + slides[i] + ' ALL inside 120px. No watermarks.');
    if (u) { reelUrls.push(u); await photo(chatId, u, 'Reel ' + (i+1) + '/3 — Boykot.cl'); }
  }
  let clips = 0;
  if (process.env.RUNWAY_KEY && reelUrls.length > 0) {
    const motions = ['Product reveal slow push-in. Neon yellow-green sweeps surface. Commercial editorial.', 'Detail zoom macro. Acid yellow highlight traces edge. Professional.', 'Lifestyle artist hand motion blur. Yellow-green neon glow pulses.'];
    for (let i = 0; i < reelUrls.length; i++) {
      const vid = await runwayVideo(reelUrls[i], motions[i], 3);
      if (vid) { await video(chatId, vid, 'Reel clip ' + (i+1) + ' Boykot.cl'); clips++; }
    }
  }
  await edit(chatId, msgId, '🎨 *Boykot factory*\n' + bar(10, 10) + '\n✅ *Completado*');
  await send(chatId, '✅ *Boykot listo*\n📸 Carrusel: ' + carouselUrls.length + '/3\n🎬 Reel frames: ' + reelUrls.length + '/3\n🎥 Clips: ' + clips);
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
      const fr = await fetch('https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/getFile?file_id=' + p.file_id);
      const fd = await fr.json();
      const imgUrl = 'https://api.telegram.org/file/bot' + TELEGRAM_TOKEN + '/' + fd.result?.file_path;
      const ir = await fetch(imgUrl);
      const ib = await ir.arrayBuffer();
      const dataUrl = 'data:image/jpeg;base64,' + Buffer.from(ib).toString('base64');
      const motionPrompt = caption || 'Slow 360 product rotation. Professional studio lighting. Dark background subtle neon reflection. Smooth rotation. Commercial product video.';
      await edit(chatId, msgId, '🎬 Runway generando... (~2 min)');
      const rr = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.RUNWAY_KEY, 'X-Runway-Version': '2024-11-06' },
        body: JSON.stringify({ model: 'gen4_turbo', promptImage: dataUrl, promptText: motionPrompt, ratio: '720:1280', duration: 5 })
      });
      const rd = await rr.json();
      if (!rd.id) { await edit(chatId, msgId, '❌ Runway: ' + JSON.stringify(rd).slice(0, 100)); return; }
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 10000));
        const t = await (await fetch('https://api.dev.runwayml.com/v1/tasks/' + rd.id, { headers: { 'Authorization': 'Bearer ' + process.env.RUNWAY_KEY, 'X-Runway-Version': '2024-11-06' } })).json();
        if (t.status === 'SUCCEEDED') { await video(chatId, t.output?.[0], '🎬 Video listo'); await edit(chatId, msgId, '✅ Listo'); return; }
        if (t.status === 'FAILED') { await edit(chatId, msgId, '❌ Runway falló.'); return; }
        await edit(chatId, msgId, '🎬 Runway... ' + (i*10) + 's');
      }
    } catch(e) { await edit(chatId, msgId, '❌ Error: ' + e.message); }
    return;
  }

  if (text === '/start') {
    await send(chatId, '🎨 *maarmapa factory v7*\n\n`/post [tema]` — post maarmapa\n`/boykot [producto]` — post Boykot\n`/runway [escena]` — Grok+Runway\n`/seedance [escena]` — Seedance\n`/squad` — multi-angulo squad\n`/anime` — anime squad\n`/syncr2` — cargar clips R2\n`/addclip [URL]` — agregar clip\n`/sync` — mezclar SOUTHSIDE\n`/clips` — ver clips\n`/clearclips` — borrar clips\n`/buscar [query]` — noticias\n`/chat [pregunta]` — agente\n`/help` — ver todas las escenas');
    return;
  }

  if (text === '/help') {
    await send(chatId, '🎬 *Escenas disponibles:*\n\n*Squad:*\n`intro` `battle` `ritual` `finale` `street`\n\n*Andino:*\n`andino-intro` `andino-battle` `andino-ritual` `andino-finale` `andino-street` `andino-name`\n\n*Piero:*\n`piero-intro` `piero-battle` `piero-ritual` `piero-finale` `piero-street` `piero-name`\n\n*Kinny:*\n`kinny-intro` `kinny-battle` `kinny-ritual` `kinny-finale` `kinny-street` `kinny-name`\n\n*Nombres:*\n`andino-name` `piero-name` `kinny-name` `squad-name`\n\nEj: `/seedance kinny-battle` o `/runway andino-name`');
    return;
  }

  if (text.startsWith('/post ')) {
    runFactory(chatId, text.replace('/post ', '')).catch(e => send(chatId, '❌ ' + e.message));
    return;
  }

  if (text.startsWith('/boykot ')) {
    runBoykotPost(chatId, text.replace('/boykot ', '')).catch(e => send(chatId, '❌ ' + e.message));
    return;
  }

  if (text.startsWith('/anime') || text === '/anime') {
    runAnime(chatId, text.replace('/anime', '').trim() || 'southside').catch(e => send(chatId, '❌ ' + e.message));
    return;
  }

  if (text === '/squad') {
    runSquad(chatId).catch(e => send(chatId, '❌ ' + e.message));
    return;
  }

  if (text.startsWith('/seedance')) {
    const concept = text.replace('/seedance', '').trim();
    if (!concept) {
      await send(chatId, '🌱 *Seedance Escenas:*\n\n*Andino:* andino-intro andino-battle andino-ritual andino-finale andino-street\n*Piero:* piero-intro piero-battle piero-ritual piero-finale piero-street\n*Kinny:* kinny-intro kinny-battle kinny-ritual kinny-finale kinny-street\n*Squad:* intro battle ritual finale street\n\nEj: `/seedance kinny-battle`');
      return;
    }
    runSeedance(chatId, concept).catch(e => send(chatId, '❌ ' + e.message));
    return;
  }

  if (text.startsWith('/runway')) {
    const arg = text.replace('/runway', '').trim().toLowerCase();
    if (!arg) {
      await send(chatId, '🎬 *Runway Escenas:*\n\n*Andino:* andino-intro andino-battle andino-ritual andino-finale andino-street\n*Piero:* piero-intro piero-battle piero-ritual piero-finale piero-street\n*Kinny:* kinny-intro kinny-battle kinny-ritual kinny-finale kinny-street\n*Squad:* intro battle ritual finale street\n\nEj: `/runway kinny-battle`');
      return;
    }
    runRunwayScene(chatId, arg).catch(e => send(chatId, '❌ ' + e.message));
    return;
  }

  if (text === '/syncr2') {
    const msgId = await send(chatId, '☁️ Buscando clips en R2...');
    try {
      const r = await fetch(R2_WORKER + '/?list=true');
      const d = await r.json();
      const clips = (d.objects || []).filter(k => k.endsWith('.mp4') && !k.includes('test') && !k.includes('Sin') && !k.includes(' ')).map(k => R2_BASE + encodeURIComponent(k));
      if (clips.length === 0) { await edit(chatId, msgId, '❌ No hay clips MP4 en R2.'); return; }
      clips.forEach(url => saveClip(chatId, url));
      await edit(chatId, msgId, '✅ ' + clips.length + ' clips cargados de R2. Usa /sync para mezclarlos con SOUTHSIDE.');
    } catch(e) { await edit(chatId, msgId, '❌ Error: ' + e.message); }
    return;
  }

  if (text.startsWith('/addclip')) {
    const urls = text.replace('/addclip', '').trim().split(' ').filter(u => u.startsWith('http'));
    if (urls.length === 0) { await send(chatId, '❌ Uso: `/addclip URL1 URL2 URL3`'); return; }
    urls.forEach(url => saveClip(chatId, url));
    await send(chatId, '✅ ' + urls.length + ' clip(s) agregados. Total: ' + getClips(chatId).length + '\nUsa `/sync` para mezclarlos.');
    return;
  }

  if (text.startsWith('/sync')) {
    const args = text.replace('/sync', '').trim().split(' ').filter(u => u.startsWith('http'));
    const clips = args.length > 0 ? args : getClips(chatId);
    if (clips.length === 0) { await send(chatId, '❌ No hay clips. Usa `/syncr2` o genera clips con `/runway` o `/seedance`.'); return; }
    runSync(chatId, clips).catch(e => send(chatId, '❌ ' + e.message));
    return;
  }

  if (text === '/clips') {
    const clips = getClips(chatId);
    if (clips.length === 0) { await send(chatId, '📋 No hay clips guardados. Usa `/syncr2` para cargar desde R2.'); return; }
    await send(chatId, '📋 *' + clips.length + ' clips:*\n' + clips.map((u, i) => (i+1) + '. ' + u.split('/').pop().slice(0, 40)).join('\n') + '\n\nUsa `/sync` para mezclarlos.');
    return;
  }

  if (text === '/clearclips') {
    clearClips(chatId);
    await send(chatId, '🗑 Clips borrados.');
    return;
  }

  if (text.startsWith('/buscar ')) {
    const query = text.replace('/buscar ', '');
    const msgId = await send(chatId, '🔍 _Buscando: ' + query + '..._');
    try {
      const r = await fetch(AGENT_URL + '/grok', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
      const d = await r.json();
      await edit(chatId, msgId, (d.reply || 'Sin resultados').slice(0, 4000));
    } catch(e) { await edit(chatId, msgId, '❌ ' + e.message); }
    return;
  }

  if (text.startsWith('/chat ')) {
    const q = text.replace('/chat ', '');
    const msgId = await send(chatId, '💬 _Pensando..._');
    try {
      const reply = await deepseek(q, 'Eres maarmapa artista urbano chileno con conocimiento de arte cultura blockchain ciudades. Responde en espanol.');
      if (reply) { await edit(chatId, msgId, reply.slice(0, 4000)); return; }
      const r = await fetch(AGENT_URL + '/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: q }] }) });
      const d = await r.json();
      await edit(chatId, msgId, (d.reply || '...').slice(0, 4000));
    } catch(e) { await edit(chatId, msgId, '❌ ' + e.message); }
    return;
  }

  if (text === '/digest') {
    const msgId = await send(chatId, '📰 _Generando digest..._');
    try {
      const reply = await deepseek('Genera digest semanal noticias arte contemporaneo marketing viral blockchain AI esta semana. 5-7 noticias descripcion breve. Espanol.', null);
      if (reply) { await edit(chatId, msgId, reply.slice(0, 4000)); return; }
      const r = await fetch(AGENT_URL + '/digest');
      await edit(chatId, msgId, ((await r.json()).digest || 'Error').slice(0, 4000));
    } catch(e) { await edit(chatId, msgId, '❌ ' + e.message); }
    return;
  }

  if (text && !text.startsWith('/')) {
    if (text.startsWith('https://pub-5dd65bdf9977446c93204c83d30ec735.r2.dev/') && text.endsWith('.mp4')) {
      saveClip(chatId, text.trim());
      await send(chatId, '✅ Clip guardado. Total: ' + getClips(chatId).length + '\nUsa `/sync` para mezclar.');
      return;
    }
    await send(chatId, '💡 `/post [tema]` — post\n`/runway [escena]` — video\n`/seedance [escena]` — video\n`/buscar [tema]` — noticias');
  }
}

// POLLING
async function poll() {
  console.log('maarmapa bot v7 — Grok+Runway+Seedance+Shotstack+DeepSeek+R2');
  let offset = 0;
  while (true) {
    try {
      const r = await fetch('https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/getUpdates?offset=' + offset + '&timeout=30');
      const d = await r.json();
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

require('http').createServer((q, s) => { s.writeHead(200); s.end('maarmapa bot v7 online'); }).listen(process.env.PORT || 3000);
poll();
// redeploy trigger Sat May  2 22:21:20 -04 2026
