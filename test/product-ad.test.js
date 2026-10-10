const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const ad = require('../lib/product-ad');
const runway = require('../lib/runway');

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

const PARENT = {
  id: 232957,
  name: 'Copic Classic',
  slug: 'copic-classic',
  sku: '',
  type: 'variable',
  permalink: 'https://www.boykot.cl/tienda/marcadores/copic-markers/copic-individual/copic-classic/',
  prices: {
    price: '2580',
    regular_price: '4300',
    sale_price: '2580',
    currency_code: 'CLP',
    currency_minor_unit: 0,
    currency_thousand_separator: '.'
  },
  short_description: '<p>Marcador a base de alcohol.&amp; Punta biselada.</p>',
  description: '',
  images: [
    { src: 'https://www.boykot.cl/wp-content/uploads/2026/06/copic-classic-chile-1.jpeg' },
    { src: 'https://www.boykot.cl/wp-content/uploads/2026/06/copic-classic-chile-2.jpeg' }
  ],
  variations: [
    { id: 233033, attributes: [{ name: 'Color', value: 'bv00' }] },
    { id: 233034, attributes: [{ name: 'Color', value: 'e15' }] }
  ]
};

const VARIATION = {
  id: 233033,
  name: 'Copic Classic',
  sku: 'MARKER001',
  type: 'variation',
  parent: 232957,
  permalink: 'https://www.boykot.cl/tienda/marcadores/copic-markers/copic-individual/copic-classic/?attribute_pa_color=bv00',
  prices: {
    price: '4300',
    regular_price: '4300',
    sale_price: '4300',
    currency_code: 'CLP',
    currency_minor_unit: 0
  },
  short_description: '',
  images: [{ src: 'https://www.boykot.cl/wp-content/uploads/2026/06/BV00-3.jpg' }],
  attributes: [{ name: 'Color', value: 'bv00' }]
};

function jsonRes(body, status = 200) {
  const text = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => text
  };
}

function box(type, payload) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.concat(payload);
  const out = Buffer.alloc(8 + body.length);
  out.writeUInt32BE(out.length, 0);
  out.write(type, 4, 'latin1');
  body.copy(out, 8);
  return out;
}

function mediaHeader(timescale, duration) {
  const payload = Buffer.alloc(20);
  payload.writeUInt32BE(timescale, 12);
  payload.writeUInt32BE(duration, 16);
  return payload;
}

function fakeMp4({ timescale, duration, samples }) {
  const stts = Buffer.alloc(16);
  stts.writeUInt32BE(1, 4);
  stts.writeUInt32BE(samples, 8);
  const hdlr = Buffer.alloc(12);
  hdlr.write('vide', 8, 'latin1');
  const mdia = box('mdia', [
    box('mdhd', mediaHeader(timescale, duration)),
    box('hdlr', hdlr),
    box('minf', box('stbl', box('stts', stts)))
  ]);
  return box('moov', [
    box('mvhd', mediaHeader(timescale, duration)),
    box('trak', mdia)
  ]);
}

test('precio CLP y texto de la ficha', () => {
  assert.equal(ad.formatClp(4300), '$4.300');
  assert.equal(ad.amountFromPrices({ price: '4300', currency_minor_unit: 0 }), 4300);
  assert.equal(ad.amountFromPrices({ price: '430000', currency_minor_unit: 2 }), 4300);
  assert.match(ad.htmlToText('<p>Hola&amp;chao</p>'), /Hola&chao/);
});

test('costo product_ad según la tabla de pricing', () => {
  assert.equal(ad.productAdCredits('1080p', 10), 456);
  assert.equal(ad.productAdCredits('720p', 6), 272);
  assert.equal(ad.productAdCredits('1080p', 4), 216);
  const full = ad.planProductAd({ duration: 10, lowRes: false, audio: false });
  assert.equal(full.credits, 912);
  assert.equal(full.usd, 9.12);
  assert.deepEqual(full.lines.map(l => l.ratio), ['1080:1920', '1440:1440']);
  const cheap = ad.planProductAd({ duration: 6, lowRes: true, audio: true });
  assert.equal(cheap.credits, 544);
  assert.deepEqual(cheap.lines.map(l => l.ratio), ['720:1280', '960:960']);
  assert.match(ad.formatCostPlan(full), /912 créditos/);
});

test('flags de /ad', () => {
  const parsed = ad.parseAdArgs('/ad MARKER001 mural en la calle --dur 6 --720 --audio --dry');
  assert.equal(parsed.query, 'MARKER001');
  assert.equal(parsed.concept, 'mural en la calle');
  assert.equal(parsed.duration, 6);
  assert.equal(parsed.lowRes, true);
  assert.equal(parsed.audio, true);
  assert.equal(parsed.dry, true);
  assert.match(ad.parseAdArgs('/ad X --dur 3').error, /4 a 15|4–15/);
  assert.equal(ad.parseAdArgs('/ad').usage, true);
  const url = ad.parseAdArgs('/ad https://www.boykot.cl/tienda/copic-classic/?attribute_pa_color=bv00');
  assert.equal(url.concept, null);
  assert.equal(url.duration, 10);
});

test('gen4_turbo acepta 3 segundos y rechaza fuera de 2–10', () => {
  assert.equal(ad.gen4TurboDuration(3).duration, 3);
  assert.equal(ad.gen4TurboDuration(null).duration, 5);
  assert.match(ad.gen4TurboDuration(1).error, /2 a 10/);
  assert.match(ad.gen4TurboDuration(11).error, /2 a 10/);
  assert.match(ad.gen4TurboDuration(3.5).error, /2 a 10/);
});

test('resuelve un SKU de variación y arma el payload sin llamar a Runway', async () => {
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url: String(url), method: opts.method || 'GET' });
    const u = String(url);
    if (u.includes('?sku=')) return jsonRes([VARIATION]);
    if (u.endsWith('/232957')) return jsonRes(PARENT);
    if ((opts.method || 'GET') === 'HEAD') {
      return { ok: false, status: 403, headers: new Headers({ 'content-type': 'text/html' }) };
    }
    if (u.includes('BV00')) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'image/png' }),
        arrayBuffer: async () => Uint8Array.from(PNG_1X1).buffer
      };
    }
    if (u.includes('copic-classic-chile')) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'image/jpeg' }),
        arrayBuffer: async () => Uint8Array.from(PNG_1X1).buffer
      };
    }
    throw new Error('fetch inesperado ' + u);
  };

  const product = await ad.resolveBoykotProduct('MARKER001', { fetch: fetchImpl });
  assert.equal(product.name, 'Copic Classic');
  assert.equal(product.sku, 'MARKER001');
  assert.equal(product.priceAmount, 4300);
  assert.equal(product.priceLabel, '$4.300 CLP');
  assert.match(product.features, /alcohol/);
  assert.deepEqual(product.imageUrls, [VARIATION.images[0].src]);
  assert.match(product.variationLabel, /bv00/i);

  const prepared = [];
  for (const src of product.imageUrls) {
    prepared.push(await ad.ensureRunwayImage(src, { fetch: fetchImpl, dryRun: true }));
  }
  assert.ok(prepared.every(img => img.via === 'data-uri'));
  assert.ok(prepared.every(img => img.uri.startsWith('data:image/')));
  assert.equal(calls.some(c => c.method === 'HEAD'), true);
  assert.equal(calls.some(c => String(c.url).includes('api.dev.runwayml.com')), false);

  const plan = ad.planProductAd({ duration: 10, lowRes: false, audio: false });
  const bodies = plan.lines.map(line => ad.buildProductAdBody({
    product,
    imageUris: prepared.map(img => img.uri),
    concept: null,
    ratio: line.ratio,
    duration: 10,
    audio: false
  }));
  assert.equal(bodies.length, 2);
  assert.deepEqual(bodies.map(b => b.ratio), ['1080:1920', '1440:1440']);
  for (const body of bodies) {
    assert.equal(body.version, '2026-07');
    assert.equal(body.duration, 10);
    assert.equal(body.audio, false);
    assert.equal(body.productImages.length, product.imageUrls.length);
    assert.match(body.productInfo, /Copic Classic/);
    assert.match(body.productInfo, /\$4\.300 CLP/);
    assert.match(body.userConcept, /#CCFF00/);
    assert.match(body.userConcept, /Boykot/);
    assert.equal(Object.hasOwn(body, 'model'), false);
  }
  const custom = ad.buildProductAdBody({
    product,
    imageUris: ['https://cdn.example/p.jpg'],
    concept: 'solo el mural',
    ratio: '720:1280',
    duration: 6,
    audio: true
  });
  assert.equal(custom.userConcept, 'solo el mural');
  assert.equal(custom.audio, true);
  assert.match(ad.previewPayload(bodies[0]), /chars base64/);
  assert.doesNotMatch(ad.previewPayload(bodies[0]), /iVBORw0KGgo/);
});

test('un permalink con attribute_pa_color usa la foto de esa variación', async () => {
  const fetchImpl = async (url) => {
    const u = String(url);
    if (u.includes('?slug=')) {
      return jsonRes([
        {
          id: 232959,
          type: 'variation',
          slug: 'copic-classic',
          parent: 232957,
          name: 'Copic Classic',
          permalink: PARENT.permalink + '?attribute_pa_color=0',
          prices: PARENT.prices,
          images: [{ src: 'https://www.boykot.cl/wp-content/uploads/wrong.jpg' }],
          attributes: [{ name: 'Color', value: '0' }],
          variations: []
        },
        PARENT
      ]);
    }
    if (u.endsWith('/233033')) return jsonRes(VARIATION);
    throw new Error('fetch inesperado ' + u);
  };
  const product = await ad.resolveBoykotProduct(
    'https://www.boykot.cl/tienda/marcadores/copic-classic/?attribute_pa_color=BV00',
    { fetch: fetchImpl }
  );
  assert.equal(product.id, 233033);
  assert.equal(product.priceAmount, 4300);
  assert.equal(product.imageUrls[0], 'https://www.boykot.cl/wp-content/uploads/2026/06/BV00-3.jpg');
  assert.ok(!product.imageUrls.includes(undefined));
});

test('una variación sin foto usa la galería del padre', async () => {
  const bare = { ...VARIATION, images: [], short_description: '' };
  const fetchImpl = async (url) => {
    const u = String(url);
    if (u.includes('?sku=')) return jsonRes([bare]);
    if (u.endsWith('/233033')) return jsonRes(bare);
    if (u.endsWith('/232957')) return jsonRes(PARENT);
    throw new Error('fetch inesperado ' + u);
  };
  const product = await ad.resolveBoykotProduct('MARKER001', { fetch: fetchImpl });
  assert.equal(product.imageUrls.length, 2);
  assert.equal(product.imageUrls[0], PARENT.images[0].src);
});

test('una URL https con HEAD válido se manda tal cual', async () => {
  let gets = 0;
  const fetchImpl = async (url, opts = {}) => {
    if ((opts.method || 'GET') === 'HEAD') {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'image/jpeg', 'content-length': '1200' })
      };
    }
    gets++;
    return { ok: true, status: 200, headers: new Headers(), arrayBuffer: async () => new ArrayBuffer(0) };
  };
  const image = await ad.ensureRunwayImage('https://cdn.example/producto.jpg', { fetch: fetchImpl, dryRun: true });
  assert.equal(image.via, 'url');
  assert.equal(image.uri, 'https://cdn.example/producto.jpg');
  assert.equal(gets, 0);
});

test('Aleph 2.0: 2–30s y ≤30 fps', () => {
  const ok = ad.inspectMp4(fakeMp4({ timescale: 1000, duration: 10000, samples: 240 }));
  assert.ok(Math.abs(ok.durationSec - 10) < 0.01);
  assert.ok(Math.abs(ok.fps - 24) < 0.01);
  assert.equal(ad.checkAlephInput(ok).ok, true);
  assert.equal(ad.checkAlephInput(ad.inspectMp4(fakeMp4({ timescale: 1000, duration: 1000, samples: 24 }))).ok, false);
  assert.equal(ad.checkAlephInput(ad.inspectMp4(fakeMp4({ timescale: 1000, duration: 31000, samples: 744 }))).ok, false);
  assert.equal(ad.checkAlephInput(ad.inspectMp4(fakeMp4({ timescale: 1000, duration: 10000, samples: 600 }))).ok, false);
  assert.equal(ad.checkAlephInput(ad.inspectMp4(fakeMp4({ timescale: 1000, duration: 2000, samples: 60 }))).ok, true);
  assert.equal(ad.checkAlephInput(ad.inspectMp4(fakeMp4({ timescale: 1000, duration: 30000, samples: 900 }))).ok, true);
});

test('poll de tareas: backoff y failureCode', async () => {
  const statuses = ['PENDING', 'THROTTLED', 'RUNNING', 'FAILED'];
  let i = 0;
  const delays = [];
  const fetchImpl = async () => {
    const status = statuses[i++];
    const body = status === 'FAILED'
      ? { id: 'task-1', status, failureCode: 'SAFETY.INPUT', failure: 'input rejected' }
      : { id: 'task-1', status };
    return { ok: true, status: 200, text: async () => JSON.stringify(body) };
  };
  const task = await runway.pollTask('test-key', 'task-1', {
    fetchImpl,
    sleep: async (ms) => { delays.push(ms); },
    maxMs: 60000
  });
  assert.deepEqual(delays, [5000, 7500, 10000, 12500]);
  assert.equal(task.status, 'FAILED');
  assert.match(runway.describeTaskResult(task), /SAFETY\.INPUT/);
  assert.equal(ad.isInProgress('THROTTLED'), true);
  assert.equal(ad.isInProgress('SUCCEEDED'), false);
});

test('/saldo formatea creditBalance y el tier', () => {
  const text = ad.formatOrganization({
    creditBalance: 1200,
    tier: {
      maxMonthlyCreditSpend: 5000,
      models: { gen4_turbo: { maxDuration: 10 }, aleph2: { maxDuration: 30 } }
    }
  });
  assert.match(text, /creditBalance: 1200/);
  assert.match(text, /\$12\.00/);
  assert.match(text, /maxMonthlyCreditSpend\): 5000/);
  assert.match(text, /gen4_turbo/);
  assert.match(text, /aleph2/);
});

test('el bot no loguea la key y /reframe ya no usa gen4_aleph', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'bot.js'), 'utf8');
  assert.doesNotMatch(src, /RUNWAY_KEY prefix/);
  assert.doesNotMatch(src, /model:\s*'gen4_aleph'/);
  assert.match(src, /model: 'aleph2'/);
  assert.match(src, /targetAspectRatio: '16:9'/);
  assert.match(src, /\/v1\/recipes\/product_ad|createProductAd/);
  assert.match(src, /\/saldo/);
});
