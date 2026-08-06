'use client';
// Mapa Lab — la web ES el chat. Cada chat es un usuario, un carro.
// Burbujas + cards de obra; el checkout llegará como una card más.
import { useRef, useState } from 'react';

type Card = { slug: string; titulo: string; tecnica: string; medidas: string; anio: number; estado: string; img: string; precio: string };
type Msg = { role: 'user' | 'assistant'; content: string; cards?: Card[] };

const ipfs = (u: string) => u.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${u.slice(7)}` : u;

export default function Chat() {
  const [msgs, setMsgs] = useState<Msg[]>([{
    role: 'assistant',
    content: 'Hola — este es el estudio de map. Pregúntame por las obras, técnicas, precios o lo que quieras saber. La conversación es tu carrito: lo que te guste, lo apartamos aquí mismo.',
  }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  async function enviar() {
    const texto = input.trim();
    if (!texto || busy) return;
    setInput(''); setBusy(true);
    const historia = [...msgs, { role: 'user' as const, content: texto }];
    setMsgs([...historia, { role: 'assistant', content: '' }]);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: historia.map(({ role, content }) => ({ role, content })) }),
      });
      const reader = res.body!.getReader(); const dec = new TextDecoder(); let buf = '';
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
          scroller.current?.scrollTo({ top: 9e9 });
        }
      }
    } catch {
      setMsgs(cur => [...cur.slice(0, -1), { role: 'assistant', content: 'Se cortó la conexión — ¿me repites eso?' }]);
    }
    setBusy(false);
  }

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '20px 20px 12px', borderBottom: '1px solid #1e1e26' }}>
        <b style={{ fontSize: 18 }}>mapa <span style={{ color: '#e91e63' }}>lab</span></b>
        <span style={{ color: '#8a8794', fontSize: 12, marginLeft: 10 }}>maarmapa.eth · la web es el chat</span>
      </header>
      <div ref={scroller} style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
            <div style={{ background: m.role === 'user' ? '#e91e63' : '#141419', border: '1px solid #1e1e26',
              borderRadius: 16, padding: '10px 14px', whiteSpace: 'pre-wrap', fontSize: 15 }}>
              {m.content || '…'}
            </div>
            {m.cards && (
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', marginTop: 10, paddingBottom: 4 }}>
                {m.cards.map(c => (
                  <div key={c.slug} style={{ minWidth: 190, background: '#141419', border: '1px solid #26262e', borderRadius: 12, overflow: 'hidden' }}>
                    <img src={ipfs(c.img)} alt={c.titulo} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', background: '#101014' }} />
                    <div style={{ padding: '8px 10px 10px', fontSize: 12.5 }}>
                      <b>{c.titulo}</b>
                      <div style={{ color: '#8a8794' }}>{c.tecnica} · {c.medidas} · {c.anio}</div>
                      <div style={{ marginTop: 4, color: '#e91e63', fontWeight: 600 }}>{c.precio}</div>
                      <div style={{ color: c.estado === 'disponible' ? '#7ee2a0' : '#8a8794', fontSize: 11 }}>{c.estado}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={e => { e.preventDefault(); enviar(); }} style={{ display: 'flex', gap: 10, padding: 16, borderTop: '1px solid #1e1e26' }}>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="Pregunta por las obras…" disabled={busy}
          style={{ flex: 1, background: '#141419', border: '1px solid #26262e', borderRadius: 12, color: '#f2f0ea', padding: '12px 14px', fontSize: 15, outline: 'none' }} />
        <button disabled={busy} style={{ background: '#e91e63', color: '#fff', border: 'none', borderRadius: 12, padding: '0 20px', fontWeight: 700, cursor: 'pointer' }}>
          {busy ? '…' : 'enviar'}
        </button>
      </form>
    </main>
  );
}
