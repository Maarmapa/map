// maarmapa — Telegram Bot v2 — paso a paso con progreso real
const AGENT_URL = process.env.AGENT_URL || 'https://maarmapa-agent.onrender.com';
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;

// ── TELEGRAM HELPERS ──────────────────────────────────
async function sendMessage(chatId, text) {
  const res = await fetch('https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
  });
  const data = await res.json();
  return data.result?.message_id;
}

async function editMessage(chatId, msgId, text) {
  try {
    await fetch('https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/editMessageText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: msgId, text, parse_mode: 'Markdown' })
    });
  } catch(e) {}
}

async function sendPhoto(chatId, url, caption) {
  await fetch('https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/sendPhoto', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, photo: url, caption, parse_mode: 'Markdown' })
  });
}

async function sendVideo(chatId, url, caption) {
  await fetch('https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/sendVideo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, video: url, caption, parse_mode: 'Markdown' })
  });
}

function bar(step, total) {
  const n = Math.round((step / total) * 10);
  return '[' + '█'.repeat(n) + '░'.repeat(10 - n) + '] ' + Math.round((step / total) * 100) + '%';
}

// ── GROK IMAGE ────────────────────────────────────────
async function grokImage(prompt) {
  try {
    const res = await fetch('https://api.x.ai/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.GROK_KEY },
      body: JSON.stringify({ model: 'grok-2-image', prompt, n: 1, response_format: 'url' })
    });
    const data = await res.json();
    return data.data?.[0]?.url || null;
  } catch(e) { return null; }
}

// ── RUNWAY ────────────────────────────────────────────
async function runway(imageUrl, prompt) {
  try {
    const res = await fetch('https://api.runwayml.com/v1/image_to_video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.RUNWAY_KEY,
        'X-Runway-Version': '2024-11-06'
      },
      body: JSON.stringify({ model: 'gen3a_turbo', promptImage: imageUrl, promptText: prompt, ratio: '768:1344', duration: 5 })
    });
    const data = await res.json();
    if (!data.id) return null;
    // Poll
    for (let i = 0; i < 24; i++) {
      await new Promise(r => setTimeout(r, 10000));
      const poll = await fetch('https://api.runwayml.com/v1/tasks/' + data.id, {
        headers: { 'Authorization': 'Bearer ' + process.env.RUNWAY_KEY, 'X-Runway-Version': '2024-11-06' }
      });
      const task = await poll.json();
      if (task.status === 'SUCCEEDED') return task.output?.[0] || null;
      if (task.status === 'FAILED') return null;
    }
    return null;
  } catch(e) { console.error('Runway error:', e.message); return null; }
}

// ── FACTORY PASO A PASO ───────────────────────────────
async function runFactory(chatId, topic) {
  const msgId = await sendMessage(chatId, '⚙️ *maarmapa factory*\n' + bar(0, 10) + '\n_Iniciando..._');

  // PASO 1: Claude genera texto + prompts de imagen
  await editMessage(chatId, msgId, '⚙️ *maarmapa factory*\n' + bar(1, 10) + '\n_Claude analizando tema..._');

  let postData;
  try {
    const res = await fetch(AGENT_URL + '/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic })
    });
    const raw = await res.json();
    postData = raw.post || raw;
  } catch(e) {
    await editMessage(chatId, msgId, '❌ Error llamando al agente: ' + e.message);
    return;
  }

  await editMessage(chatId, msgId, '⚙️ *maarmapa factory*\n' + bar(2, 10) + '\n✅ _Texto generado_');

  // Enviar texto
  const title = postData.title || topic;
  const body = (postData.body || '').slice(0, 600);
  const caption = postData.instagram_caption || '';
  await sendMessage(chatId, '📝 *' + title + '*\n\n' + body + '...\n\n_Caption:_ ' + caption);

  // PASO 2: Thumbnail
  await editMessage(chatId, msgId, '⚙️ *maarmapa factory*\n' + bar(3, 10) + '\n_Generando thumbnail..._');
  if (postData.thumbnail_prompt && process.env.GROK_KEY) {
    const thumbUrl = await grokImage(postData.thumbnail_prompt);
    if (thumbUrl) await sendPhoto(chatId, thumbUrl, '🖼 Thumbnail Substack');
  }

  // PASO 3: 7 slides carrusel
  const slides = postData.slides || [];
  let slidesDone = 0;
  for (let i = 0; i < Math.min(slides.length, 7); i++) {
    await editMessage(chatId, msgId, '⚙️ *maarmapa factory*\n' + bar(3 + i, 10) + '\n_Slide ' + (i+1) + '/7..._');
    if (slides[i]?.prompt && process.env.GROK_KEY) {
      const url = await grokImage(slides[i].prompt);
      if (url) {
        await sendPhoto(chatId, url, '📸 Slide ' + (i+1) + '/7');
        slidesDone++;
      }
    }
  }

  await editMessage(chatId, msgId, '⚙️ *maarmapa factory*\n' + bar(8, 10) + '\n_' + slidesDone + ' slides listos_');

  // PASO 4: Runway clips (solo si hay RUNWAY_KEY y slides)
  let clipsDone = 0;
  if (process.env.RUNWAY_KEY && slides.length > 0) {
    const motions = [
      'slow cinematic zoom in, dramatic lighting, film grain',
      'subtle camera drift left, text glows, dark atmospheric',
      'gentle vertical pan down, spotlight flicker, editorial',
      'slow zoom out, shadows deepen, cinematic vignette',
      'static dramatic hold, light flicker, high contrast',
      'slow push in center, white text shimmers, minimal',
      'fade to black slowly, atmospheric hold, cinematic end'
    ];
    for (let i = 0; i < Math.min(slides.length, 7); i++) {
      if (slides[i]?.url) {
        await editMessage(chatId, msgId, '⚙️ *maarmapa factory*\n' + bar(8, 10) + '\n_🎬 Clip ' + (i+1) + '/7 Runway..._');
        const vid = await runway(slides[i].url, motions[i]);
        if (vid) {
          await sendVideo(chatId, vid, '🎬 Clip ' + (i+1) + '/7');
          clipsDone++;
        }
      }
    }
  }

  await editMessage(chatId, msgId, '⚙️ *maarmapa factory*\n' + bar(10, 10) + '\n✅ *Completado*');
  await sendMessage(chatId, '✅ *Listo*\n📸 Slides: ' + slidesDone + '/7\n🎬 Clips: ' + clipsDone + '/7');
}

// ── POLLING ───────────────────────────────────────────
async function getUpdates(offset) {
  const res = await fetch('https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/getUpdates?offset=' + offset + '&timeout=30');
  const data = await res.json();
  return data.result || [];
}

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = msg.text || '';

  if (text === '/start') {
    await sendMessage(chatId, '🎨 *maarmapa content factory*\n\n/post [tema] — genera contenido completo\n/buscar [query] — busca en X/Twitter\n/digest — digest semanal\n/ayuda — comandos');
    return;
  }

  if (text === '/ayuda') {
    await sendMessage(chatId, '📋 *Comandos:*\n\n`/post duchamp moma 2026`\n`/post https://link.com`\n`/buscar street art trending`\n`/digest`');
    return;
  }

  if (text.startsWith('/buscar ')) {
    const query = text.replace('/buscar ', '');
    const msgId = await sendMessage(chatId, '🔍 _Buscando: ' + query + '..._');
    try {
      const res = await fetch(AGENT_URL + '/grok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      const data = await res.json();
      await editMessage(chatId, msgId, (data.reply || 'Sin resultados').slice(0, 4000));
    } catch(e) {
      await editMessage(chatId, msgId, '❌ Error: ' + e.message);
    }
    return;
  }

  if (text === '/digest') {
    const msgId = await sendMessage(chatId, '📰 _Generando digest semanal..._');
    try {
      const res = await fetch(AGENT_URL + '/digest');
      const data = await res.json();
      await editMessage(chatId, msgId, (data.digest || 'Error').slice(0, 4000));
    } catch(e) {
      await editMessage(chatId, msgId, '❌ Error: ' + e.message);
    }
    return;
  }

  if (text.startsWith('/post ')) {
    const topic = text.replace('/post ', '');
    runFactory(chatId, topic).catch(e => sendMessage(chatId, '❌ Error: ' + e.message));
    return;
  }

  if (text && !text.startsWith('/')) {
    await sendMessage(chatId, '💡 Usa:\n`/post ' + text + '` para generar contenido\n`/buscar ' + text + '` para buscar noticias');
  }
}

// ── HTTP + START ──────────────────────────────────────
const http = require('http');
http.createServer((req, res) => { res.writeHead(200); res.end('maarmapa bot online'); })
  .listen(process.env.PORT || 3000, () => console.log('Bot HTTP ready'));

async function startBot() {
  console.log('maarmapa Telegram bot v2 starting...');
  let offset = 0;
  while (true) {
    try {
      const updates = await getUpdates(offset);
      for (const u of updates) {
        offset = u.update_id + 1;
        if (u.message) handleMessage(u.message).catch(e => console.error('Error:', e.message));
      }
    } catch(e) {
      console.error('Polling error:', e.message);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

startBot();