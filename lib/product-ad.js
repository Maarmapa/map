// Anuncio de producto (/ad) contra el Store API público de boykot.cl y la
// recipe product_ad de Runway.
//
// Fuentes (verificadas al escribir esto, no de memoria):
// - https://docs.dev.runwayml.com/recipes/product-ad/
// - https://docs.dev.runwayml.com/api.md  POST /v1/recipes/product_ad
// - https://docs.dev.runwayml.com/guides/pricing/  (tabla Recipe Pricing)
// - https://docs.dev.runwayml.com/assets/inputs/
//
// product_ad version pinneada: 2026-07 (la versión pública vigente en la doc).
// Precios: $0.01 por crédito.
//   720p: 200 créditos por un video de 4s + 36 por cada segundo adicional
//   1080p: 216 créditos por un video de 4s + 40 por cada segundo adicional
//   mínimo 4s, máximo 15s. La tabla publicada no suma recargo por audio
//   (a diferencia de veo3.1). El estimatedCost que devuelve el POST manda.

const STORE_BASE = 'https://www.boykot.cl/wp-json/wc/store/v1/products';
const PRODUCT_AD_VERSION = '2026-07';
const CREDIT_USD = 0.01;

function usdFromCredits(credits) {
  return Math.round(credits * CREDIT_USD * 100) / 100;
}
const DATA_URI_BINARY_MAX = Math.floor(3.3 * 1024 * 1024);
const IMAGE_URL_MAX = 16 * 1024 * 1024;
const VIDEO_URL_MAX = 32 * 1024 * 1024;
const VIDEO_DATA_URI_BINARY_MAX = Math.floor(12 * 1024 * 1024);
const EPHEMERAL_MAX = 200 * 1024 * 1024;
const EPHEMERAL_MIN = 512;

const IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska']);

const DEFAULT_USER_CONCEPT = [
  'Publicidad para Boykot.cl, tienda de materiales de arte en Chile.',
  'Estética de arte urbano: fondo negro #000000 y acento verde ácido #CCFF00.',
  'El producto es el protagonista, fiel a las fotos de referencia, sin deformarlo.',
  'Cámara lenta, luz de estudio dura, un destello #CCFF00 recorre el material.',
  'Sin texto inventado en pantalla, sin logos ajenos, sin personas reconocibles.',
  'Cierra con el producto centrado y quieto.'
].join(' ');

const AD_USAGE = [
  'Uso: /ad <SKU o URL de boykot.cl> [idea en español]',
  'Genera dos anuncios con Runway product_ad (version 2026-07): 9:16 y 1:1.',
  'Default 10s a 1080p (1080:1920 y 1440:1440).',
  'Flags:',
  '  --dry     muestra producto, fotos y el payload. No gasta créditos.',
  '  --dur N   duración en segundos, entero de 4 a 15 (default 10).',
  '  --720     720p (720:1280 y 960:960), más barato.',
  '  --audio   pide audio. La tabla publicada de product_ad no le pone recargo;',
  '            el POST igual devuelve estimatedCost y ese número es el que vale.',
  'Ejemplos:',
  '  /ad MARKER001 --dry',
  '  /ad https://www.boykot.cl/tienda/.../copic-classic/?attribute_pa_color=bv00 mural --dur 6'
].join('\n');

function productAdRatios(lowRes) {
  if (lowRes) {
    return [
      { label: '9:16', ratio: '720:1280', tier: '720p' },
      { label: '1:1', ratio: '960:960', tier: '720p' }
    ];
  }
  return [
    { label: '9:16', ratio: '1080:1920', tier: '1080p' },
    { label: '1:1', ratio: '1440:1440', tier: '1080p' }
  ];
}

function productAdCredits(tier, seconds) {
  const table = {
    '720p': { base: 200, extra: 36 },
    '1080p': { base: 216, extra: 40 }
  };
  const row = table[tier];
  if (!row) throw new Error('tier desconocido: ' + tier);
  if (!Number.isInteger(seconds) || seconds < 4 || seconds > 15) {
    throw new Error('duración fuera de 4–15: ' + seconds);
  }
  return row.base + row.extra * (seconds - 4);
}

function planProductAd({ duration, lowRes, audio }) {
  const ratios = productAdRatios(!!lowRes);
  const lines = ratios.map(r => {
    const credits = productAdCredits(r.tier, duration);
    return { ...r, credits, usd: usdFromCredits(credits) };
  });
  const credits = lines.reduce((sum, line) => sum + line.credits, 0);
  return { lines, credits, usd: usdFromCredits(credits), duration, audio: !!audio };
}

function formatCostPlan(plan) {
  const lines = plan.lines.map(line =>
    '• ' + line.label + ' ' + line.ratio + ' (' + line.tier + ') · ' + plan.duration + 's · ' +
    line.credits + ' créditos · $' + line.usd.toFixed(2)
  );
  return [
    'Costo estimado product_ad (docs.dev.runwayml.com/guides/pricing, $0.01 por crédito).',
    '720p: 200 créditos a los 4s + 36 por segundo extra. 1080p: 216 + 40.',
    '1080:1920 y 1440:1440 se estiman como 1080p; 720:1280 y 960:960 como 720p.',
    ...lines,
    'Total: ' + plan.credits + ' créditos · $' + plan.usd.toFixed(2) + ' (dos videos).',
    plan.audio
      ? 'Audio: sí. La tabla publicada de product_ad no lista recargo por audio; al crear la tarea, estimatedCost es el número que vale.'
      : 'Audio: no.'
  ].join('\n');
}

function parseAdArgs(text) {
  let raw = String(text || '').trim().replace(/^\/ad(?:@\w+)?/i, '').trim();
  if (!raw || raw === 'help' || raw === '--help') return { error: null, usage: true };

  let duration = 10;
  let lowRes = false;
  let audio = false;
  let dry = false;
  const errors = [];

  raw = raw.replace(/--dur(?:=|\s+)(\S+)/gi, (_, value) => {
    if (!/^\d+$/.test(value)) errors.push('--dur tiene que ser un entero de 4 a 15 (recibido ' + value + ').');
    else {
      const n = Number(value);
      if (n < 4 || n > 15) errors.push('--dur fuera de rango: product_ad acepta 4–15 segundos (recibido ' + n + ').');
      else duration = n;
    }
    return ' ';
  });
  if (/--dur\b/i.test(raw)) errors.push('--dur necesita un número, por ejemplo --dur 6.');
  raw = raw.replace(/--dur\b/gi, ' ');
  if (/--720\b/.test(raw)) lowRes = true;
  if (/--audio\b/i.test(raw)) audio = true;
  if (/--dry\b/i.test(raw)) dry = true;
  raw = raw.replace(/--720\b|--audio\b|--dry\b/gi, ' ').replace(/\s+/g, ' ').trim();

  if (errors.length) return { error: errors.join('\n') };
  if (!raw) return { error: AD_USAGE };

  const parts = raw.split(' ');
  const query = parts[0];
  const concept = parts.slice(1).join(' ').trim();
  return { error: null, query, concept: concept || null, duration, lowRes, audio, dry };
}

function htmlToText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function amountFromPrices(prices) {
  if (!prices || prices.price == null || prices.price === '') return null;
  const minor = Number(prices.currency_minor_unit || 0);
  const raw = Number(prices.price);
  if (!Number.isFinite(raw)) return null;
  return raw / Math.pow(10, minor);
}

function formatClp(amount) {
  const n = Math.round(Number(amount) || 0);
  const body = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (n < 0 ? '-$' : '$') + body;
}

function buildProductInfo(product) {
  const lines = [product.name];
  if (product.priceAmount != null) lines.push('Precio: ' + formatClp(product.priceAmount) + ' CLP');
  if (product.variationLabel) lines.push(product.variationLabel);
  if (product.features) lines.push(product.features);
  return lines.join('\n').slice(0, 2500);
}

function buildProductAdBody({ product, imageUris, concept, ratio, duration, audio }) {
  const userConcept = (concept && String(concept).trim()) || DEFAULT_USER_CONCEPT;
  return {
    version: PRODUCT_AD_VERSION,
    productImages: imageUris.slice(0, 4).map(uri => ({ uri })),
    productInfo: buildProductInfo(product),
    userConcept: userConcept.slice(0, 3500),
    ratio,
    duration,
    audio: !!audio
  };
}

function previewPayload(body) {
  const clone = JSON.parse(JSON.stringify(body));
  for (const img of clone.productImages || []) {
    if (typeof img.uri === 'string' && img.uri.startsWith('data:')) {
      const comma = img.uri.indexOf(',');
      const head = img.uri.slice(0, comma);
      const b64 = img.uri.slice(comma + 1);
      img.uri = head + ',<' + b64.length + ' chars base64>';
    }
  }
  return JSON.stringify(clone, null, 2);
}

function absUrl(src) {
  if (!src) return null;
  if (/^https:\/\//i.test(src)) return src;
  if (src.startsWith('//')) return 'https:' + src;
  if (src.startsWith('/')) return 'https://www.boykot.cl' + src;
  return null;
}

function normalizeToken(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '-');
}

function variationMatches(variation, wantedValues) {
  const have = (variation.attributes || []).map(a => normalizeToken(a.value));
  return wantedValues.every(w => have.includes(w));
}

function imageSrcs(product) {
  return (product.images || []).map(img => absUrl(img && (img.src || img))).filter(Boolean);
}

function parseProductRef(token) {
  let url;
  try { url = new URL(token); } catch { return { kind: 'sku', sku: token }; }
  const host = url.hostname.toLowerCase();
  if (host !== 'boykot.cl' && host !== 'www.boykot.cl') {
    throw new Error('La URL tiene que ser de boykot.cl. Recibí ' + url.hostname + '.');
  }
  const parts = url.pathname.split('/').filter(Boolean);
  const slug = parts[parts.length - 1];
  if (!slug) throw new Error('La URL no trae slug de producto.');
  const attrs = {};
  for (const [key, value] of url.searchParams) {
    if (key.startsWith('attribute_') && value) attrs[key] = value;
  }
  return { kind: 'url', slug, attrs, href: url.href };
}

async function getJson(fetchImpl, url) {
  const res = await fetchImpl(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'maarmapa-bot' },
    signal: AbortSignal.timeout(25000)
  });
  if (!res.ok) throw new Error('WooCommerce respondió ' + res.status + ' en ' + url.replace(/\?.*/, ''));
  return res.json();
}

function asList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.products)) return data.products;
  return [];
}

function pickFeatures(product, parent) {
  const own = htmlToText(product.short_description) || htmlToText(product.description);
  if (own) return own.slice(0, 800);
  if (parent) {
    const fromParent = htmlToText(parent.short_description) || htmlToText(parent.description);
    if (fromParent) return fromParent.slice(0, 800);
  }
  return '';
}

function variationLabel(variation, attrs) {
  if (typeof variation.variation === 'string' && variation.variation.trim()) return variation.variation.trim();
  const fromApi = (variation.attributes || [])
    .filter(a => a && a.value)
    .map(a => (a.name ? a.name + ': ' : '') + a.value);
  if (fromApi.length) return fromApi.join(', ');
  const fromQuery = Object.entries(attrs || {}).map(([key, value]) => key.replace(/^attribute_/, '') + '=' + value);
  return fromQuery.join(', ');
}

function shapeProduct(product, parent, attrs) {
  const priceAmount = amountFromPrices(product.prices) ?? (parent ? amountFromPrices(parent.prices) : null);
  const ownImages = imageSrcs(product);
  const parentImages = parent ? imageSrcs(parent) : [];
  // Si la variación tiene foto propia, no se rellena con la galería del padre:
  // en Boykot esa galería a veces es el set, no el color.
  const source = ownImages.length ? ownImages : parentImages;
  const imageUrls = [];
  for (const src of source) {
    if (!imageUrls.includes(src)) imageUrls.push(src);
    if (imageUrls.length === 4) break;
  }
  return {
    id: product.id,
    parentId: product.parent || (parent && parent.id) || null,
    name: product.name || (parent && parent.name) || 'Producto Boykot',
    sku: product.sku || '',
    slug: product.slug || (parent && parent.slug) || '',
    permalink: product.permalink || (parent && parent.permalink) || 'https://www.boykot.cl/',
    type: product.type || '',
    priceAmount,
    priceLabel: priceAmount == null ? null : formatClp(priceAmount) + ' CLP',
    features: pickFeatures(product, parent),
    variationLabel: product.type === 'variation' || (attrs && Object.keys(attrs).length)
      ? variationLabel(product, attrs)
      : '',
    imageUrls
  };
}

async function resolveBoykotProduct(token, deps = {}) {
  const fetchImpl = deps.fetch || fetch;
  const ref = parseProductRef(String(token || '').trim());

  if (ref.kind === 'url') {
    const found = asList(await getJson(fetchImpl, STORE_BASE + '?slug=' + encodeURIComponent(ref.slug) + '&per_page=20'));
    const sameSlug = found.filter(p => p.slug === ref.slug);
    const pool = sameSlug.length ? sameSlug : found;
    if (!pool.length) throw new Error('No encontré el slug ' + ref.slug + ' en el catálogo público.');
    const wanted = Object.values(ref.attrs).map(normalizeToken).filter(Boolean);
    // El slug también matchea variaciones sueltas. El padre es el que trae la lista.
    const parent = pool.find(p => p.type !== 'variation') || pool.find(p => (p.variations || []).length) || pool[0];
    if (!wanted.length) {
      const shaped = shapeProduct(parent, null, null);
      if (!shaped.imageUrls.length) throw new Error(shaped.name + ' no tiene imágenes en el Store API.');
      return shaped;
    }
    const direct = pool.find(p => p.type === 'variation' && variationMatches(p, wanted));
    const matches = direct ? [direct] : (parent.variations || []).filter(v => variationMatches(v, wanted));
    if (!matches.length) {
      const sample = (parent.variations || []).slice(0, 8).map(v => (v.attributes || []).map(a => a.value).join('/')).filter(Boolean);
      throw new Error('Ninguna variación de ' + parent.name + ' coincide con ' + wanted.join(', ') +
        (sample.length ? '. Vi: ' + sample.join(', ') : '.'));
    }
    const variation = await getJson(fetchImpl, STORE_BASE + '/' + matches[0].id);
    const shaped = shapeProduct(variation, parent, ref.attrs);
    if (!shaped.imageUrls.length) throw new Error(shaped.name + ' no tiene imagen de esa variación.');
    return shaped;
  }

  const bySku = asList(await getJson(fetchImpl, STORE_BASE + '?sku=' + encodeURIComponent(ref.sku)));
  let product = bySku.find(p => normalizeToken(p.sku) === normalizeToken(ref.sku)) || bySku[0];
  if (!product) {
    const searched = asList(await getJson(fetchImpl, STORE_BASE + '?search=' + encodeURIComponent(ref.sku) + '&per_page=10'));
    product = searched.find(p => normalizeToken(p.sku) === normalizeToken(ref.sku))
      || searched.find(p => normalizeToken(p.slug) === normalizeToken(ref.sku))
      || searched.find(p => normalizeToken(p.name) === normalizeToken(ref.sku))
      || searched[0];
  }
  if (!product) throw new Error('No encontré "' + ref.sku + '" en el catálogo público de boykot.cl.');
  if (product.id && imageSrcs(product).length === 0) {
    product = await getJson(fetchImpl, STORE_BASE + '/' + product.id);
  }

  let parent = null;
  if (product.type === 'variation' && product.parent) {
    parent = await getJson(fetchImpl, STORE_BASE + '/' + product.parent);
  }
  const shaped = shapeProduct(product, parent, null);
  if (!shaped.imageUrls.length) throw new Error(shaped.name + ' no tiene imágenes en el Store API.');
  return shaped;
}

function formatOrganization(org) {
  if (!org || typeof org.creditBalance !== 'number') {
    throw new Error('GET /v1/organization no trajo creditBalance.');
  }
  const usd = (org.creditBalance * CREDIT_USD).toFixed(2);
  const max = org.tier && org.tier.maxMonthlyCreditSpend;
  const models = (org.tier && org.tier.models && typeof org.tier.models === 'object') ? org.tier.models : null;
  const names = models ? Object.keys(models) : [];
  const lines = [
    'Saldo Runway',
    'creditBalance: ' + org.creditBalance + ' créditos (≈ $' + usd + ' a $0.01 por crédito)'
  ];
  if (max != null) lines.push('Tope de compra mensual del tier (maxMonthlyCreditSpend): ' + max + ' créditos');
  if (names.length) {
    lines.push('Límites por modelo en el tier (' + names.length + '):');
    for (const name of names.slice(0, 15)) {
      const lim = models[name];
      const brief = lim && typeof lim === 'object' ? JSON.stringify(lim) : String(lim);
      lines.push('• ' + name + ': ' + brief.slice(0, 180));
    }
    if (names.length > 15) lines.push('… y ' + (names.length - 15) + ' más');
  } else {
    lines.push('El tier no trajo límites por modelo.');
  }
  return lines.join('\n');
}

function gen4TurboDuration(duration) {
  const value = duration == null ? 5 : duration;
  if (!Number.isInteger(value) || value < 2 || value > 10) {
    return { error: 'gen4_turbo acepta duración entera de 2 a 10 segundos (recibido ' + duration + '). 3s es válido.' };
  }
  return { duration: value };
}

function checkAlephInput({ durationSec, fps }) {
  if (durationSec == null || !Number.isFinite(durationSec)) {
    return { ok: false, error: 'No pude leer la duración del video. Aleph 2.0 exige entre 2 y 30 segundos y 30 fps o menos. No lo envié.' };
  }
  if (durationSec < 1.95 || durationSec > 30.05) {
    return { ok: false, error: 'El video dura ' + durationSec.toFixed(2) + 's. Aleph 2.0 acepta de 2 a 30 segundos. No lo envié.' };
  }
  if (fps == null || !Number.isFinite(fps)) {
    return { ok: false, error: 'No pude leer los fps. Aleph 2.0 exige 30 fps o menos. No lo envié.' };
  }
  if (fps > 30.05) {
    return { ok: false, error: 'El video va a ' + fps.toFixed(2) + ' fps. Aleph 2.0 acepta 30 fps o menos. No lo envié.' };
  }
  return { ok: true, durationSec, fps };
}

const CONTAINER_BOXES = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts']);

function readBoxes(buf, start, end) {
  const boxes = [];
  let offset = start;
  while (offset + 8 <= end) {
    let size = buf.readUInt32BE(offset);
    const type = buf.toString('latin1', offset + 4, offset + 8);
    let header = 8;
    if (size === 1) {
      if (offset + 16 > end) break;
      size = Number(buf.readBigUInt64BE(offset + 8));
      header = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (!Number.isFinite(size) || size < header || offset + size > end) break;
    boxes.push({ type, start: offset + header, end: offset + size });
    offset += size;
  }
  return boxes;
}

function findBoxes(buf, start, end, type) {
  const found = [];
  for (const box of readBoxes(buf, start, end)) {
    if (box.type === type) found.push(box);
    if (CONTAINER_BOXES.has(box.type)) found.push(...findBoxes(buf, box.start, box.end, type));
  }
  return found;
}

function parseMediaHeader(buf, start) {
  const version = buf[start];
  if (version === 1) {
    if (start + 32 > buf.length) return null;
    return {
      timescale: buf.readUInt32BE(start + 20),
      duration: Number(buf.readBigUInt64BE(start + 24))
    };
  }
  if (start + 20 > buf.length) return null;
  return {
    timescale: buf.readUInt32BE(start + 12),
    duration: buf.readUInt32BE(start + 16)
  };
}

function parseStts(buf, start, end) {
  if (start + 8 > end) return 0;
  const count = buf.readUInt32BE(start + 4);
  let total = 0;
  let offset = start + 8;
  for (let i = 0; i < count && offset + 8 <= end; i++) {
    total += buf.readUInt32BE(offset);
    offset += 8;
  }
  return total;
}

function inspectMp4(buf) {
  const data = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  const mvhd = findBoxes(data, 0, data.length, 'mvhd')[0];
  const movie = mvhd ? parseMediaHeader(data, mvhd.start) : null;
  const traks = findBoxes(data, 0, data.length, 'trak');
  let fps = null;
  let trackDuration = null;
  for (const trak of traks) {
    const hdlr = findBoxes(data, trak.start, trak.end, 'hdlr')[0];
    if (!hdlr || hdlr.start + 12 > hdlr.end) continue;
    const handler = data.toString('latin1', hdlr.start + 8, hdlr.start + 12);
    if (handler !== 'vide') continue;
    const mdhdBox = findBoxes(data, trak.start, trak.end, 'mdhd')[0];
    const sttsBox = findBoxes(data, trak.start, trak.end, 'stts')[0];
    if (!mdhdBox) continue;
    const mdhd = parseMediaHeader(data, mdhdBox.start);
    if (!mdhd || !mdhd.timescale) continue;
    const seconds = mdhd.duration / mdhd.timescale;
    const samples = sttsBox ? parseStts(data, sttsBox.start, sttsBox.end) : 0;
    if (seconds > 0 && samples > 0) {
      fps = samples / seconds;
      trackDuration = seconds;
      break;
    }
  }
  const durationSec = movie && movie.timescale
    ? movie.duration / movie.timescale
    : trackDuration;
  return { durationSec: durationSec ?? null, fps };
}

function imageDimensions(buf) {
  const data = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  if (data.length >= 24 && data[0] === 0x89 && data.toString('latin1', 1, 4) === 'PNG') {
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  }
  if (data.length > 4 && data[0] === 0xff && data[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < data.length) {
      if (data[offset] !== 0xff) { offset++; continue; }
      const marker = data[offset + 1];
      if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
      const size = data.readUInt16BE(offset + 2);
      if (size < 2) break;
      const sof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (sof && offset + 9 < data.length) {
        return { height: data.readUInt16BE(offset + 5), width: data.readUInt16BE(offset + 7) };
      }
      offset += 2 + size;
    }
  }
  return null;
}

function gen4AspectOk(width, height) {
  if (!width || !height) return true;
  const ratio = width / height;
  return ratio >= 0.5 && ratio <= 2.358;
}

function sniffImage(buf, claimed) {
  const data = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  if (data.length >= 8 && data[0] === 0x89 && data.toString('latin1', 1, 4) === 'PNG') return 'image/png';
  if (data.length >= 12 && data.toString('latin1', 0, 4) === 'RIFF' && data.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  const ct = String(claimed || '').split(';')[0].trim().toLowerCase();
  if (IMAGE_TYPES.has(ct)) return ct === 'image/jpg' ? 'image/jpeg' : ct;
  return null;
}

function extFor(contentType) {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'video/webm') return 'webm';
  if (contentType === 'video/quicktime') return 'mov';
  if (String(contentType).startsWith('video/')) return 'mp4';
  return 'jpg';
}

function toDataUri(bytes, contentType) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const mime = contentType === 'image/jpg' ? 'image/jpeg' : contentType;
  return 'data:' + mime + ';base64,' + buf.toString('base64');
}

function headerMap(res) {
  if (!res || !res.headers) return new Headers();
  if (typeof res.headers.get === 'function') return res.headers;
  return new Headers(res.headers);
}

async function probeUrl(url, fetchImpl, kind) {
  let parsed;
  try { parsed = new URL(url); } catch { return { ok: false, reason: 'URL inválida' }; }
  if (parsed.protocol !== 'https:') return { ok: false, reason: 'Runway exige HTTPS' };
  if (netIsIp(parsed.hostname)) return { ok: false, reason: 'el hostname no puede ser una IP' };
  if (url.length > 2048) return { ok: false, reason: 'la URL supera 2048 caracteres' };
  let res;
  try {
    res = await fetchImpl(url, {
      method: 'HEAD',
      redirect: 'manual',
      headers: { 'User-Agent': 'RunwayML API/maarmapa' },
      signal: AbortSignal.timeout(15000)
    });
  } catch (e) {
    return { ok: false, reason: 'HEAD falló: ' + e.message };
  }
  const status = res.status || 0;
  if (status >= 300 && status < 400) return { ok: false, reason: 'redirect ' + status + ' (Runway no sigue redirects)' };
  if (status < 200 || status >= 300) return { ok: false, reason: 'HEAD ' + status };
  const headers = headerMap(res);
  const contentType = (headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const allowed = kind === 'video' ? VIDEO_TYPES : IMAGE_TYPES;
  if (!allowed.has(contentType)) {
    return { ok: false, reason: 'Content-Type ' + (contentType || 'ausente') + ' no sirve para Runway' };
  }
  const length = Number(headers.get('content-length') || 0);
  const max = kind === 'video' ? VIDEO_URL_MAX : IMAGE_URL_MAX;
  if (length && length > max) return { ok: false, reason: 'pesa ' + length + ' bytes, sobre el límite de URL (' + max + ')' };
  return { ok: true, contentType, length };
}

function netIsIp(hostname) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return true;
  if (hostname.includes(':')) return true;
  return false;
}

async function downloadBytes(url, fetchImpl, { maxBytes, referer }) {
  const res = await fetchImpl(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; maarmapa-bot)',
      'Accept': '*/*',
      'Referer': referer || 'https://www.boykot.cl/'
    },
    signal: AbortSignal.timeout(60000)
  });
  if (!res.ok) {
    const err = new Error('descarga ' + res.status + ' de ' + url);
    err.status = res.status;
    throw err;
  }
  const headers = headerMap(res);
  const claimed = headers.get('content-type') || '';
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 32) throw new Error('la descarga pesa ' + buf.length + ' bytes');
  if (buf.length > maxBytes) throw new Error('la descarga pesa ' + buf.length + ' bytes, sobre ' + maxBytes);
  const head = buf.slice(0, 20).toString('utf8').toLowerCase();
  if (head.includes('<html') || head.includes('<!doctype')) {
    throw new Error('la URL devolvió HTML, no el archivo (¿403/hotlink?)');
  }
  return { bytes: buf, claimed };
}

async function ensureRunwayImage(url, opts = {}) {
  const fetchImpl = opts.fetch || fetch;
  const probe = await probeUrl(url, fetchImpl, 'image');
  if (probe.ok) return { uri: url, via: 'url', contentType: probe.contentType };

  let file;
  try {
    file = await downloadBytes(url, fetchImpl, { maxBytes: IMAGE_URL_MAX, referer: 'https://www.boykot.cl/' });
  } catch (e) {
    throw new Error('La imagen no le sirve a Runway (' + probe.reason + ') y no pude descargarla para re-subirla: ' + e.message);
  }
  const contentType = sniffImage(file.bytes, file.claimed);
  if (!contentType) {
    throw new Error('La imagen no le sirve a Runway (' + probe.reason + ') y lo descargado no es JPEG, PNG ni WebP.');
  }
  const dims = imageDimensions(file.bytes);
  if (opts.checkGen4Aspect && dims && !gen4AspectOk(dims.width, dims.height)) {
    throw new Error('gen4_turbo exige aspect ratio entre 0.5 y 2.358 (ancho/alto). Esta imagen es ' + dims.width + '×' + dims.height + '.');
  }
  if (file.bytes.length <= DATA_URI_BINARY_MAX) {
    return { uri: toDataUri(file.bytes, contentType), via: 'data-uri', contentType, bytes: file.bytes.length };
  }
  if (file.bytes.length > EPHEMERAL_MAX) throw new Error('la imagen pesa ' + file.bytes.length + ' bytes, sobre el máximo de upload efímero');
  if (opts.dryRun || !opts.uploadEphemeral) {
    return {
      via: 'ephemeral-needed',
      contentType,
      bytes: file.bytes.length,
      filename: 'product.' + extFor(contentType),
      reason: probe.reason
    };
  }
  const runwayUri = await opts.uploadEphemeral(file.bytes, 'product.' + extFor(contentType), contentType);
  return { uri: runwayUri, via: 'ephemeral', contentType, bytes: file.bytes.length };
}

async function prepareVideoForAleph(url, opts = {}) {
  const fetchImpl = opts.fetch || fetch;
  const probe = await probeUrl(url, fetchImpl, 'video');
  let file;
  try {
    file = await downloadBytes(url, fetchImpl, { maxBytes: 80 * 1024 * 1024, referer: url });
  } catch (e) {
    throw new Error('No pude bajar el video para medir duración y fps (Aleph 2.0: 2–30s, ≤30 fps). ' + e.message);
  }
  const info = inspectMp4(file.bytes);
  const verdict = checkAlephInput(info);
  if (!verdict.ok) {
    const err = new Error(verdict.error);
    err.media = info;
    throw err;
  }
  if (probe.ok && (!probe.length || probe.length <= VIDEO_URL_MAX)) {
    return { uri: url, via: 'url', info };
  }
  if (file.bytes.length <= VIDEO_DATA_URI_BINARY_MAX) {
    return { uri: toDataUri(file.bytes, 'video/mp4'), via: 'data-uri', info };
  }
  if (!opts.uploadEphemeral) {
    throw new Error('El video no pasa como URL (' + (probe.reason || 'tamaño') + ') y pesa ' + file.bytes.length + ' bytes. Hace falta un upload efímero y no hay RUNWAY_KEY.');
  }
  const runwayUri = await opts.uploadEphemeral(file.bytes, 'reframe.mp4', 'video/mp4');
  return { uri: runwayUri, via: 'ephemeral', info };
}

function redact(text) {
  return String(text || '')
    .replace(/Bearer\s+\S+/gi, 'Bearer <redacted>')
    .replace(/key_[A-Za-z0-9_\-]{8,}/g, '<redacted>')
    .replace(/sk-[A-Za-z0-9_\-]{8,}/g, '<redacted>');
}

function isInProgress(status) {
  return status === 'PENDING' || status === 'THROTTLED' || status === 'RUNNING';
}

function nextPollDelay(previous) {
  if (!previous) return 5000;
  return Math.min(20000, previous + 2500);
}

function taskFailureText(task) {
  const code = task && task.failureCode ? String(task.failureCode) : 'sin failureCode';
  const why = task && task.failure ? redact(task.failure).slice(0, 300) : '';
  return 'FAILED failureCode=' + code + (why ? ' — ' + why : '');
}

module.exports = {
  STORE_BASE,
  PRODUCT_AD_VERSION,
  CREDIT_USD,
  DATA_URI_BINARY_MAX,
  DEFAULT_USER_CONCEPT,
  AD_USAGE,
  productAdRatios,
  productAdCredits,
  planProductAd,
  formatCostPlan,
  parseAdArgs,
  htmlToText,
  formatClp,
  amountFromPrices,
  buildProductInfo,
  buildProductAdBody,
  previewPayload,
  parseProductRef,
  resolveBoykotProduct,
  formatOrganization,
  gen4TurboDuration,
  checkAlephInput,
  inspectMp4,
  imageDimensions,
  gen4AspectOk,
  sniffImage,
  toDataUri,
  probeUrl,
  ensureRunwayImage,
  prepareVideoForAleph,
  redact,
  isInProgress,
  nextPollDelay,
  taskFailureText
};
