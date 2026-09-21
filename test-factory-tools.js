// test-factory-tools.js — pruebas del router de herramientas para Hermes.
//
// Corren SIN red y SIN credenciales: `fetchImpl` es un doble que discrimina
// por URL (x.ai imágenes, x.ai responses, descarga de la imagen, worker de
// R2), y el router se levanta en un puerto efímero para pegarle con el fetch
// real de Node. Así se prueba lo que Hermes va a ver de verdad —status,
// headers, JSON— y no solo funciones sueltas.
//
// CommonJS y no `import`: el repo entero es CommonJS y package.json no declara
// "type": "module". Mismos módulos (node:test, node:assert/strict).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const {
  createToolsRouter,
  buildImagePrompt,
  parseSearchOutput,
  extractSources,
  IMAGE_SUFFIX,
  FORMATOS,
  IMAGE_MODEL,
  SEARCH_MODEL,
} = require('./factory-tools');

// Valores de prueba, obviamente falsos. Los reales viven en variables de
// entorno y nunca en un archivo del repo.
const TOKEN = 'token-de-prueba-no-real';
const GROK_KEY = 'grok-key-de-prueba';
const R2_TOKEN = 'r2-token-de-prueba';
const R2_WORKER = 'https://r2-worker.test';
const GROK_IMG_URL = 'https://imgen.x.ai.test/out/abc.jpg?sig=firma-larga';
const PROMPT_OK = 'Set de acuarelas profesionales sobre mesa de madera, 24 colores';

function jsonRes(status, obj) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}
function textRes(status, text) {
  return new Response(text, { status, headers: { 'content-type': 'text/html' } });
}
function binRes(status, buf) {
  return new Response(buf, { status, headers: { 'content-type': 'image/jpeg' } });
}

function respuestaBusqueda(texto, annotations = []) {
  return {
    output: [
      { type: 'web_search_call', status: 'completed' },
      { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: texto, annotations }] },
    ],
  };
}

// Doble de fetch. Cada rama se puede reemplazar por test; registra las
// llamadas para poder afirmar sobre headers y cuerpos enviados.
function fetchDouble(overrides = {}) {
  const calls = [];
  const fn = async (url, init = {}) => {
    const u = String(url);
    calls.push({ url: u, method: init.method || 'GET', headers: init.headers || {}, body: init.body });
    if (u.startsWith('https://api.x.ai/v1/images/generations')) {
      return overrides.images ? overrides.images(init) : jsonRes(200, { data: [{ url: GROK_IMG_URL }] });
    }
    if (u.startsWith('https://imgen.x.ai.test/')) {
      return overrides.download ? overrides.download(init) : binRes(200, Buffer.from('bytes-de-jpeg'));
    }
    if (u.startsWith(R2_WORKER + '/')) {
      return overrides.r2 ? overrides.r2(u, init) : jsonRes(200, { url: 'https://pub.r2.test/' + u.slice(R2_WORKER.length + 1) });
    }
    if (u.startsWith('https://api.x.ai/v1/responses')) {
      return overrides.search ? overrides.search(init) : jsonRes(200, respuestaBusqueda('Sin fuentes.'));
    }
    throw new Error('URL inesperada en el doble de fetch: ' + u);
  };
  fn.calls = calls;
  return fn;
}

function logCaptor() {
  const lineas = [];
  return { lineas, log: (...a) => lineas.push(a.join(' ')), error: (...a) => lineas.push(a.join(' ')) };
}

async function levantar(t, deps = {}) {
  const fetchImpl = deps.fetchImpl || fetchDouble();
  const log = deps.log || logCaptor();
  const app = express();
  app.use(createToolsRouter({
    token: TOKEN,
    grokKey: GROK_KEY,
    r2Worker: R2_WORKER,
    r2Token: R2_TOKEN,
    ...deps,
    fetchImpl,
    log,
  }));
  const server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (method, path, { body, token = TOKEN } = {}) => fetch(base + path, {
    method,
    headers: {
      ...(token === null ? {} : { Authorization: 'Bearer ' + token }),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { base, call, fetchImpl, log };
}

// ── Funciones puras ─────────────────────────────────────────────────────

test('buildImagePrompt: texto del usuario + sufijo fijo + relación de aspecto del formato', () => {
  const p = buildImagePrompt('  pinceles de cerda  ', 'vertical');
  assert.ok(p.startsWith('pinceles de cerda '), 'el prompt del usuario va primero, sin espacios sobrantes');
  assert.ok(p.includes(IMAGE_SUFFIX), 'incluye el sufijo fijo');
  assert.ok(p.includes(FORMATOS.vertical), 'incluye la relación 9:16');
  assert.ok(p.includes('(vertical)'), 'nombra el formato');
  for (const frase of ['No text', 'no logos', 'no watermarks', 'no people']) assert.ok(p.includes(frase), frase);
  assert.ok(buildImagePrompt('x', 'horizontal').includes('16:9'));
  assert.ok(buildImagePrompt('x').includes('1:1'), 'sin formato → cuadrado');
  assert.ok(buildImagePrompt('x', 'inexistente').includes('1:1'), 'formato desconocido cae a cuadrado');
});

test('extractSources: dedupe, normaliza, descarta lo que no es URL http(s)', () => {
  const texto = [
    'Fuentes: https://ejemplo.cl/ficha.pdf, https://ejemplo.cl/ficha.pdf.',
    'Ver también (https://otra.com/p?a=1&b=2) y ftp://nada.com/x y javascript:alert(1)',
    'https://ejemplo.cl y https://ejemplo.cl/ son la misma',
    'esto-no-es-url ni www.sin-esquema.cl',
    // Paréntesis DENTRO del path (Wikipedia) se conservan; el `)` que cierra
    // un paréntesis del texto sigue cortando la URL.
    'Ver https://en.wikipedia.org/wiki/Copic_(marker) y (también https://a.cl/x).',
  ].join('\n');
  const fuentes = extractSources(texto, ['https://otra.com/p?a=1&b=2', 'no-es-url', 42, 'https://anotada.cl/x']);
  assert.deepEqual(fuentes, [
    'https://ejemplo.cl/ficha.pdf',
    'https://otra.com/p?a=1&b=2',
    'https://ejemplo.cl/',
    'https://en.wikipedia.org/wiki/Copic_(marker)',
    'https://a.cl/x',
    'https://anotada.cl/x',
  ]);
  assert.deepEqual(extractSources('', []), []);
  assert.deepEqual(extractSources(null, null), []);
});

test('parseSearchOutput: junta output_text y URLs de annotations; tolera basura', () => {
  const data = {
    output: [
      { type: 'web_search_call' },
      { type: 'message', content: [
        { type: 'output_text', text: 'Parte 1', annotations: [{ type: 'url_citation', url: 'https://a.cl/1' }, { type: 'otra' }] },
        { type: 'refusal', refusal: 'no' },
        { type: 'output_text', text: 'Parte 2' },
      ] },
      null,
    ],
  };
  const r = parseSearchOutput(data);
  assert.equal(r.texto, 'Parte 1\nParte 2');
  assert.deepEqual(r.urls, ['https://a.cl/1']);
  assert.deepEqual(parseSearchOutput({}), { texto: '', urls: [] });
  assert.deepEqual(parseSearchOutput(null), { texto: '', urls: [] });
  // No iterables donde va una lista: el texto (ya pagado) se conserva y las
  // fuentes quedan vacías, en vez de reventar y responder 502.
  const conBasura = { output: [{ type: 'message', content: [{ type: 'output_text', text: 'Texto válido', annotations: 5 }] }] };
  assert.deepEqual(parseSearchOutput(conBasura), { texto: 'Texto válido', urls: [] });
  assert.deepEqual(parseSearchOutput({ output: [{ type: 'message', content: 5 }] }), { texto: '', urls: [] });
});

// ── Auth ────────────────────────────────────────────────────────────────

test('503 tools_disabled cuando no hay token configurado (falla cerrado)', async (t) => {
  const { call } = await levantar(t, { token: '' });
  for (const [m, p] of [['GET', '/tools/health'], ['POST', '/tools/imagen'], ['POST', '/tools/buscar']]) {
    const r = await call(m, p, { body: m === 'POST' ? { prompt: PROMPT_OK, consulta: 'acuarela' } : undefined });
    assert.equal(r.status, 503, `${m} ${p}`);
    assert.deepEqual(await r.json(), { error: 'tools_disabled' });
  }
});

test('401 unauthorized con token errado, ausente o esquema distinto', async (t) => {
  const { call, base } = await levantar(t);
  let r = await call('GET', '/tools/health', { token: 'otro-token' });
  assert.equal(r.status, 401);
  assert.deepEqual(await r.json(), { error: 'unauthorized' });
  r = await call('POST', '/tools/imagen', { token: null, body: { prompt: PROMPT_OK } });
  assert.equal(r.status, 401);
  r = await fetch(base + '/tools/health', { headers: { Authorization: 'Basic ' + TOKEN } });
  assert.equal(r.status, 401);
  // Un prefijo del token tampoco pasa.
  r = await call('GET', '/tools/health', { token: TOKEN.slice(0, -1) });
  assert.equal(r.status, 401);
});

// ── /tools/imagen ───────────────────────────────────────────────────────

test('400 bad_request con prompt corto, largo, no string y formato inválido', async (t) => {
  const { call, fetchImpl } = await levantar(t);
  const casos = [
    { prompt: 'corto' },
    { prompt: 'x'.repeat(601) },
    { prompt: 123 },
    {},
    { prompt: PROMPT_OK, formato: 'panoramico' },
  ];
  for (const body of casos) {
    const r = await call('POST', '/tools/imagen', { body });
    assert.equal(r.status, 400, JSON.stringify(body).slice(0, 40));
    const j = await r.json();
    assert.equal(j.error, 'bad_request');
    assert.equal(typeof j.detail, 'string');
  }
  assert.equal(fetchImpl.calls.length, 0, 'ninguna validación fallida llega a x.ai');
});

test('200 imagen: URL de R2 y durable:true; x.ai recibe el prompt armado y R2 el token', async (t) => {
  const { call, fetchImpl, log } = await levantar(t);
  const r = await call('POST', '/tools/imagen', { body: { prompt: PROMPT_OK, formato: 'vertical' } });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.ok, true);
  assert.equal(j.durable, true);
  assert.equal(j.model, IMAGE_MODEL);
  assert.equal(typeof j.ms, 'number');
  assert.match(j.url, /^https:\/\/pub\.r2\.test\/hermes_\d+\.jpg$/);
  assert.equal(j.nota, undefined);

  const [xai, descarga, r2] = fetchImpl.calls;
  assert.equal(xai.method, 'POST');
  assert.equal(xai.headers.Authorization, 'Bearer ' + GROK_KEY);
  const enviado = JSON.parse(xai.body);
  assert.equal(enviado.model, IMAGE_MODEL);
  assert.equal(enviado.n, 1);
  assert.equal(enviado.response_format, 'url');
  assert.equal(enviado.prompt, buildImagePrompt(PROMPT_OK, 'vertical'));

  assert.equal(descarga.url, GROK_IMG_URL);
  assert.equal(r2.method, 'PUT');
  assert.equal(r2.headers.Authorization, 'Bearer ' + R2_TOKEN);
  assert.equal(r2.headers['Content-Type'], 'image/jpeg');
  assert.match(r2.url, new RegExp('^' + R2_WORKER + '/hermes_\\d+\\.jpg$'));
  assert.equal(Buffer.from(r2.body).toString(), 'bytes-de-jpeg');

  // Los logs no llevan ni el prompt ni la URL con firma ni el token.
  const todo = log.lineas.join('\n');
  assert.ok(todo.includes('POST /tools/imagen 200'), todo);
  assert.ok(!todo.includes('acuarelas'), 'el prompt no se loguea');
  assert.ok(!todo.includes('sig='), 'la URL con query string no se loguea');
  assert.ok(!todo.includes(TOKEN) && !todo.includes(R2_TOKEN) && !todo.includes(GROK_KEY), 'ningún secreto en logs');
});

test('200 imagen con durable:false y nota cuando R2 falla', async (t) => {
  const fetchImpl = fetchDouble({ r2: () => textRes(500, 'worker caído') });
  const { call } = await levantar(t, { fetchImpl });
  const r = await call('POST', '/tools/imagen', { body: { prompt: PROMPT_OK } });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.ok, true);
  assert.equal(j.durable, false);
  assert.equal(j.url, GROK_IMG_URL);
  assert.match(j.nota, /caducar/);
});

test('200 imagen con durable:false cuando no hay r2Token, sin intentar la subida', async (t) => {
  const fetchImpl = fetchDouble();
  const { call } = await levantar(t, { fetchImpl, r2Token: '' });
  const r = await call('POST', '/tools/imagen', { body: { prompt: PROMPT_OK } });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.durable, false);
  assert.equal(j.url, GROK_IMG_URL);
  assert.match(j.nota, /R2_UPLOAD_TOKEN/);
  assert.equal(fetchImpl.calls.filter(c => c.method === 'PUT').length, 0);
});

test('502 upstream_error cuando x.ai falla (status, JSON sin URL, URL inservible, excepción), detalle acotado a 200 chars', async (t) => {
  const grande = 'E'.repeat(5000);
  const escenarios = [
    fetchDouble({ images: () => textRes(500, grande) }),
    fetchDouble({ images: () => jsonRes(200, { data: [] }) }),
    // Status de error con un cuerpo que igual trae URL: `r.ok` manda.
    fetchDouble({ images: () => jsonRes(402, { data: [{ url: GROK_IMG_URL }] }) }),
    // 200 con una "URL" que no se puede descargar ni reenviar.
    fetchDouble({ images: () => jsonRes(200, { data: [{ url: 123 }] }) }),
    fetchDouble({ images: () => jsonRes(200, { data: [{ url: 'javascript:alert(1)' }] }) }),
    fetchDouble({ images: () => { throw new Error('ECONNRESET'); } }),
  ];
  for (const fetchImpl of escenarios) {
    const { call } = await levantar(t, { fetchImpl });
    const r = await call('POST', '/tools/imagen', { body: { prompt: PROMPT_OK } });
    assert.equal(r.status, 502);
    const j = await r.json();
    assert.equal(j.error, 'upstream_error');
    assert.ok(j.detail.length <= 200, 'detalle acotado');
    assert.equal(fetchImpl.calls.length, 1, 'sin imagen usable no hay descarga ni subida');
  }
});

test('dailyImageCap=0 apaga las imágenes (429 daily_cap con cap:0); un valor no numérico cae a 30 y lo dice en el log', async (t) => {
  const apagado = await levantar(t, { dailyImageCap: 0 });
  let r = await apagado.call('POST', '/tools/imagen', { body: { prompt: PROMPT_OK } });
  assert.equal(r.status, 429);
  assert.deepEqual(await r.json(), { error: 'daily_cap', cap: 0 });
  assert.equal(apagado.fetchImpl.calls.length, 0, 'apagado = ni una llamada a x.ai');
  r = await apagado.call('GET', '/tools/health');
  assert.deepEqual(await r.json(), { ok: true, images_today: 0, cap: 0, searches_today: 0, search_cap: 200 });
  // Lo mismo si llega como string desde el entorno.
  const apagadoStr = await levantar(t, { dailyImageCap: '0' });
  r = await apagadoStr.call('GET', '/tools/health');
  assert.equal((await r.json()).cap, 0);

  const invalido = await levantar(t, { dailyImageCap: 'abc' });
  r = await invalido.call('GET', '/tools/health');
  assert.equal((await r.json()).cap, 30);
  assert.match(invalido.log.lineas.join('\n'), /FACTORY_TOOLS_DAILY_IMAGES inválido/);

  // Variable ausente o vacía: default, sin alarma.
  const vacio = await levantar(t, { dailyImageCap: '' });
  r = await vacio.call('GET', '/tools/health');
  assert.equal((await r.json()).cap, 30);
  assert.ok(!vacio.log.lineas.join('\n').includes('inválido'));
});

test('503 tools_disabled sin grokKey en imagen y buscar, sin salir a la red; health sigue vivo', async (t) => {
  const { call, fetchImpl } = await levantar(t, { grokKey: '' });
  for (const [p, body] of [['/tools/imagen', { prompt: PROMPT_OK }], ['/tools/buscar', { consulta: 'acuarela' }]]) {
    const r = await call('POST', p, { body });
    assert.equal(r.status, 503, p);
    const j = await r.json();
    assert.equal(j.error, 'tools_disabled');
    assert.match(j.detail, /GROK_KEY/);
  }
  assert.equal(fetchImpl.calls.length, 0, 'sin clave no hay viaje a x.ai');
  assert.equal((await call('GET', '/tools/health')).status, 200);
});

test('429 daily_cap al superar dailyImageCap=2; health lo refleja; un fallo de x.ai no consume cupo', async (t) => {
  let fallar = true;
  const fetchImpl = fetchDouble({ images: () => (fallar ? textRes(503, 'ocupado') : jsonRes(200, { data: [{ url: GROK_IMG_URL }] })) });
  const { call } = await levantar(t, { fetchImpl, dailyImageCap: 2 });

  let r = await call('POST', '/tools/imagen', { body: { prompt: PROMPT_OK } });
  assert.equal(r.status, 502);
  fallar = false;

  for (let i = 0; i < 2; i++) {
    r = await call('POST', '/tools/imagen', { body: { prompt: PROMPT_OK } });
    assert.equal(r.status, 200, `imagen ${i + 1}`);
  }
  r = await call('POST', '/tools/imagen', { body: { prompt: PROMPT_OK } });
  assert.equal(r.status, 429);
  assert.deepEqual(await r.json(), { error: 'daily_cap', cap: 2 });

  r = await call('GET', '/tools/health');
  assert.deepEqual(await r.json(), { ok: true, images_today: 2, cap: 2, searches_today: 0, search_cap: 200 });
});

test('el tope diario se reinicia al cambiar el día UTC', async (t) => {
  let ahora = Date.UTC(2026, 8, 21, 23, 59, 0);
  const { call } = await levantar(t, { dailyImageCap: 1, now: () => ahora });
  let r = await call('POST', '/tools/imagen', { body: { prompt: PROMPT_OK } });
  assert.equal(r.status, 200);
  r = await call('POST', '/tools/imagen', { body: { prompt: PROMPT_OK } });
  assert.equal(r.status, 429);
  ahora += 2 * 60 * 1000; // 00:01 del día siguiente
  r = await call('POST', '/tools/imagen', { body: { prompt: PROMPT_OK } });
  assert.equal(r.status, 200);
  r = await call('GET', '/tools/health');
  assert.equal((await r.json()).images_today, 1);
});

test('429 rate_limited por IP: 10 imágenes por hora', async (t) => {
  const { call } = await levantar(t, { dailyImageCap: 100 });
  for (let i = 0; i < 10; i++) {
    const r = await call('POST', '/tools/imagen', { body: { prompt: PROMPT_OK } });
    assert.equal(r.status, 200, `imagen ${i + 1}`);
  }
  const r = await call('POST', '/tools/imagen', { body: { prompt: PROMPT_OK } });
  assert.equal(r.status, 429);
  assert.equal((await r.json()).error, 'rate_limited');
  assert.ok(r.headers.get('retry-after'));
});

test('rate limit por IP: rotar el primer elemento de X-Forwarded-For no lo esquiva (cuenta el que agrega el proxy)', async (t) => {
  const { base } = await levantar(t, { dailyImageCap: 100 });
  const go = (xff) => fetch(base + '/tools/imagen', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json', 'X-Forwarded-For': xff },
    body: JSON.stringify({ prompt: PROMPT_OK }),
  });
  for (let i = 0; i < 10; i++) assert.equal((await go(`1.1.1.${i}, 10.0.0.1`)).status, 200, `imagen ${i + 1}`);
  assert.equal((await go('2.2.2.2, 10.0.0.1')).status, 429, 'el cliente escribe el primer elemento; el proxy, el último');
  assert.equal((await go('3.3.3.3, 10.0.0.2')).status, 200, 'otra IP vista por el proxy sí es otro bucket');
});

// ── /tools/buscar ───────────────────────────────────────────────────────

test('200 búsqueda con texto y fuentes deduplicadas (texto + annotations); sin x_search', async (t) => {
  const texto = 'El Copic Ciao usa tinta a base de alcohol. Fuente: https://copic.jp/en/product/ciao/ y https://copic.jp/en/product/ciao/. Recarga compatible: https://copic.jp/en/ink.';
  const fetchImpl = fetchDouble({
    search: () => jsonRes(200, respuestaBusqueda(texto, [
      { type: 'url_citation', url: 'https://copic.jp/en/product/ciao/' },
      { type: 'url_citation', url: 'https://tienda.cl/copic-ciao' },
    ])),
  });
  const { call, log } = await levantar(t, { fetchImpl });
  const r = await call('POST', '/tools/buscar', { body: { consulta: '¿qué tinta usa el Copic Ciao?' } });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.ok, true);
  assert.equal(j.texto, texto);
  assert.equal(j.model, SEARCH_MODEL);
  assert.equal(typeof j.ms, 'number');
  assert.deepEqual(j.fuentes, [
    'https://copic.jp/en/product/ciao/',
    'https://copic.jp/en/ink',
    'https://tienda.cl/copic-ciao',
  ]);

  const enviado = JSON.parse(fetchImpl.calls[0].body);
  assert.equal(enviado.model, SEARCH_MODEL);
  assert.deepEqual(enviado.tools, [{ type: 'web_search' }]);
  assert.equal(enviado.input[0].role, 'system');
  assert.equal(enviado.input[1].role, 'user');
  assert.equal(enviado.input[1].content, '¿qué tinta usa el Copic Ciao?');
  assert.equal(fetchImpl.calls[0].headers.Authorization, 'Bearer ' + GROK_KEY);

  const todo = log.lineas.join('\n');
  assert.ok(todo.includes('POST /tools/buscar 200'));
  assert.ok(!todo.includes('Copic'), 'la consulta no se loguea');
});

test('búsqueda: texto truncado a 2000 chars, fuentes extraídas del texto completo', async (t) => {
  const texto = 'x'.repeat(2500) + ' https://final.cl/ficha';
  const fetchImpl = fetchDouble({ search: () => jsonRes(200, respuestaBusqueda(texto)) });
  const { call } = await levantar(t, { fetchImpl });
  const r = await call('POST', '/tools/buscar', { body: { consulta: 'ficha' } });
  const j = await r.json();
  assert.equal(j.texto.length, 2000);
  assert.deepEqual(j.fuentes, ['https://final.cl/ficha']);
});

test('400 búsqueda con consulta corta, larga o ausente', async (t) => {
  const { call, fetchImpl } = await levantar(t);
  for (const body of [{ consulta: 'ab' }, { consulta: 'x'.repeat(301) }, {}, { consulta: 5 }]) {
    const r = await call('POST', '/tools/buscar', { body });
    assert.equal(r.status, 400);
    assert.equal((await r.json()).error, 'bad_request');
  }
  assert.equal(fetchImpl.calls.length, 0);
});

test('502 búsqueda cuando x.ai falla, devuelve error o texto vacío', async (t) => {
  const escenarios = [
    fetchDouble({ search: () => textRes(502, '<html>bad gateway</html>') }),
    fetchDouble({ search: () => jsonRes(200, { error: { message: 'invalid api key' } }) }),
    fetchDouble({ search: () => jsonRes(200, { output: [] }) }),
    fetchDouble({ search: () => { const e = new Error('timeout'); e.name = 'TimeoutError'; throw e; } }),
  ];
  for (const fetchImpl of escenarios) {
    const { call } = await levantar(t, { fetchImpl });
    const r = await call('POST', '/tools/buscar', { body: { consulta: 'acuarela' } });
    assert.equal(r.status, 502);
    const j = await r.json();
    assert.equal(j.error, 'upstream_error');
    assert.ok(j.detail.length <= 200);
  }
});

// ── /tools/health ───────────────────────────────────────────────────────

test('health con auth devuelve ok, images_today y cap; sin auth 401', async (t) => {
  const { call } = await levantar(t, { dailyImageCap: 7 });
  let r = await call('GET', '/tools/health');
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, images_today: 0, cap: 7, searches_today: 0, search_cap: 200 });
  r = await call('GET', '/tools/health', { token: null });
  assert.equal(r.status, 401);
});

test('JSON malformado responde 400, no 500', async (t) => {
  const { base } = await levantar(t);
  const r = await fetch(base + '/tools/imagen', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: '{esto no es json',
  });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).error, 'bad_request');
});

// ── Montaje como en server.js ───────────────────────────────────────────
// server.js tiene un `express.json()` global para el resto de las rutas. Si
// corriera antes que el router, el cuerpo se leería sin token, un JSON roto
// respondería con HTML y el límite de 32 KB sería código muerto. Acá se
// reproduce el orden real (router primero, parser global después) y se
// afirma lo que Hermes ve.

async function levantarComoServer(t) {
  const app = express();
  app.use(createToolsRouter({ token: TOKEN, grokKey: GROK_KEY, fetchImpl: fetchDouble(), log: logCaptor() }));
  app.use(express.json());
  app.post('/otra', (req, res) => res.json({ prompt_len: (req.body.prompt || '').length }));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('montado antes del parser global: sin token no se lee el cuerpo (401), JSON roto y >32 KB dan 400 en JSON', async (t) => {
  const base = await levantarComoServer(t);
  const post = (path, body, conToken) => fetch(base + path, {
    method: 'POST',
    headers: { ...(conToken ? { Authorization: 'Bearer ' + TOKEN } : {}), 'Content-Type': 'application/json' },
    body,
  });
  const grande = JSON.stringify({ prompt: 'x'.repeat(50 * 1024) }); // > 32 KB, < 100 KB (default de body-parser)

  let r = await post('/tools/imagen', '{esto no es json', false);
  assert.equal(r.status, 401, 'sin token: 401 antes de mirar el cuerpo, no 400');
  r = await post('/tools/imagen', grande, false);
  assert.equal(r.status, 401, 'sin token: 401, no 413');

  r = await post('/tools/imagen', '{esto no es json', true);
  assert.equal(r.status, 400);
  assert.match(r.headers.get('content-type'), /application\/json/, 'JSON, no la página HTML de Express');
  assert.equal((await r.json()).error, 'bad_request');

  r = await post('/tools/imagen', grande, true);
  assert.equal(r.status, 400);
  assert.match((await r.json()).detail, /grande/, 'el límite de 32 KB del router es el que dispara');

  // El resto de la app sigue con su parser global de siempre.
  r = await post('/otra', grande, false);
  assert.deepEqual(await r.json(), { prompt_len: 50 * 1024 });
});

test('server.js monta el router de tools antes de su express.json() global (cableado)', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, 'server.js'), 'utf8');
  const montaje = src.indexOf('createToolsRouter(');
  const parserGlobal = src.indexOf('app.use(express.json())');
  assert.ok(montaje > 0 && parserGlobal > 0, 'ambas cosas existen en server.js');
  assert.ok(montaje < parserGlobal, 'el router va antes del parser global, o su auth y su límite de 32 KB son código muerto');
  assert.ok(!/dailyImageCap:\s*Number\(/.test(src), 'el cap se pasa crudo: Number() borra la diferencia entre "0" y ausente');
});

// ── Hallazgos de la segunda pasada de verificación ───────────────────────

test('429 daily_cap también para búsquedas (dailySearchCap=2); un fallo de x.ai no consume cupo; health lo refleja', async (t) => {
  let fallar = true;
  const fetchImpl = fetchDouble({ search: () => (fallar ? textRes(503, 'ocupado') : jsonRes(200, respuestaBusqueda('Copic Sketch: alcohol, doble punta. https://copic.test/ficha'))) });
  const { call } = await levantar(t, { fetchImpl, dailySearchCap: 2 });
  let r = await call('POST', '/tools/buscar', { body: { consulta: 'ficha copic sketch' } });
  assert.equal(r.status, 502);
  fallar = false;
  for (let i = 0; i < 2; i++) {
    r = await call('POST', '/tools/buscar', { body: { consulta: 'ficha copic sketch' } });
    assert.equal(r.status, 200, `búsqueda ${i + 1}`);
  }
  r = await call('POST', '/tools/buscar', { body: { consulta: 'ficha copic sketch' } });
  assert.equal(r.status, 429);
  assert.deepEqual(await r.json(), { error: 'daily_cap', cap: 2 });
  r = await call('GET', '/tools/health');
  const h = await r.json();
  assert.equal(h.searches_today, 2);
  assert.equal(h.search_cap, 2);
});

test('una imagen de más de 8 MB no se sube a R2: durable:false con nota, y el proceso sigue vivo', async (t) => {
  const grande = Buffer.alloc(8 * 1024 * 1024 + 1, 1);
  const fetchImpl = fetchDouble({ download: () => binRes(200, grande) });
  const { call } = await levantar(t, { fetchImpl });
  const r = await call('POST', '/tools/imagen', { body: { prompt: PROMPT_OK } });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.durable, false);
  assert.equal(j.url, GROK_IMG_URL);
  assert.ok(j.nota && j.nota.includes('R2'));
  assert.ok(!fetchImpl.calls.some(c => c.url.startsWith(R2_WORKER + '/')), 'no intentó subir a R2');
});

test('la URL que devuelve x.ai debe ser https con host con nombre: http, IP literal o localhost se tratan como upstream_error', async (t) => {
  for (const mala of ['http://imgen.x.ai.test/a.jpg', 'https://169.254.169.254/latest', 'https://localhost/a.jpg', 'https://[::1]/a.jpg']) {
    const fetchImpl = fetchDouble({ images: () => jsonRes(200, { data: [{ url: mala }] }) });
    const { call } = await levantar(t, { fetchImpl });
    const r = await call('POST', '/tools/imagen', { body: { prompt: PROMPT_OK } });
    assert.equal(r.status, 502, mala);
    assert.equal(fetchImpl.calls.filter(c => c.url === mala).length, 0, `no descargó ${mala}`);
  }
});

test('fuentes tope 20 por respuesta aunque el texto traiga más URLs', async (t) => {
  const urls = Array.from({ length: 40 }, (_, i) => `https://fuente${i}.test/ficha`);
  const fetchImpl = fetchDouble({ search: () => jsonRes(200, respuestaBusqueda('Datos. ' + urls.join(' '))) });
  const { call } = await levantar(t, { fetchImpl });
  const r = await call('POST', '/tools/buscar', { body: { consulta: 'ficha copic sketch' } });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.fuentes.length, 20);
  assert.equal(j.fuentes[0], urls[0]);
});
