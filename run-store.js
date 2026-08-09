// run-store.js — checkpointer casero para las corridas largas del bot.
//
// El problema que resuelve: /post genera 7 imágenes con Grok y 7 clips con
// Runway. Cada paso es una llamada externa que se paga. Si la corrida se caía
// en el clip 5, se perdía TODO lo generado antes y había que volver a pagarlo.
// Además los fallos eran mudos (`if (url)` y a otra cosa), así que el usuario
// veía "Slides: 6" sin saber cuál faltó ni por qué.
//
// Es la idea del checkpointer de LangGraph traída a mano y sin dependencias:
// cada paso se registra con su salida, y una corrida se puede retomar desde
// donde quedó. Un JSON por corrida en disco.
//
// LÍMITE CONOCIDO: en Railway el disco del contenedor es efímero. Las corridas
// sobreviven caídas del proceso dentro del mismo contenedor, pero un redeploy
// las borra. Para que sobrevivan a un redeploy hay que mover DIR a un volumen
// o cambiar el backend por Postgres — la interfaz de abajo no cambiaría.

const fs = require('fs');
const path = require('path');

const DIR = process.env.RUN_STORE_DIR || path.join(__dirname, '.runs');
const MAX_RUNS = 200;

function ensureDir() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
}

function fileFor(id) {
  // El id lo generamos nosotros, pero igual no dejamos que un id raro se
  // escape del directorio.
  return path.join(DIR, path.basename(String(id)) + '.json');
}

function save(run) {
  ensureDir();
  run.updatedAt = new Date().toISOString();
  fs.writeFileSync(fileFor(run.id), JSON.stringify(run, null, 2));
  return run;
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Arranca una corrida nueva. `kind` es el comando (/post, /anime, ...). */
function startRun({ chatId, kind, topic }) {
  prune();
  return save({
    id: newId(),
    chatId: String(chatId),
    kind,
    topic: topic || '',
    status: 'running',
    createdAt: new Date().toISOString(),
    steps: {},
  });
}

function getRun(id) {
  try {
    return JSON.parse(fs.readFileSync(fileFor(id), 'utf8'));
  } catch {
    return null;
  }
}

/** Corridas de un chat, más recientes primero. */
function listRuns(chatId, limit = 10) {
  ensureDir();
  return fs
    .readdirSync(DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); }
      catch { return null; }
    })
    .filter(r => r && String(r.chatId) === String(chatId))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit);
}

/**
 * Ejecuta un paso con checkpoint.
 *
 * Si el paso ya terminó bien en una corrida anterior, devuelve la salida
 * guardada SIN volver a llamar a la API (que es todo el punto). Si falla,
 * registra el error y devuelve null — el llamador decide si sigue o corta,
 * igual que antes, pero ahora queda constancia de cuál falló y por qué.
 */
async function step(run, id, fn) {
  const previo = run.steps[id];
  if (previo && previo.status === 'ok') return previo.output;

  run.steps[id] = { status: 'running', startedAt: new Date().toISOString() };
  save(run);
  try {
    const output = await fn();
    run.steps[id] = { status: 'ok', output, doneAt: new Date().toISOString() };
    save(run);
    return output;
  } catch (e) {
    run.steps[id] = {
      status: 'error',
      error: (e && e.message) || String(e),
      doneAt: new Date().toISOString(),
    };
    save(run);
    return null;
  }
}

/** Marca un paso como fallido aunque no haya lanzado excepción (devolvió null). */
function markEmpty(run, id, motivo) {
  const previo = run.steps[id];
  if (previo && previo.status === 'ok') return;
  run.steps[id] = { status: 'error', error: motivo || 'sin salida', doneAt: new Date().toISOString() };
  save(run);
}

function failedSteps(run) {
  return Object.entries(run.steps)
    .filter(([, s]) => s.status !== 'ok')
    .map(([id, s]) => ({ id, error: s.error || s.status }));
}

function finishRun(run) {
  run.status = failedSteps(run).length ? 'partial' : 'done';
  return save(run);
}

/** Deja el directorio en MAX_RUNS archivos, borrando los más viejos. */
function prune() {
  ensureDir();
  const files = fs
    .readdirSync(DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => ({ f, t: fs.statSync(path.join(DIR, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const { f } of files.slice(MAX_RUNS)) {
    try { fs.unlinkSync(path.join(DIR, f)); } catch { /* ya no está */ }
  }
}

/** Resumen de una línea para /runs. */
function resumen(run) {
  const total = Object.keys(run.steps).length;
  const ok = Object.values(run.steps).filter(s => s.status === 'ok').length;
  const icono = run.status === 'done' ? '✅' : run.status === 'partial' ? '⚠️' : '⏳';
  return `${icono} \`${run.id}\` ${run.kind} — ${ok}/${total} pasos — ${run.topic.slice(0, 40)}`;
}

module.exports = {
  startRun, getRun, listRuns, step, markEmpty,
  failedSteps, finishRun, resumen, DIR,
};
