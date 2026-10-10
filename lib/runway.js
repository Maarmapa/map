// Cliente mínimo del API de Runway Dev. La key entra por argumento y no se loguea.
// Header de versión: X-Runway-Version: 2024-11-06 (el que documenta el cURL de product_ad).

const { redact, isInProgress, nextPollDelay, taskFailureText } = require('./product-ad');

const RUNWAY_API = 'https://api.dev.runwayml.com';
const RUNWAY_VERSION = '2024-11-06';

function runwayHeaders(key) {
  return {
    'Authorization': 'Bearer ' + key,
    'X-Runway-Version': RUNWAY_VERSION,
    'Content-Type': 'application/json'
  };
}

async function runwayJson(key, path, { method = 'GET', body, fetchImpl = fetch, timeoutMs = 60000 } = {}) {
  if (!key) throw new Error('RUNWAY_KEY no configurada');
  const res = await fetchImpl(RUNWAY_API + path, {
    method,
    headers: runwayHeaders(key),
    body: body == null ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs)
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || text || res.statusText || 'error';
    throw new Error('Runway ' + res.status + ' ' + path + ': ' + redact(msg).slice(0, 400));
  }
  return data || {};
}

async function getOrganization(key, fetchImpl) {
  return runwayJson(key, '/v1/organization', { fetchImpl });
}

async function createProductAd(key, body, fetchImpl) {
  return runwayJson(key, '/v1/recipes/product_ad', { method: 'POST', body, fetchImpl, timeoutMs: 120000 });
}

async function createVideoToVideo(key, body, fetchImpl) {
  return runwayJson(key, '/v1/video_to_video', { method: 'POST', body, fetchImpl, timeoutMs: 120000 });
}

async function createImageToVideo(key, body, fetchImpl) {
  return runwayJson(key, '/v1/image_to_video', { method: 'POST', body, fetchImpl, timeoutMs: 120000 });
}

async function getTask(key, id, fetchImpl) {
  return runwayJson(key, '/v1/tasks/' + id, { fetchImpl });
}

async function uploadEphemeral(key, bytes, filename, contentType, fetchImpl = fetch) {
  const created = await runwayJson(key, '/v1/uploads', {
    method: 'POST',
    body: { filename, type: 'ephemeral' },
    fetchImpl
  });
  if (!created.uploadUrl || !created.runwayUri) {
    throw new Error('POST /v1/uploads no devolvió uploadUrl y runwayUri');
  }
  const form = new FormData();
  for (const [name, value] of Object.entries(created.fields || {})) {
    form.append(name, value == null ? '' : String(value));
  }
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  form.append('file', new Blob([buf], { type: contentType || 'application/octet-stream' }), filename);
  const up = await fetchImpl(created.uploadUrl, { method: 'POST', body: form, signal: AbortSignal.timeout(120000) });
  if (!up.ok) {
    const text = await up.text();
    throw new Error('upload efímero ' + up.status + ': ' + redact(text).slice(0, 200) + '. No reintento la misma URL; hay que pedir otro POST /v1/uploads.');
  }
  return created.runwayUri;
}

async function pollTask(key, id, opts = {}) {
  const fetchImpl = opts.fetchImpl || fetch;
  const sleep = opts.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const maxMs = opts.maxMs || 20 * 60 * 1000;
  const started = Date.now();
  let delay = null;
  let last = null;
  while (Date.now() - started < maxMs) {
    delay = nextPollDelay(delay);
    await sleep(delay);
    last = await getTask(key, id, fetchImpl);
    if (opts.onStatus) await opts.onStatus(last, delay);
    if (!isInProgress(last.status)) return last;
  }
  return { id, status: 'TIMEOUT', failureCode: 'TIMEOUT', failure: 'seguía en ' + (last && last.status) };
}

function describeTaskResult(task) {
  if (!task) return 'sin respuesta';
  if (task.status === 'SUCCEEDED') return 'SUCCEEDED';
  if (task.status === 'FAILED' || task.status === 'CANCELLED') return task.status + ' ' + taskFailureText(task);
  if (task.status === 'TIMEOUT') return taskFailureText(task);
  return String(task.status || 'desconocido');
}

module.exports = {
  RUNWAY_API,
  RUNWAY_VERSION,
  getOrganization,
  createProductAd,
  createVideoToVideo,
  createImageToVideo,
  getTask,
  uploadEphemeral,
  pollTask,
  describeTaskResult
};
