// factory-tools.js — dos herramientas HTTP con token para Hermes
//
// Por qué existe este archivo
// ───────────────────────────
// Hermes, el agente de ventas de Boykot, vive en otro repo y en otro proveedor
// de hosting. Necesita dos cosas que este servidor ya sabe hacer: pedirle una
// imagen de referencia a x.ai y buscar información técnica en la web. Un
// servidor MCP habría sido más maquinaria de la que justifican dos tools
// (transporte, esquemas, un proceso más); dos rutas HTTP con un token alcanzan
// y se prueban con curl.
//
// El token es lo único que separa "gastar la cuenta de x.ai" de "cualquiera
// con la URL". Por eso:
//   - Falla cerrado: sin FACTORY_TOOLS_TOKEN configurado, todo el router
//     responde 503. Un servidor que "por mientras" acepta a todos es el que
//     queda así para siempre.
//   - La comparación es en tiempo constante sobre digests sha256: así no
//     importa el largo del token ni cuántos bytes coincidieron.
//   - El token nunca se loguea ni se devuelve. Los logs llevan método, ruta,
//     status, milisegundos y longitudes — nunca el prompt, la consulta ni URLs
//     con query strings (las de x.ai llevan firmas).
//
// Decisiones que conviene no rediscutir
// ─────────────────────────────────────
//   - Tope diario global de imágenes (FACTORY_TOOLS_DAILY_IMAGES, 30 por
//     defecto, 0 = imágenes apagadas): cada imagen cuesta plata y Hermes
//     puede entrar en un bucle. El contador vive en memoria y se reinicia al
//     cambiar el día UTC o al redesplegar; para este volumen no vale una base
//     de datos.
//   - R2 para la imagen: las URLs que devuelve x.ai caducan. Se descargan los
//     bytes y se suben al bucket propio; si eso falla se devuelve igual la URL
//     de x.ai con durable:false y una nota, porque una imagen efímera es mejor
//     que ninguna. Ojo: el `?list=true` del worker filtra por .mp4, así que
//     estas imágenes no aparecen ahí — se auditan desde el panel de R2.
//   - Sin x_search en la búsqueda: para fichas técnicas y compatibilidad de
//     productos X/Twitter agrega ruido, y cada tool extra es tokens.
//   - Rate limit por IP además del tope diario: el tope protege la cuenta, el
//     rate limit protege al servidor de un cliente que se traba en un reintento.
//   - Todo lo externo entra por `deps` (fetch, reloj, log) para que los tests
//     corran sin red y sin credenciales.

const crypto = require('node:crypto');
const express = require('express');

const X_IMAGES_URL = 'https://api.x.ai/v1/images/generations';
const X_RESPONSES_URL = 'https://api.x.ai/v1/responses';
const IMAGE_MODEL = 'grok-imagine-image';
const SEARCH_MODEL = 'grok-4-1-fast';

// Presupuesto de tiempo de /tools/imagen: x.ai + descarga + subida a R2 suman
// como máximo ~46 s. Hermes espera 50 s por una imagen; si el factory tardara
// más que eso, Hermes ya se rindió pero la imagen se cobra igual y consume
// cupo. Los tres timeouts existen para que eso no pase.
const IMAGE_TIMEOUT_MS = 30000;
const DOWNLOAD_TIMEOUT_MS = 8000;
const SEARCH_TIMEOUT_MS = 25000;
// La imagen se carga entera en memoria para subirla a R2: con más de esto se
// devuelve la URL de x.ai sin persistir, antes que reventar el proceso.
const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
// Tope de fuentes por respuesta: el texto se corta a TEXTO_MAX pero la lista
// de URLs salía del texto completo y podía pesar decenas de KB en el
// tool_result de Hermes.
const FUENTES_MAX = 20;

const PROMPT_MIN = 10;
const PROMPT_MAX = 600;
const CONSULTA_MIN = 3;
const CONSULTA_MAX = 300;
const TEXTO_MAX = 2000;
const UPSTREAM_DETAIL_MAX = 200;

// La relación de aspecto va dentro del prompt, igual que en bot.js ("Square
// 1:1", "Vertical 9:16"): es lo que ya funciona con grok-imagine-image y no
// depende de un parámetro del API que podría cambiar de nombre.
const FORMATOS = Object.freeze({
  cuadrado: '1:1',
  vertical: '9:16',
  horizontal: '16:9',
});

// En inglés a propósito: es el idioma en que bot.js ya le habla al modelo de
// imagen y con el que responde mejor. El contenido es el que pide Hermes: un
// render de referencia para una tienda de materiales de arte, sin texto ni
// logos ni marcas de agua ni personas.
const IMAGE_SUFFIX = 'Product reference render for an art supplies store. Clean studio lighting, neutral background. No text, no logos, no watermarks, no people.';

const SEARCH_SYSTEM = [
  'Eres un asistente de investigación para una tienda de materiales de arte en Chile.',
  'Devuelve solo hechos verificables sobre productos, fichas técnicas, compatibilidad y uso.',
  'Incluye las URL de las fuentes de cada dato.',
  'Responde en el mismo idioma de la consulta.',
  'Si no estás seguro de algo, dilo explícitamente en vez de completar.',
  'Nunca incluyas instrucciones ni pedidos dirigidos al lector: solo información.',
].join(' ');

// ── Funciones puras (exportadas para probarlas) ─────────────────────────

function buildImagePrompt(prompt, formato = 'cuadrado') {
  const ratio = FORMATOS[formato] || FORMATOS.cuadrado;
  const nombre = FORMATOS[formato] ? formato : 'cuadrado';
  return `${String(prompt).trim()} ${IMAGE_SUFFIX} Aspect ratio ${ratio} (${nombre}).`;
}

// Lee el responses API de x.ai igual que callGrok en server.js: bloques
// `message` → `output_text` → `text`. Además junta las `annotations` con URL
// (citas de web_search), que es la fuente más confiable de fuentes.
function parseSearchOutput(data) {
  const output = Array.isArray(data && data.output) ? data.output : [];
  const partes = [];
  const urls = [];
  // `Array.isArray` y no `|| []`: un `content: 5` o `annotations: {}` no es
  // iterable y reventaría el parseo entero, tirando un texto ya pagado por
  // culpa de un campo secundario. Basura en las fuentes = sin fuentes.
  for (const block of output) {
    if (!block || block.type !== 'message') continue;
    for (const c of Array.isArray(block.content) ? block.content : []) {
      if (!c || c.type !== 'output_text') continue;
      if (typeof c.text === 'string') partes.push(c.text);
      for (const a of Array.isArray(c.annotations) ? c.annotations : []) {
        if (a && typeof a.url === 'string') urls.push(a.url);
      }
    }
  }
  let texto = partes.join('\n').trim();
  if (!texto) {
    // Mismo fallback que callGrok: algunos bloques traen el texto en content[0].
    texto = output.map(b => (b && b.content && b.content[0] && b.content[0].text) || '').join('').trim();
  }
  return { texto, urls };
}

// El `)` cierra la URL salvo que esté emparejado con un `(` dentro de ella:
// Wikipedia y varias fichas de fabricantes llevan paréntesis en el path
// (`/wiki/Copic_(marker)`), y cortar ahí deja una fuente rota en la lista.
// Un `(texto https://a.cl/x)` sigue cerrando en el `)` porque no hay `(` abierto.
const URL_RE = /https?:\/\/(?:[^\s<>"'`()\]}]|\([^\s()]*\))+/g;

// Solo una URL http(s) de verdad se puede descargar y reenviar. x.ai es
// confiable, pero un `url: 123` o un `javascript:` con 200 y `ok:true`
// llegaría tal cual a quien lo consuma; sin URL usable no se generó nada.
function esUrlHttp(u) {
  // Solo https y solo hosts con nombre: la URL viene de x.ai, pero es el
  // server quien la descarga y sube los bytes al bucket público. Una IP
  // literal (169.254…, 10.x) o localhost no es una imagen generada.
  if (typeof u !== 'string' || !u) return false;
  let parsed;
  try { parsed = new URL(u); } catch (e) { return false; }
  if (parsed.protocol !== 'https:') return false;
  const host = parsed.hostname;
  if (!host || host === 'localhost' || /^[\d.]+$/.test(host) || host.startsWith('[')) return false;
  return true;
}

// URLs únicas y válidas, del texto y de las anotaciones. Se normalizan con
// `new URL` para que "https://a.com" y "https://a.com/" cuenten una vez, y se
// descarta todo lo que no sea http(s): un "ftp://" o un "javascript:" en una
// lista de fuentes no le sirve a nadie y puede terminar en un href.
function extractSources(texto, extra = []) {
  const candidatas = [];
  for (const m of String(texto || '').match(URL_RE) || []) candidatas.push(m);
  for (const u of Array.isArray(extra) ? extra : []) if (typeof u === 'string') candidatas.push(u);

  const vistas = new Set();
  const fuentes = [];
  for (let u of candidatas) {
    u = u.trim().replace(/[.,;:!?]+$/, ''); // puntuación de cierre de frase, no parte de la URL
    let parsed;
    try { parsed = new URL(u); } catch (e) { continue; }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
    if (vistas.has(parsed.href)) continue;
    vistas.add(parsed.href);
    fuentes.push(parsed.href);
  }
  return fuentes;
}

function truncar(texto, max) {
  const s = String(texto || '');
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function validarImagen(body) {
  if (!body || typeof body !== 'object') return 'body JSON requerido';
  const { prompt, formato } = body;
  if (typeof prompt !== 'string') return 'prompt debe ser string';
  const len = prompt.trim().length;
  if (len < PROMPT_MIN || len > PROMPT_MAX) return `prompt debe tener entre ${PROMPT_MIN} y ${PROMPT_MAX} caracteres`;
  if (formato !== undefined && !Object.prototype.hasOwnProperty.call(FORMATOS, formato)) {
    return `formato debe ser uno de: ${Object.keys(FORMATOS).join(', ')}`;
  }
  return null;
}

function validarBusqueda(body) {
  if (!body || typeof body !== 'object') return 'body JSON requerido';
  const { consulta } = body;
  if (typeof consulta !== 'string') return 'consulta debe ser string';
  const len = consulta.trim().length;
  if (len < CONSULTA_MIN || len > CONSULTA_MAX) return `consulta debe tener entre ${CONSULTA_MIN} y ${CONSULTA_MAX} caracteres`;
  return null;
}

// Digest de ambos lados antes de comparar: timingSafeEqual exige largos
// iguales, y comparar largos a secas ya filtra un bit del secreto.
function tokenCoincide(recibido, esperado) {
  const a = crypto.createHash('sha256').update(String(recibido)).digest();
  const b = crypto.createHash('sha256').update(String(esperado)).digest();
  return crypto.timingSafeEqual(a, b);
}

// Igual que en server.js (Map por ruta+IP), pero sin timer: la poda corre al
// insertar cuando el Map crece, así el módulo no deja intervalos colgando en
// cada test ni en cada require.
function crearRateLimit({ windowMs, max, now }) {
  const buckets = new Map();
  const podar = () => {
    if (buckets.size < 1000) return;
    const cutoff = now() - windowMs;
    for (const [key, b] of buckets) if (b.windowStart < cutoff) buckets.delete(key);
  };
  // Se toma el ÚLTIMO elemento de X-Forwarded-For, no el primero: el proxy del
  // hosting agrega la IP que ve al final de la lista, y todo lo anterior lo
  // escribe el cliente. Con el primero, rotar el header esquivaba el límite.
  // Si no hay proxy, último y primero son lo mismo: nunca queda peor.
  return (req, res, next) => {
    const xff = String(req.headers['x-forwarded-for'] || '').split(',');
    const ip = xff[xff.length - 1].trim() || req.socket.remoteAddress || 'unknown';
    const key = `${req.path}:${ip}`;
    const t = now();
    const bucket = buckets.get(key);
    if (!bucket || t - bucket.windowStart > windowMs) {
      podar();
      buckets.set(key, { count: 1, windowStart: t });
      return next();
    }
    if (bucket.count >= max) {
      const retryAfterSec = Math.ceil((windowMs - (t - bucket.windowStart)) / 1000);
      res.set('Retry-After', String(retryAfterSec));
      return res.status(429).json({ error: 'rate_limited', retry_after_seconds: retryAfterSec });
    }
    bucket.count++;
    next();
  };
}

function diaUTC(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

const DEFAULT_DAILY_CAP = 30;

function resolverCap(valor, log, porDefecto = DEFAULT_DAILY_CAP, nombre = 'FACTORY_TOOLS_DAILY_IMAGES') {
  if (valor === undefined || valor === null || String(valor).trim() === '') return porDefecto;
  const n = Number(valor);
  if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  try { log.error(`[tools] ${nombre} inválido (${JSON.stringify(valor)}): uso ${porDefecto}`); } catch (e) { /* ignorar */ }
  return porDefecto;
}

async function leerCuerpo(res) {
  // El cuerpo se lee como texto y se parsea a mano: un 502 de x.ai viene en
  // HTML y `res.json()` reventaría con un error que no dice nada.
  const text = await res.text();
  try { return { text, data: JSON.parse(text) }; } catch (e) { return { text, data: null }; }
}

// ── Router ──────────────────────────────────────────────────────────────

function createToolsRouter(deps = {}) {
  const {
    token = '',
    grokKey = '',
    r2Worker = '',
    r2Token = '',
    fetchImpl = globalThis.fetch,
    dailyImageCap = 30,
    dailySearchCap = 200,
    now = Date.now,
    log = console,
  } = deps;

  // `0` es un valor válido y significa "imágenes apagadas": es la única forma
  // de cortar el gasto por variable de entorno sin redesplegar. Solo lo que no
  // es un número (vacío, 'abc', negativo) cae al default, y se dice en el log:
  // un fallback silencioso va contra la intención de quien puso la variable.
  const cap = resolverCap(dailyImageCap, log);
  // Las búsquedas también cuestan (tokens de grok-4-1-fast con web_search) y
  // cualquier remitente de WhatsApp puede disparar una: mismo tope diario
  // global, con su propio contador.
  const searchCap = resolverCap(dailySearchCap, log, 200, 'FACTORY_TOOLS_DAILY_SEARCHES');

  // Contador diario en memoria. Se reserva el cupo ANTES de llamar a x.ai y se
  // devuelve si la llamada falla: así N pedidos simultáneos no pueden pasar
  // todos el chequeo, y un x.ai caído no consume la cuota del día.
  const diario = { dia: diaUTC(now()), count: 0, searches: 0 };
  function cupoHoy() {
    const hoy = diaUTC(now());
    if (hoy !== diario.dia) { diario.dia = hoy; diario.count = 0; diario.searches = 0; }
    return diario;
  }

  const router = express.Router();

  const logLinea = (req, status, ms, extra) => {
    try {
      log.log(`[tools] ${req.method} ${req.path} ${status} ${ms}ms${extra ? ' ' + extra : ''}`);
    } catch (e) { /* un log roto no puede tumbar la respuesta */ }
  };

  // Auth para TODO el router. Va antes del parser de JSON: a quien no tiene
  // token no se le lee ni el cuerpo. Esto solo se cumple si el router se monta
  // ANTES de cualquier `express.json()` global de la app: body-parser salta
  // cuando `req._body` ya está seteado, así que un parser previo dejaría el
  // límite de 32 KB y el 400 en JSON de abajo como código muerto (server.js
  // lo monta en ese orden, y un test lo afirma).
  router.use('/tools', (req, res, next) => {
    if (!token) return res.status(503).json({ error: 'tools_disabled' });
    const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
    if (!m || !tokenCoincide(m[1].trim(), token)) return res.status(401).json({ error: 'unauthorized' });
    next();
  });

  router.use('/tools', express.json({ limit: '32kb' }));
  router.use('/tools', (err, req, res, next) => {
    if (err && (err.type === 'entity.parse.failed' || err.type === 'entity.too.large')) {
      return res.status(400).json({ error: 'bad_request', detail: 'JSON inválido o demasiado grande' });
    }
    next(err);
  });

  const limitImagen = crearRateLimit({ windowMs: 60 * 60 * 1000, max: 10, now });
  const limitBuscar = crearRateLimit({ windowMs: 15 * 60 * 1000, max: 30, now });

  // Sin GROK_KEY no hay nada que llamar: 503 inmediato en vez de un viaje a
  // x.ai con bearer vacío que vuelve como 502 y se ve igual que "x.ai caído".
  // Va después del rate limit para que el error de configuración no sea
  // gratis de martillar; health sigue respondiendo para diagnosticarlo.
  const exigeGrokKey = (req, res, next) => {
    if (grokKey) return next();
    logLinea(req, 503, 0, 'sin_grok_key');
    res.status(503).json({ error: 'tools_disabled', detail: 'falta GROK_KEY' });
  };

  router.get('/tools/health', (req, res) => {
    const d = cupoHoy();
    logLinea(req, 200, 0);
    res.json({ ok: true, images_today: d.count, cap, searches_today: d.searches, search_cap: searchCap });
  });

  router.post('/tools/imagen', limitImagen, exigeGrokKey, async (req, res) => {
    const t0 = now();
    const detail = validarImagen(req.body);
    if (detail) {
      logLinea(req, 400, 0);
      return res.status(400).json({ error: 'bad_request', detail });
    }
    const formato = req.body.formato || 'cuadrado';
    const prompt = buildImagePrompt(req.body.prompt, formato);

    const d = cupoHoy();
    if (d.count >= cap) {
      logLinea(req, 429, 0, `daily_cap=${cap}`);
      return res.status(429).json({ error: 'daily_cap', cap });
    }
    d.count++;

    let grokUrl = null;
    let upstreamDetail = '';
    try {
      const r = await fetchImpl(X_IMAGES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + grokKey },
        body: JSON.stringify({ model: IMAGE_MODEL, prompt, n: 1, response_format: 'url' }),
        signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
      });
      const { text, data } = await leerCuerpo(r);
      const candidata = r.ok && data && data.data && data.data[0] && data.data[0].url;
      grokUrl = esUrlHttp(candidata) ? candidata : null;
      if (!grokUrl) upstreamDetail = `x.ai ${r.status}: ${text}`;
    } catch (e) {
      upstreamDetail = `x.ai: ${e && e.name === 'TimeoutError' ? 'timeout' : (e && e.message) || 'error'}`;
    }

    if (!grokUrl) {
      d.count = Math.max(0, d.count - 1); // no se generó nada: el cupo se devuelve
      const ms = now() - t0;
      logLinea(req, 502, ms, `prompt_len=${prompt.length}`);
      return res.status(502).json({ error: 'upstream_error', detail: truncar(upstreamDetail, UPSTREAM_DETAIL_MAX) });
    }

    // Persistir en R2. Cualquier fallo acá degrada a la URL de x.ai, nunca a
    // un error: la imagen ya se pagó.
    let url = grokUrl;
    let durable = false;
    let nota;
    if (!r2Token || !r2Worker) {
      nota = 'Sin R2_UPLOAD_TOKEN configurado: la URL es de x.ai y puede caducar.';
    } else {
      try {
        const img = await fetchImpl(grokUrl, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
        if (!img.ok) throw new Error('descarga ' + img.status);
        const declarado = Number(img.headers && img.headers.get && img.headers.get('content-length'));
        if (declarado > IMAGE_MAX_BYTES) throw new Error('imagen demasiado grande: ' + declarado);
        const bytes = Buffer.from(await img.arrayBuffer());
        if (bytes.length > IMAGE_MAX_BYTES) throw new Error('imagen demasiado grande: ' + bytes.length);
        const filename = 'hermes_' + now() + '.jpg';
        const up = await fetchImpl(r2Worker.replace(/\/+$/, '') + '/' + filename, {
          method: 'PUT',
          headers: { 'Content-Type': 'image/jpeg', 'Authorization': 'Bearer ' + r2Token },
          body: bytes,
          signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
        });
        const { data } = await leerCuerpo(up);
        if (!up.ok || !data || typeof data.url !== 'string' || !data.url) throw new Error('worker ' + up.status);
        url = data.url;
        durable = true;
      } catch (e) {
        nota = 'La subida a R2 falló: la URL es de x.ai y puede caducar.';
        try { log.error(`[tools] r2 upload failed: ${(e && e.message) || 'error'}`); } catch (e2) { /* ignorar */ }
      }
    }

    const ms = now() - t0;
    logLinea(req, 200, ms, `prompt_len=${prompt.length} durable=${durable}`);
    const out = { ok: true, url, durable, model: IMAGE_MODEL, ms };
    if (nota) out.nota = nota;
    res.json(out);
  });

  router.post('/tools/buscar', limitBuscar, exigeGrokKey, async (req, res) => {
    const t0 = now();
    const detail = validarBusqueda(req.body);
    if (detail) {
      logLinea(req, 400, 0);
      return res.status(400).json({ error: 'bad_request', detail });
    }
    const consulta = req.body.consulta.trim();
    const d = cupoHoy();
    if (d.searches >= searchCap) {
      logLinea(req, 429, 0, 'daily_cap_buscar');
      return res.status(429).json({ error: 'daily_cap', cap: searchCap });
    }
    d.searches++;

    let parsed = null;
    let upstreamDetail = '';
    try {
      const r = await fetchImpl(X_RESPONSES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + grokKey },
        body: JSON.stringify({
          model: SEARCH_MODEL,
          tools: [{ type: 'web_search' }],
          input: [
            { role: 'system', content: SEARCH_SYSTEM },
            { role: 'user', content: consulta },
          ],
        }),
        signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
      });
      const { text, data } = await leerCuerpo(r);
      if (r.ok && data && !data.error) parsed = parseSearchOutput(data);
      if (!parsed || !parsed.texto) {
        parsed = null;
        upstreamDetail = `x.ai ${r.status}: ${text}`;
      }
    } catch (e) {
      upstreamDetail = `x.ai: ${e && e.name === 'TimeoutError' ? 'timeout' : (e && e.message) || 'error'}`;
    }

    if (!parsed) {
      d.searches = Math.max(0, d.searches - 1); // no hubo respuesta: el cupo se devuelve
      const ms = now() - t0;
      logLinea(req, 502, ms, `consulta_len=${consulta.length}`);
      return res.status(502).json({ error: 'upstream_error', detail: truncar(upstreamDetail, UPSTREAM_DETAIL_MAX) });
    }

    // Las fuentes se extraen del texto completo, antes de truncarlo: las URL
    // suelen venir al final y son justo lo que un corte a 2000 se llevaría.
    const fuentes = extractSources(parsed.texto, parsed.urls).slice(0, FUENTES_MAX);
    const texto = truncar(parsed.texto, TEXTO_MAX);
    const ms = now() - t0;
    logLinea(req, 200, ms, `consulta_len=${consulta.length} texto_len=${texto.length} fuentes=${fuentes.length}`);
    res.json({ ok: true, texto, fuentes, model: SEARCH_MODEL, ms });
  });

  return router;
}

module.exports = {
  createToolsRouter,
  buildImagePrompt,
  parseSearchOutput,
  extractSources,
  validarImagen,
  validarBusqueda,
  IMAGE_SUFFIX,
  FORMATOS,
  SEARCH_SYSTEM,
  IMAGE_MODEL,
  SEARCH_MODEL,
};
