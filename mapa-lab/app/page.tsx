'use client';
// Mapa Lab — la web ES el chat. Cada chat es un usuario, un carro.
// Look estilo ChatGPT: columna centrada, asistente en texto plano, user en
// burbuja, chips de sugerencia, indicador de escritura, composer flotante.
import { useEffect, useRef, useState } from 'react';

type Card = { slug: string; titulo: string; tecnica: string; medidas: string; anio: number; estado: string; img: string; precio: string; precio_usd?: string };
type Msg = { role: 'user' | 'assistant'; content: string; cards?: Card[] };

const ipfs = (u: string) => u.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${u.slice(7)}` : u;

const SUGERENCIAS = [
  'Muéstrame todas las obras',
  '¿Cuál es la pieza más grande?',
  '¿Tienen precios en dólares?',
  'Cuéntame de Pachamama Fruits',
];

export default function Chat() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const hidratado = useRef(false);

  // La conversación ES el carro: sobrevive refresh, navegación y cierres.
  useEffect(() => {
    try {
      const guardado = localStorage.getItem('mapalab.chat');
      if (guardado) { const j = JSON.parse(guardado); if (Array.isArray(j) && j.length) setMsgs(j); }
      if (!localStorage.getItem('mapalab.chatId')) localStorage.setItem('mapalab.chatId', crypto.randomUUID());
    } catch { /* incógnito estricto: seguimos en memoria */ }
    hidratado.current = true;
  }, []);
  useEffect(() => {
    if (!hidratado.current) return;
    try { localStorage.setItem('mapalab.chat', JSON.stringify(msgs.slice(-60))); } catch { /* lleno */ }
    scroller.current?.scrollTo({ top: 9e9, behavior: 'smooth' });
  }, [msgs]);

  async function enviar(textoDirecto?: string) {
    const texto = (textoDirecto ?? input).trim();
    if (!texto || busy) return;
    setInput(''); setBusy(true);
    const historia: Msg[] = [...msgs, { role: 'user', content: texto }];
    setMsgs([...historia, { role: 'assistant', content: '' }]);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: historia.map(({ role, content }) => ({ role, content })) }),
      });
      if (!res.ok || !res.body) throw new Error('api');
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const ev = JSON.parse(line.slice(6));
          setMsgs(cur => {
            const out = [...cur]; const last = { ...out[out.length - 1] };
            if (ev.type === 'text') last.content += ev.delta;
            if (ev.type === 'cards') last.cards = ev.cards;
            out[out.length - 1] = last; return out;
          });
        }
      }
    } catch {
      setInput(texto); // lo escrito NUNCA se pierde: vuelve al input listo para reenviar
      setMsgs(cur => [...cur.slice(0, -2), { role: 'assistant', content: 'Se cortó la conexión — tu mensaje quedó abajo, dale enviar de nuevo.' }]);
    }
    setBusy(false);
  }

  const vacio = msgs.length === 0;

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#0d0d10' }}>
      <style>{`
        @keyframes pulso { 0%,80%,100% { opacity:.25 } 40% { opacity:1 } }
        .dot { display:inline-block; width:6px; height:6px; border-radius:50%; background:#8a8794; margin-right:4px; animation:pulso 1.2s infinite }
        .dot:nth-child(2){ animation-delay:.2s } .dot:nth-child(3){ animation-delay:.4s }
        .chip:hover { border-color:#e91e63 !important; color:#f2f0ea !important }
        .cardobra:hover { transform:translateY(-2px); border-color:#e91e63 !important }
        textarea:focus, input:focus { outline:none }
        * { box-sizing:border-box }
      `}</style>

      <header style={{ padding: '14px 20px', borderBottom: '1px solid #1c1c22', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#e91e63,#7c3aed)', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 14, color: '#fff' }}>m</div>
        <div>
          <b style={{ fontSize: 15 }}>mapa lab</b>
          <div style={{ color: '#8a8794', fontSize: 11.5 }}>estudio de map · maarmapa.eth</div>
        </div>
      </header>

      <div ref={scroller} style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 18px 20px', display: 'flex', flexDirection: 'column', gap: 22 }}>

          {vacio && (
            <div style={{ textAlign: 'center', marginTop: '14vh' }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px', background: 'linear-gradient(135deg,#e91e63,#7c3aed)', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 26, color: '#fff' }}>m</div>
              <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 6px' }}>¿En qué te puedo ayudar?</h1>
              <p style={{ color: '#8a8794', fontSize: 14, margin: '0 0 26px' }}>Este es el estudio de map. Pregunta por las obras — la conversación es tu carrito.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {SUGERENCIAS.map(s => (
                  <button key={s} className="chip" onClick={() => enviar(s)}
                    style={{ background: 'transparent', border: '1px solid #2a2a32', color: '#b9b6c0', borderRadius: 999, padding: '9px 15px', fontSize: 13.5, cursor: 'pointer', transition: 'all .15s' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {msgs.map((m, i) => m.role === 'user' ? (
            <div key={i} style={{ alignSelf: 'flex-end', maxWidth: '78%', background: '#26262e', borderRadius: '18px 18px 4px 18px', padding: '11px 15px', fontSize: 15, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
              {m.content}
            </div>
          ) : (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg,#e91e63,#7c3aed)', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 12, color: '#fff', marginTop: 2 }}>m</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, lineHeight: 1.65, whiteSpace: 'pre-wrap', color: '#e8e6ef' }}>
                  {m.content || (busy && i === msgs.length - 1 ? <span><span className="dot" /><span className="dot" /><span className="dot" /></span> : '')}
                </div>
                {m.cards && (
                  <div style={{ display: 'flex', gap: 10, overflowX: 'auto', marginTop: 12, paddingBottom: 6 }}>
                    {m.cards.map(c => (
                      <div key={c.slug} className="cardobra" style={{ minWidth: 200, maxWidth: 200, background: '#16161b', border: '1px solid #26262e', borderRadius: 14, overflow: 'hidden', transition: 'all .15s' }}>
                        <img src={ipfs(c.img)} alt={c.titulo} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', background: '#101014', display: 'block' }} />
                        <div style={{ padding: '10px 12px 12px', fontSize: 12.5 }}>
                          <b style={{ fontSize: 13 }}>{c.titulo}</b>
                          <div style={{ color: '#8a8794', marginTop: 2 }}>{c.tecnica} · {c.medidas} · {c.anio}</div>
                          <div style={{ marginTop: 6, color: '#e91e63', fontWeight: 700 }}>{c.precio}{c.precio_usd ? <span style={{ color: '#8a8794', fontWeight: 400 }}> · {c.precio_usd}</span> : null}</div>
                          <div style={{ marginTop: 3, color: c.estado === 'disponible' ? '#7ee2a0' : '#8a8794', fontSize: 11 }}>● {c.estado}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '10px 18px 18px' }}>
        <form onSubmit={e => { e.preventDefault(); enviar(); }}
          style={{ maxWidth: 720, margin: '0 auto', display: 'flex', gap: 8, alignItems: 'center', background: '#16161b', border: '1px solid #2a2a32', borderRadius: 24, padding: '6px 6px 6px 18px' }}>
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="Mensaje a mapa lab…" disabled={busy}
            style={{ flex: 1, background: 'transparent', border: 'none', color: '#f2f0ea', fontSize: 15, padding: '10px 0' }} />
          <button disabled={busy || !input.trim()} aria-label="enviar"
            style={{ width: 38, height: 38, borderRadius: 19, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 700, color: '#fff', background: input.trim() && !busy ? '#e91e63' : '#2a2a32', transition: 'background .15s' }}>
            ↑
          </button>
        </form>
        <p style={{ maxWidth: 720, margin: '8px auto 0', textAlign: 'center', color: '#5c5964', fontSize: 11 }}>
          Los precios y datos de obra salen del catálogo real del estudio. Cada venta la confirma map personalmente.
        </p>
      </div>
    </div>
  );
}
