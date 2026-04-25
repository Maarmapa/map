// maarmapa — Telegram Bot v6
// Claude + Grok + Runway + Seedance + DeepSeek V4 + Veo 3.1
const AGENT_URL = process.env.AGENT_URL || 'https://maarmapa-agent.onrender.com';
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENROUTER_KEY = process.env.OPENROUTER_KEY;
const SOUTH_SIDE_AUDIO = 'https://pub-5dd65bdf9977446c93204c83d30ec735.r2.dev/SOUTH_SIDE_CRIMINI.mp3';

// Clip storage — auto-saves all generated video URLs per chat
const clipStore = {};
function saveClip(chatId, url) {
  if (!clipStore[chatId]) clipStore[chatId] = [];
  clipStore[chatId].push(url);
  // Keep last 20 clips
  if (clipStore[chatId].length > 20) clipStore[chatId].shift();
}
function getClips(chatId) { return clipStore[chatId] || []; }
function clearClips(chatId) { clipStore[chatId] = []; }

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

// CHARACTER BIBLES — Trap Jamaican Chile vibes. Black magic. Dark ritual energy.
// Vibe: smoke, ritual, dark spirits, jungle meets concrete, bass heavy atmosphere
const BASE_STYLE = 'Hyper-cinematic dark anime. Katsuhiro Otomo Akira meets Wu-Tang Clan 36 Chambers album art. Thick rough brush ink outlines. Mature ultra-dark occult gritty. NOT kawaii NOT chibi. Crushing black ink shadows. Black incense smoke. Heavy film grain. Ancient Shaolin scroll art fused with Latin American street art. Black magic ritual trap energy. Blood moon. No bright colors — only deep blacks, blood crimsons, tarnished gold, shadow teal.';
const CITY_BG = 'Background: abandoned Shaolin temple ruins in dark Santiago barrio night — crumbling stone arches with faded Chinese ink paintings and Spanish graffiti tags, thick black smoke at ground level, single blood-red lantern glowing far away, Andes mountain silhouette barely visible through storm clouds, wet black cobblestones with ancient symbols carved in them, no neon — only candlelight and blood-red moon through storm clouds. Total darkness aesthetic.';
const ANDINO_P = 'ANDINO — full PITCH MATTE BLACK ninja suit, ONLY two calm predator eyes glowing faint crimson. Battle-scarred oversized crimson red headphones over ninja hood. Ancient MPC drum machine at feet like a ritual altar — red runes glowing on pads, dark smoke rising. Monk-still posture. BACKGROUND center partially in shadow. Ancient red Wu-clan tattoo on suit barely visible. Black smoke curls around him. Architect watching from darkness.';
const PIERO_P = 'PIERO — full CHARCOAL BLACK ninja suit aged worn texture, ONLY sharp calculating eyes behind thick-frame scarred glasses over mask. Holding black iron microphone upward like ritual weapon, free hand in Shaolin open-palm strike. FOREGROUND LEFT. Tarnished gold clan seal on chest. Shadow falls across half his face. Voice of the clan.';
const KINNY_P = 'KINNY — full DEEP SHADOW ninja suit with dark teal energy pulsing in markings like veins. ONLY fierce feral predator eyes. FOREGROUND RIGHT, body coiled in low explosive Shaolin stance — knees bent weight forward, one hand on wet ground, other arm cocked back. Three obsidian shuriken hanging from belt like talismans. Battle-worn. Dark smoke at feet. Pure kinetic black magic.';
const SQUAD_COMP = 'COMPOSITION: PIERO foreground left, KINNY foreground right, ANDINO center-back partially in shadow smaller — three-point triangle depth. All three inside safe margins. Blood red moon above all three. Heavy black smoke atmosphere between them.';

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
  try {
    await tg('sendVideo', { chat_id: chatId, video: url, caption });
    if (url && url.startsWith('http')) saveClip(chatId, url);
  } catch(e) {}
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
  const HORROR_BASE = 'Hyper-cinematic dark anime horror. Katsuhiro Otomo meets Junji Ito aesthetic. Cel-shading heavy brush ink. Ultra-dark mature NOT kawaii. VHS grain distortion. 103 BPM energy. Dancehall horror. Distorted violin string ghost apparitions. Blood moon. Black flooded Santiago cobblestones. ALL inside 120px safe margins. 9:16 vertical.';
  const scenePrompts = [
    HORROR_BASE + ' SHOT 1. ' + ANDINO_P + ' Standing abandoned Plaza de Armas Santiago 3am. Colonial cathedral warped twisted nightmare behind. Black water flooding cobblestones. MPC altar glowing blood red, violin ghost apparitions rising from pads. Blood moon full massive low. Dancehall skeleton figures in shadows moving in rhythm.',
    HORROR_BASE + ' SHOT 2. ' + PIERO_P + ' Flooded Barrio Italia alley. Black still water mirror. Violin string ghosts stretching between buildings. Iron microphone thrust toward blood moon, gold smoke forming kanji SOUTH SIDE CRIMINI. Dancehall zombie congregation moving at 103 BPM behind him.',
    HORROR_BASE + ' SHOT 3. ' + SQUAD_COMP + ' Gran Torre Costanera as dark obelisk against blood moon. Cobblestone plaza flooded black water, squad reflected upside down in still water. Violin string apparitions between all three. Dancehall shadow congregation. SOUTH SIDE CRIMINI carved in stone glowing red inside safe zone top. Ultimate horror anime poster.'
  ];
  const motions = [
    'J-horror anime slow orbit. Camera circles slowly. Black water ripples. Violin ghost apparitions drift past frame. Blood moon pulses. 103 BPM freeze frame energy.',
    'Slow tracking push-in. Dancehall zombie congregation sways in background. String ghosts stretch and vibrate. Mic gold smoke spirals. Haunted alley atmosphere.',
    'Top-down horror descent. Black water reflection ripples. Three figures cast no shadow. Energy corona expands like a curse. Title glitches and cracks. Blood moon eclipses.'
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


// ── CINEMATIC SCENE PRESETS ───────────────────────────
const SCENES = {
  // SQUAD scenes — all 3 together
  intro:   'Wu-Tang dark anime cinematic. SHOT 1: Extreme low angle — crumbling Shaolin temple, black smoke, blood moon through broken arch. Crimson eyes open in darkness — ANDINO materializes from shadow crouched over glowing MPC altar, red runes pulse. CAMERA rises slowly. CUT SHOT 2: PIERO steps from pure darkness into candlelight, glasses glint, raises iron microphone — gold smoke erupts, stone cracks. CAMERA rapid push-in. CUT SHOT 3: KINNY drops from above into Shaolin crouch, obsidian shuriken orbit, teal energy pulses. CAMERA tracks 90 degrees. SOUTH SIDE CRIMINI burns into frame. Blood red deep shadow palette.',
  battle:  'Wu-Tang dark anime cinematic. SHOT 1: KINNY explosive spinning aerial kick — CAMERA follows 360 rotation, world blurs, shuriken orbit, dark energy trails, SLOW MOTION. CUT SHOT 2: PIERO battle stance rain-soaked alley — CAMERA extreme close-up eyes behind glasses, thrusts mic — gold shockwave shatters frame. RAPID CUT. SHOT 3: All three — ANDINO elevated on ruins MPC firing red beams, PIERO commanding center, KINNY spinning foreground — CAMERA pulls back fast. Black smoke fills frame. SOUTH SIDE CRIMINI.',
  ritual:  'Wu-Tang dark anime cinematic. SHOT 1: Top-down — three figures kneeling in triangle around glowing yin-yang carved in stone. Blood moon reflected. CAMERA descends slowly. SHOT 2: ANDINO hands strike MPC pads — red pulse surges through stone, yin-yang brightens. CAMERA circles. SHOT 3: All three stand simultaneously — energy corona expands outward, stone shatters at edges, blood moon blazes. SOUTH SIDE CRIMINI burns into stone. Black crimson gold only.',
  finale:  'Wu-Tang dark anime cinematic. OPENING: Total darkness. Blood-red light activates — ANDINO silhouette behind destroyed altar, smoke. CAMERA slow push-in. SHOT 2: PIERO from left darkness KINNY from right — advance toward camera in parallel. CAMERA retreats. SHOT 3: All three stop — PERFECT TRIANGLE — PIERO center raises mic, flanked. Blood moon BLAZES. Yin-yang erupts from ground — massive gold ring expanding. CAMERA cranes up. SOUTH SIDE CRIMINI massive glitch red. FREEZE FRAME. Epic.',
  street:  'Wu-Tang dark anime cinematic. SHOT 1: Wet cobblestone Santiago alley 3am — steam manholes. ANDINO at end of alley, MPC glowing. CAMERA long lens push-in slow. SHOT 2: PIERO from steam left KINNY from right — parallel toward camera, faces half hidden. CAMERA tracks backward. SHOT 3: Street intersection — all three stop. Colonial archway frames them against blood-red storm sky, Andes silhouette. Stillness. Wind moves suits. CAMERA orbits 360. SOUTH SIDE CRIMINI.',

  // ANDINO solo scenes
  'andino-intro':   'Wu-Tang dark anime. ANDINO solo. SHOT 1: Low angle — ANDINO materializes from pitch black, ONLY crimson eyes visible, MPC altar glowing red runes at his feet, black smoke rising. CAMERA rises slowly from ground. SHOT 2: Close on his eyes — calm predator stillness. SHOT 3: Hands strike MPC pads in slow motion — red energy pulse radiates outward cracking the stone floor. Blood moon above. SOUTH SIDE CRIMINI.',
  'andino-battle':  'Wu-Tang dark anime. ANDINO solo. SHOT 1: ANDINO crouched over MPC elevated on broken temple wall, MPC firing red energy beams downward like weapons. CAMERA pulls back revealing scale. SHOT 2: Extreme close — fingers strike pads with precision, each hit sends crimson shockwave. SHOT 3: ANDINO stands slowly — red energy corona surrounds him, headphones glow. CAMERA circles 360. Dark architect energy.',
  'andino-ritual':  'Wu-Tang dark anime. ANDINO solo. SHOT 1: Top-down — ANDINO alone in center of yin-yang symbol, kneeling, hands on MPC. CAMERA descends slowly. SHOT 2: Red energy flows from MPC through stone veins outward like blood. SHOT 3: ANDINO raises head slowly — crimson eyes open, red energy explodes outward. Ritual complete. Blood moon directly above. SOUTH SIDE CRIMINI.',
  'andino-finale':  'Wu-Tang dark anime. ANDINO solo. SHOT 1: Total darkness. Single red LED from MPC blinks on. CAMERA slow push-in. SHOT 2: ANDINO fully revealed — standing tall, headphones on, arms crossed, MPC at feet like conquered ground. SHOT 3: He turns to camera — direct eye contact through mask slit. Red energy pulses once massive. FREEZE. SOUTH SIDE CRIMINI.',
  'andino-street':  'Wu-Tang dark anime. ANDINO solo. SHOT 1: Rain-soaked alley end — ANDINO barely visible, MPC glow only light source. CAMERA long lens compression push-in. SHOT 2: He steps forward into light — one slow deliberate step, headphones on, smoke trailing. SHOT 3: Medium shot — sets MPC down on wet cobblestone like an offering, kneels, begins playing. Red rune light reflects in puddle. Santiago Andes silhouette behind.',

  // PIERO solo scenes
  'piero-intro':    'Wu-Tang dark anime. PIERO solo. SHOT 1: Stone corridor — candlelight flickers. PIERO steps from total darkness, glasses catch light first. CAMERA holds. SHOT 2: He raises iron microphone slowly — gold smoke begins rising from tip. Close on glasses, eyes sharp behind. SHOT 3: PIERO unleashes — gold energy beam from mic tears through stone walls, dust and debris flies. Voice of the clan. SOUTH SIDE CRIMINI burns in gold.',
  'piero-battle':   'Wu-Tang dark anime. PIERO solo. SHOT 1: Rain-soaked alley — PIERO battle stance, mic thrust forward like weapon. CAMERA extreme close on eyes behind cracked glasses. SHOT 2: He steps forward — each step sends gold shockwave through wet cobblestones. SHOT 3: Mic raised to sky — massive gold energy crown erupts above him, stone walls shatter outward. CAMERA pulls back fast. SOUTH SIDE CRIMINI.',
  'piero-ritual':   'Wu-Tang dark anime. PIERO solo. SHOT 1: Ancient stone circle — PIERO stands center, mic touching ground like a staff. Blood moon above. CAMERA circles slowly. SHOT 2: He raises mic — gold energy flows down from moon through mic into stone. SHOT 3: Full release — gold ring expands outward from him across the stone floor. Eyes close behind glasses. Power contained. SOUTH SIDE CRIMINI in gold.',
  'piero-finale':   'Wu-Tang dark anime. PIERO solo. SHOT 1: Total darkness. PIERO materializes — only glasses visible first. CAMERA slow push-in. SHOT 2: Full reveal — PIERO standing, mic at side, absolute stillness. SHOT 3: Raises mic — stares directly at camera — fires single gold energy beam directly at lens. WHITE FLASH. FREEZE. SOUTH SIDE CRIMINI massive.',
  'piero-street':   'Wu-Tang dark anime. PIERO solo. SHOT 1: Street corner under broken lamplight — PIERO leans against graffiti wall, mic in hand, watching. CAMERA approaches slowly. SHOT 2: He pushes off wall — walks toward camera, glasses glinting, gold energy building around mic. SHOT 3: Stops center frame — raises mic, speaks — gold energy ripples outward through wet pavement. Colonial archway behind. Santiago night.',

  // KINNY solo scenes
  'kinny-intro':    'Wu-Tang dark anime. KINNY solo. SHOT 1: Empty stone courtyard — total silence. KINNY drops from above frame, lands perfectly in Shaolin crouch. CAMERA holds. SHOT 2: Rises slowly — obsidian shuriken appear orbiting him one by one. CAMERA circles. SHOT 3: Explodes into motion — spinning kick, shuriken scatter, teal energy trails. SLOW MOTION mid-rotation. SOUTH SIDE CRIMINI.',
  'kinny-battle':   'Wu-Tang dark anime. KINNY solo. SHOT 1: KINNY launches explosive aerial spinning kick — CAMERA follows full 360 rotation, world blurs around him. SLOW MOTION. SHOT 2: Lands — immediate low stance, hands on wet ground, coiled. CAMERA extreme low angle. SHOT 3: Erupts upward — three shuriken fire outward simultaneously, teal energy corona blazes. CAMERA pulls back fast. SOUTH SIDE CRIMINI.',
  'kinny-ritual':   'Wu-Tang dark anime. KINNY solo. SHOT 1: KINNY kneeling in center of carved stone circle, three shuriken placed around him like offerings. CAMERA descends from above. SHOT 2: Teal energy begins pulsing through suit markings — breathing with it. SHOT 3: Stands — shuriken rise and orbit. Raises arms — teal corona explodes outward. CAMERA cranes back. Blood moon blazes. SOUTH SIDE CRIMINI.',
  'kinny-finale':   'Wu-Tang dark anime. KINNY solo. SHOT 1: Darkness. KINNY heard before seen — shuriken glow appears first. CAMERA finds him. SHOT 2: Full reveal standing — weight forward, coiled energy, three shuriken orbiting. Direct camera eye contact. SHOT 3: One step toward camera — MASSIVE teal energy explosion from body. CAMERA pushed back by force. FREEZE. SOUTH SIDE CRIMINI.',
  'kinny-street':   'Wu-Tang dark anime. KINNY solo. SHOT 1: Santiago alley — KINNY drops from rooftop, lands in crouch on wet cobblestone. Steam surrounds him. CAMERA low angle. SHOT 2: Rises — begins slow walk toward camera, shuriken orbiting. CAMERA tracks backward. SHOT 3: Stops at intersection — explodes into full breakdance spin, teal energy streaks. CAMERA 360 track. Andes silhouette. Colonial archway. SOUTH SIDE CRIMINI.'
};

// SEEDANCE FACTORY
async function runSeedance(chatId, concept, imageUrl) {
  // Check for scene preset keywords
  const sceneKey = concept?.toLowerCase().trim();
  if (SCENES[sceneKey]) {
    concept = SCENES[sceneKey];
  }
  const msgId = await send(chatId, '🌱 *Seedance factory*\n' + bar(0, 10) + '\n_Iniciando..._');
  if (!OPENROUTER_KEY) { await edit(chatId, msgId, '❌ OPENROUTER_KEY no configurada.'); return; }
  const prompt = concept || 'Cinematic anime ninja squad dystopian Santiago Chile Akira aesthetic dark neon rain Wu-Tang Shaolin energy 3 ninja warriors beatmaker MC dancer epic cinematics beat-driven motion';

  // Generate Grok reference image if no imageUrl provided
  // Show Grok reference image but use text prompt for Seedance (Grok URLs expire)
  if (!imageUrl) {
    await edit(chatId, msgId, '🌱 *Seedance factory*\n' + bar(2, 10) + '\n_🎨 Generando frame referencia..._');
    const squadPrompt = 'Hyper-cinematic anime Katsuhiro Otomo Akira cel-shading thick ink mature dark NOT kawaii. Dystopian Tokyo fused Andes silhouette wet cobblestones neon. 9:16 ALL 120px safe margins. ' + ANDINO_P + ' left. ' + PIERO_P + ' center. ' + KINNY_P + ' right mid-air. Triangle. Yin yang ground. SOUTH SIDE CRIMINI red text. Epic poster.';
    const refImg = await grokImg(squadPrompt);
    if (refImg) await photo(chatId, refImg, '🎨 Frame referencia — Seedance generará el video');
  }
  const seedancePrompt = prompt + ' ' + BASE_STYLE + ' ' + CITY_BG + ' ' + SQUAD_COMP + ' ' + ANDINO_P + ' ' + PIERO_P + ' ' + KINNY_P + ' Shuriken stars orbiting. Three energy coronas red gold blue. SOUTH SIDE CRIMINI red text. Epic cinematic anime 9:16 vertical.';
  await edit(chatId, msgId, '🌱 *Seedance factory*\n' + bar(4, 10) + '\n_🎬 ' + currentVideoModel.split('/')[1] + ' generando..._');
  const vid = await seedanceVideo(seedancePrompt, null);

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
      saveClip(chatId, vid); // save for /sync
      await edit(chatId, msgId, '🌱 *Seedance factory*\n' + bar(10, 10) + '\n✅ *Completado — clip guardado para /sync*');
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
    await send(chatId, '🎨 *maarmapa factory v6*\n\n`/post [tema]` — post maarmapa\n`/boykot [producto]` — post Boykot\n`/anime` — video anime squad\n`/squad` — multi-angulo squad\n`/seedance intro|battle|ritual|finale|street` — video\n`/sync` — mezcla clips con cancion\n`/clips` — ver clips guardados\n`/model` — cambiar modelo\n`/buscar [query]` — noticias\n`/chat [pregunta]` — agente\n📸 Foto — Runway');
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
    if (!concept || concept === 'help' || concept === 'escenas') {
      await send(chatId, '🎬 *Seedance — Escenas:*\n\n`/seedance intro` — apertura del templo\n`/seedance battle` — secuencia de batalla\n`/seedance ritual` — ritual oscuro\n`/seedance finale` — cierre epico\n`/seedance street` — calles Santiago\n\nO describe tu escena: `/seedance [descripcion]`');
      await send(chatId, '🎬 *Seedance Escenas:*\n\n*Squad:*\n`intro` `battle` `ritual` `finale` `street`\n\n*Andino solo:*\n`andino-intro` `andino-battle` `andino-ritual` `andino-finale` `andino-street`\n\n*Piero solo:*\n`piero-intro` `piero-battle` `piero-ritual` `piero-finale` `piero-street`\n\n*Kinny solo:*\n`kinny-intro` `kinny-battle` `kinny-ritual` `kinny-finale` `kinny-street`\n\nEj: `/seedance kinny-battle`');
      return;
    }
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

  if (text.startsWith('/boykot ')) {
    const topic = text.replace('/boykot ', '');
    runBoykotPost(chatId, topic).catch(e => send(chatId, '❌ ' + e.message));
    return;
  }

  if (text.startsWith('/contacto ')) {
    const info = text.replace('/contacto ', '');
    runBoykotContact(chatId, info).catch(e => send(chatId, '❌ ' + e.message));
    return;
  }

  if (text.startsWith('/sync')) {
    const args = text.replace('/sync', '').trim().split(' ').filter(u => u.startsWith('http'));
    const clips = args.length > 0 ? args : getClips(chatId);
    if (clips.length === 0) {
      await send(chatId, '❌ No hay clips guardados.\nGenera clips con `/squad`, `/anime` o `/seedance` primero.');
      return;
    }
    await send(chatId, '🎵 Sincronizando ' + clips.length + ' clips con SOUTH SIDE CRIMINI...');
    runSync(chatId, clips, null).catch(e => send(chatId, '❌ ' + e.message));
    return;
  }

  if (text === '/clips') {
    const clips = getClips(chatId);
    if (clips.length === 0) await send(chatId, '📋 No hay clips guardados todavía.');
    else await send(chatId, '📋 *' + clips.length + ' clips guardados:*\n' + clips.map((u,i) => (i+1) + '. ' + u.slice(0,60) + '...').join('\n') + '\n\nUsa `/sync` para mezclarlos con la canción.\nUsa `/clearcl` para borrarlos.');
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


// ── BOYKOT FACTORY ────────────────────────────────────
const BOYKOT_STYLE = 'Editorial Instagram post for Boykot.cl — Chilean art supply store. Brand colors: black background #000000, acid yellow-green accent #CCFF00. Typography: Barlow Condensed bold. Clean minimal product editorial aesthetic. Urban art supplies. Target: artists, illustrators, muralists, designers in Chile.';

async function runBoykotPost(chatId, topic) {
  const msgId = await send(chatId, '🎨 *Boykot factory*\n' + bar(0, 10) + '\n_Iniciando..._');
  await edit(chatId, msgId, '🎨 *Boykot factory*\n' + bar(2, 10) + '\n_Generando contenido..._');
  const system = 'Eres community manager de Boykot.cl tienda de materiales artisticos chilena. Genera contenido editorial en espanol tono cercano y apasionado por el arte. Devuelve SOLO JSON sin markdown: {"caption":"...","hashtags":"...","slide_prompts":["p1","p2","p3"]}';
  let postData;
  try {
    const raw = await deepseek('Genera contenido Instagram Boykot.cl sobre: ' + topic + '. Caption impactante + 7 hashtags + 3 prompts de imagen para carrusel.', system);
    if (raw) postData = JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch(e) { postData = null; }
  if (!postData) {
    postData = {
      caption: topic + ' — disponible en Boykot.cl',
      hashtags: '#boykot #artesupplies #chile #arte #pintura #ilustracion #diseno #boykotcl',
      slide_prompts: [
        'Product hero shot ' + topic + ' centered pure black background. Acid yellow-green #CCFF00 accent rim lighting. Minimal editorial.',
        'Detail close-up shot ' + topic + ' extreme macro. High contrast black and #CCFF00 accent. Sharp product photography.',
        'Lifestyle dark studio. Artist hand using ' + topic + '. Moody dark. Chilean urban art energy. #CCFF00 accent light.'
      ]
    };
  }
  await edit(chatId, msgId, '🎨 *Boykot factory*\n' + bar(3, 10) + '\n_Copy listo_');
  await send(chatId, '📝 *Caption Boykot:*\n\n' + postData.caption + '\n\n' + postData.hashtags);
  const slides = postData.slide_prompts || [];

  // 1:1 Carousel
  await edit(chatId, msgId, '🎨 *Boykot factory*\n' + bar(4, 10) + '\n_Carrusel 1:1..._');
  const carouselUrls = [];
  for (let i = 0; i < Math.min(slides.length, 3); i++) {
    await edit(chatId, msgId, '🎨 *Boykot factory*\n' + bar(4 + i, 10) + '\n_Carrusel ' + (i+1) + '/3..._');
    const url = await grokImg('Square 1:1. Safe zone 100px all sides. ' + BOYKOT_STYLE + ' ' + slides[i] + ' ALL inside 100px margins. No watermarks.');
    if (url) { carouselUrls.push(url); await photo(chatId, url, 'Carrusel ' + (i+1) + '/3 — Boykot.cl'); }
  }

  // 9:16 Reel
  await edit(chatId, msgId, '🎨 *Boykot factory*\n' + bar(7, 10) + '\n_Reel 9:16..._');
  const reelUrls = [];
  for (let i = 0; i < Math.min(slides.length, 3); i++) {
    await edit(chatId, msgId, '🎨 *Boykot factory*\n' + bar(7 + i, 10) + '\n_Reel ' + (i+1) + '/3..._');
    const url = await grokImg('Vertical 9:16. Safe zone 120px all sides. ' + BOYKOT_STYLE + ' ' + slides[i] + ' ALL inside 120px margins. No watermarks.');
    if (url) { reelUrls.push(url); await photo(chatId, url, 'Reel ' + (i+1) + '/3 — Boykot.cl'); }
  }

  // Runway animate reel slides
  let clips = 0;
  if (process.env.RUNWAY_KEY && reelUrls.length > 0) {
    const motions = ['Product reveal slow push-in. Neon yellow-green light sweeps surface. Commercial editorial dark.','Detail zoom macro push-in. Acid yellow highlight traces edge. Professional product.','Lifestyle artist hand motion blur. Yellow-green neon glow pulses. Urban creative energy.'];
    for (let i = 0; i < reelUrls.length; i++) {
      const vid = await runwayVideo(reelUrls[i], motions[i], 3);
      if (vid) { await video(chatId, vid, 'Reel clip ' + (i+1) + ' Boykot.cl'); clips++; }
    }
  }

  await edit(chatId, msgId, '🎨 *Boykot factory*\n' + bar(10, 10) + '\n_Completado_');
  await send(chatId, 'Boykot listo\nCarrusel: ' + carouselUrls.length + '/3\nReel frames: ' + reelUrls.length + '/3\nClips: ' + clips + '\n\nPara sync de audio usa /sync o CapCut');
}

async function runBoykotContact(chatId, info) {
  const msgId = await send(chatId, '📋 *Boykot contacto*\n_Procesando..._');
  const system = 'Eres asistente de ventas de Boykot.cl. Genera respuestas profesionales y cercanas para consultas de clientes sobre materiales artísticos. En español chileno.';
  const reply = await deepseek('Genera respuesta para esta consulta de Boykot.cl: ' + info, system);
  if (reply) {
    await edit(chatId, msgId, '📋 *Respuesta Boykot:*\n\n' + reply.slice(0, 4000));
  } else {
    await edit(chatId, msgId, '❌ Error generando respuesta.');
  }
}


// ── SHOTSTACK SYNC ────────────────────────────────────
// Merges video clips with audio using Shotstack API
async function runSync(chatId, clipUrls, audioUrl) {
  const SHOTSTACK_KEY = process.env.SHOTSTACK_KEY;
  const msgId = await send(chatId, '🎵 *Sync factory*\n' + bar(0, 10) + '\n_Iniciando..._');

  if (!SHOTSTACK_KEY) {
    await edit(chatId, msgId, '❌ SHOTSTACK_KEY no configurada en Render.\n\n_Alternativa ahora: CapCut → importa clips → Auto Beat Sync_');
    return;
  }

  if (!clipUrls || clipUrls.length === 0) {
    await edit(chatId, msgId, '❌ No hay clips para sincronizar.\n\nUso: genera clips con /squad o /anime primero, luego /sync');
    return;
  }

  const audio = audioUrl || SOUTH_SIDE_AUDIO;
  const clipDuration = 3; // seconds per clip

  await edit(chatId, msgId, '🎵 *Sync factory*\n' + bar(3, 10) + '\n_Construyendo timeline..._');

  // Build Shotstack timeline
  const clips = clipUrls.map((url, i) => ({
    asset: { type: 'video', src: url },
    start: i * clipDuration,
    length: clipDuration,
    transition: { in: 'fade', out: 'fade' }
  }));

  const timeline = {
    soundtrack: { src: audio, effect: 'fadeOut' },
    tracks: [{ clips }]
  };

  const output = { format: 'mp4', resolution: 'hd', aspectRatio: '9:16' };

  try {
    await edit(chatId, msgId, '🎵 *Sync factory*\n' + bar(4, 10) + '\n_Enviando a Shotstack..._');

    const res = await fetch('https://api.shotstack.io/edit/stage/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': SHOTSTACK_KEY },
      body: JSON.stringify({ timeline, output })
    });
    const d = await res.json();
    const renderId = d.response?.id;
    if (!renderId) { await edit(chatId, msgId, '❌ Shotstack error: ' + JSON.stringify(d).slice(0,200)); return; }

    await edit(chatId, msgId, '🎵 *Sync factory*\n' + bar(5, 10) + '\n_Renderizando..._');

    // Poll for result
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 10000));
      const p = await fetch('https://api.shotstack.io/edit/stage/render/' + renderId, {
        headers: { 'x-api-key': SHOTSTACK_KEY }
      });
      const t = await p.json();
      const status = t.response?.status;
      console.log('Shotstack poll:', status);
      if (status === 'done') {
        const videoUrl = t.response?.url;
        await edit(chatId, msgId, '🎵 *Sync factory*\n' + bar(10, 10) + '\n_Descargando..._');
        const vidRes = await fetch(videoUrl);
        const vidBuffer = await vidRes.arrayBuffer();
        const form = new FormData();
        form.append('chat_id', String(chatId));
        form.append('video', new Blob([vidBuffer], { type: 'video/mp4' }), 'south_side_crimini_sync.mp4');
        form.append('caption', '🎵 South Side Crimini — synced con Shotstack');
        await fetch('https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/sendVideo', { method: 'POST', body: form });
        await edit(chatId, msgId, '✅ *Video synced listo*');
        return;
      }
      if (status === 'failed') { await edit(chatId, msgId, '❌ Shotstack render falló.'); return; }
      await edit(chatId, msgId, '🎵 *Sync factory*\n' + bar(5 + Math.floor(i/3), 10) + '\n_Renderizando ' + (i*10) + 's..._');
    }
    await edit(chatId, msgId, '❌ Timeout — intenta de nuevo.');
  } catch(e) {
    await edit(chatId, msgId, '❌ Error: ' + e.message);
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
