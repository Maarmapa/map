// maarmapa — Telegram Bot
// Conecta al agente en Render y a Higgsfield para generar contenido completo

const AGENT_URL = 'https://maarmapa-agent.onrender.com';
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const HIGGSFIELD_KEY = process.env.HIGGSFIELD_KEY;

// ── TELEGRAM POLLING ──────────────────────────────────
async function getUpdates(offset = 0) {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${offset}&timeout=30`);
  const data = await res.json();
  return data.result || [];
}

async function sendMessage(chatId, text) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
  });
}

async function sendPhoto(chatId, url, caption = '') {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, photo: url, caption, parse_mode: 'Markdown' })
  });
}

async function sendVideo(chatId, url, caption = '') {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendVideo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, video: url, caption, parse_mode: 'Markdown' })
  });
}

// ── HIGGSFIELD IMAGE TO VIDEO ─────────────────────────
async function imageToVideo(imageUrl, motionPrompt) {
  try {
    const res = await fetch('https://api.higgsfield.ai/v1/video/image-to-video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HIGGSFIELD_KEY}`
      },
      body: JSON.stringify({
        image_url: imageUrl,
        prompt: motionPrompt,
        duration: 3,
        aspect_ratio: '9:16'
      })
    });
    const data = await res.json();
    return data.video_url || data.url || null;
  } catch(e) {
    console.error('Higgsfield error:', e.message);
    return null;
  }
}

// ── GROK IMAGE GENERATION ─────────────────────────────
async function generateImage(prompt) {
  try {
    const res = await fetch('https://api.x.ai/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROK_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-2-image',
        prompt,
        n: 1,
        response_format: 'url'
      })
    });
    const data = await res.json();
    return data.data?.[0]?.url || null;
  } catch(e) {
    return null;
  }
}

// ── MAIN FACTORY ──────────────────────────────────────
async function runFactory(chatId, input) {
  await sendMessage(chatId, '⚙️ *Generando contenido...*\n\nEsto toma 2-3 minutos.');

  // Step 1: Claude genera texto + prompts
  await sendMessage(chatId, '1️⃣ Claude analizando el tema...');
  const factoryRes = await fetch(`${AGENT_URL}/factory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic: input })
  });
  const factory = await factoryRes.json();

  if (factory.error) {
    await sendMessage(chatId, `❌ Error: ${factory.error}`);
    return;
  }

  // Enviar texto del post
  await sendMessage(chatId, `📝 *${factory.substack?.title}*\n\n${factory.substack?.body?.slice(0, 800)}...\n\n_Caption:_ ${factory.instagram_caption}`);

  // Step 2: Generar thumbnail
  await sendMessage(chatId, '2️⃣ Generando thumbnail...');
  if (factory.thumbnail_url) {
    await sendPhoto(chatId, factory.thumbnail_url, '🖼 Thumbnail Substack');
  }

  // Step 3: Generar slides carrusel (ya incluidas en factory)
  await sendMessage(chatId, '3️⃣ Generando slides carrusel...');
  const carousel = factory.carousel || [];
  for (const slide of carousel.slice(0, 7)) {
    if (slide.url) {
      await sendPhoto(chatId, slide.url, `Slide ${slide.num}/07`);
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // Step 4: Generar clips de reel con Higgsfield
  await sendMessage(chatId, '4️⃣ Convirtiendo imágenes a video con Higgsfield...');
  const motionPrompts = [
    'slow cinematic zoom in, dramatic lighting pulse, film grain effect',
    'subtle camera drift left, text glows softly, dark atmospheric',
    'gentle vertical pan down, spotlight flicker, editorial mood',
    'slow zoom out revealing, shadows deepen, cinematic vignette',
    'static dramatic hold, light flicker, high contrast pulse',
    'slow push in center, white text shimmers, minimal motion',
    'fade to black slowly, final atmospheric hold, cinematic end'
  ];

  const videoUrls = [];
  for (let i = 0; i < Math.min(carousel.length, 7); i++) {
    const slide = carousel[i];
    if (slide?.url) {
      await sendMessage(chatId, `🎬 Clip ${i+1}/7...`);
      const videoUrl = await imageToVideo(slide.url, motionPrompts[i]);
      if (videoUrl) {
        videoUrls.push(videoUrl);
        await sendVideo(chatId, videoUrl, `Clip reel ${i+1}/7`);
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  await sendMessage(chatId, `✅ *Contenido generado completo*\n\n📊 Slides: ${carousel.filter(s => s.url).length}/7\n🎬 Clips: ${videoUrls.length}/7\n\n_Combina los clips en Capcut o CapCut para el reel final._`);
}

// ── COMMAND HANDLER ───────────────────────────────────
async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = msg.text || '';

  if (text === '/start') {
    await sendMessage(chatId, `🎨 *maarmapa content factory*\n\nComandos disponibles:\n\n/post [tema o link] — genera contenido completo\n/buscar [query] — busca noticias en X/Twitter\n/digest — digest semanal de arte\n/ayuda — ver comandos`);
    return;
  }

  if (text === '/ayuda') {
    await sendMessage(chatId, `📋 *Comandos:*\n\n/post duchamp moma 2026\n/post https://link-de-noticia.com\n/buscar street art trending\n/buscar nft blockchain abril 2026\n/digest`);
    return;
  }

  if (text.startsWith('/buscar ')) {
    const query = text.replace('/buscar ', '');
    await sendMessage(chatId, `🔍 Buscando: _${query}_`);
    const res = await fetch(`${AGENT_URL}/grok`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    const data = await res.json();
    const reply = data.reply?.slice(0, 4000) || 'Sin resultados';
    await sendMessage(chatId, reply);
    return;
  }

  if (text === '/digest') {
    await sendMessage(chatId, '📰 Generando digest semanal...');
    const res = await fetch(`${AGENT_URL}/digest`);
    const data = await res.json();
    const digest = data.digest?.slice(0, 4000) || 'Error';
    await sendMessage(chatId, digest);
    return;
  }

  if (text.startsWith('/post ')) {
    const input = text.replace('/post ', '');
    await runFactory(chatId, input);
    return;
  }

  // Mensaje sin comando — busca como query
  if (text && !text.startsWith('/')) {
    await sendMessage(chatId, `💡 Usa /post ${text} para generar contenido\no /buscar ${text} para buscar noticias`);
  }
}

// ── POLLING LOOP ──────────────────────────────────────
async function startBot() {
  console.log('maarmapa Telegram bot starting...');
  let offset = 0;

  while (true) {
    try {
      const updates = await getUpdates(offset);
      for (const update of updates) {
        offset = update.update_id + 1;
        if (update.message) {
          handleMessage(update.message).catch(e => console.error('Handler error:', e.message));
        }
      }
    } catch(e) {
      console.error('Polling error:', e.message);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

startBot();
