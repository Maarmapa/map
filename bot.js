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
      body: JSON.stringify({ model: 'grok-2-image', prompt, n: 1, response_format: 'url' })
    });
    const d = await res.json();
    return d.data?.[0]?.url || null;
  } catch(e) { return null; }
}

// Runway
async function runwayVideo(imageUrl, prompt) {
  if (!process.env.RUNWAY_KEY) return null;
  try {
    const res = await fetch('https://api.runwayml.com/v1/image_to_video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.RUNWAY_KEY, 'X-Runway-Version': '2024-11-06' },
      body: JSON.stringify({ model: 'gen3a_turbo', promptImage: imageUrl, promptText: prompt, ratio: '768:1344', duration: 5 })
    });
    const d = await res.json();
    if (!d.id) return null;
    for (let i = 0; i < 24; i++) {
      await new Promise(r => setTimeout(r, 10000));
      const p = await fetch('https://api.runwayml.com/v1/tasks/' + d.id, {
        headers: { 'Authorization': 'Bearer ' + process.env.RUNWAY_KEY, 'X-Runway-Version': '2024-11-06' }
      });
      const t = await p.json();
      if (t.status === 'SUCCEEDED') return t.output?.[0] || null;
      if (t.status === 'FAILED') return null;
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

  // Send text
  const title = postData.title || topic;
  const body = (postData.body || '').slice(0, 600);
  const caption = postData.instagram_caption || '';
  await send(chatId, '📝 *' + title + '*\n\n' + body + '...\n\n_Caption:_ ' + caption);

  // 3. Thumbnail
  if (postData.thumbnail_prompt) {
    await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(4, 10) + '\n_Generando thumbnail..._');
    const thumbUrl = await grokImg(postData.thumbnail_prompt);
    if (thumbUrl) await photo(chatId, thumbUrl, '🖼 Thumbnail Substack');
  }

  // 4. Slides
  const slides = postData.slides || [];
  const slideUrls = [];
  for (let i = 0; i < Math.min(slides.length, 7); i++) {
    await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(4 + i, 10) + '\n_📸 Slide ' + (i+1) + '/7..._');
    if (slides[i]?.prompt) {
      const url = await grokImg(slides[i].prompt);
      if (url) {
        slideUrls.push(url);
        await photo(chatId, url, 'Slide ' + (i+1) + '/7');
      }
    }
  }

  await edit(chatId, msgId, '🏭 *maarmapa factory*\n' + bar(9, 10) + '\n_' + slideUrls.length + ' slides listos_');

  // 5. Runway clips (optional)
  let clips = 0;
  if (process.env.RUNWAY_KEY && slideUrls.length > 0) {
    const motions = [
      'slow cinematic zoom in, dramatic lighting, film grain',
      'subtle camera drift left, dark atmospheric',
      'gentle vertical pan, spotlight flicker',
      'slow zoom out, cinematic vignette',
      'static hold, light flicker',
      'slow push in, minimal motion',
      'fade to black, cinematic end'
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
poll();git add bot.js
git commit -m "bot v3 spinner real time"
git push origin main